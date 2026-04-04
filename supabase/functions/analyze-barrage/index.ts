import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── AI call with DeepSeek fallback on 402 ────────────────────── */
async function callAIWithFallback(body: Record<string, unknown>): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const primary = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (primary.status !== 402) return primary;

  // Lovable credits exhausted → try DeepSeek
  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
  if (!DEEPSEEK_API_KEY) return primary; // no fallback key, propagate 402

  console.log("Lovable AI 402 → falling back to DeepSeek");
  const fallbackBody = { ...body, model: "deepseek-chat" };
  return fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(fallbackBody),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { messages, type, topic_id, creator_token } = body;

    if (!type || !['report', 'wordcloud'].includes(type)) {
      return errorResponse('Invalid type. Must be "report" or "wordcloud"', 400);
    }
    if (!topic_id || typeof topic_id !== 'string') {
      return errorResponse('topic_id is required', 400);
    }
    if (!creator_token || typeof creator_token !== 'string') {
      return errorResponse('creator_token is required', 403);
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse('Messages must be a non-empty array', 400);
    }
    if (messages.length < 3) {
      return errorResponse('消息太少，至少需要3条弹幕才能分析', 400);
    }
    if (messages.length > 1000) {
      return errorResponse('Too many messages (max 1000)', 400);
    }
    for (let i = 0; i < messages.length; i++) {
      if (typeof messages[i] !== 'string') return errorResponse(`Message at index ${i} must be a string`, 400);
      if (messages[i].length > 500) return errorResponse(`Message at index ${i} exceeds max length`, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service credentials are not configured');

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: topic, error: topicError } = await supabaseClient
      .from('discussion_topics').select('id, creator_token').eq('id', topic_id).maybeSingle();
    if (topicError) { console.error('Failed to load discussion topic:', topicError); return errorResponse('Topic lookup failed', 500); }
    if (!topic) return errorResponse('Topic not found', 404);
    if (topic.creator_token !== creator_token) return errorResponse('Unauthorized', 403);

    const allText = messages.join('\n');
    if (allText.length > 50000) return errorResponse('Total message content too large', 400);

    let systemPrompt = '';
    if (type === 'report') {
      systemPrompt = `你是一个课堂讨论分析助手。请分析以下学生的弹幕讨论内容，提取出最集中的5个主题方向。
每个主题用一个简短的标题和一句话描述，并给出该主题占比估算（百分比）。
请按占比从高到低排列。使用中文回答。

格式如下：
1. **主题标题** (约XX%) - 描述
2. **主题标题** (约XX%) - 描述
...

弹幕内容：
${allText}`;
    } else if (type === 'wordcloud') {
      systemPrompt = `你是一个中文文本分析助手。请分析以下弹幕文本，提取出所有有意义的关键词及其出现频率。
忽略停用词（的、了、是、在、和、有、我、你、他等），只保留实质性词语。
返回JSON格式，不要其他文字：
[{"word": "关键词", "count": 频率数字}, ...]
按频率从高到低排列，最多返回50个词。

弹幕内容：
${allText}`;
    }

    const response = await callAIWithFallback({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "请分析以上弹幕内容。" },
      ],
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return errorResponse("请求过于频繁，请稍后再试", 429);
      if (status === 402) return errorResponse("AI 额度不足", 402);
      const t = await response.text();
      console.error("AI error:", status, t);
      return errorResponse("AI 分析失败", 500);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-barrage error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
