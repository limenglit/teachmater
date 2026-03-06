import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const ALLOWED_ORIGINS = [
  'https://teachmater.lovable.app',
  'https://id-preview--50abb99d-e699-4e11-920c-db8e0dcc3ffe.lovable.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

function errorResponse(req: Request, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const body = await req.json();
    const { messages, type, topic_id, creator_token } = body;

    // Validate type
    if (!type || !['report', 'wordcloud'].includes(type)) {
      return errorResponse(req, 'Invalid type. Must be "report" or "wordcloud"', 400);
    }

    // Validate topic_id
    if (!topic_id || typeof topic_id !== 'string') {
      return errorResponse(req, 'topic_id is required', 400);
    }

    // Validate creator_token
    if (!creator_token || typeof creator_token !== 'string') {
      return errorResponse(req, 'creator_token is required', 403);
    }

    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse(req, 'Messages must be a non-empty array', 400);
    }
    if (messages.length > 1000) {
      return errorResponse(req, 'Too many messages (max 1000)', 400);
    }

    // Validate each message
    for (let i = 0; i < messages.length; i++) {
      if (typeof messages[i] !== 'string') {
        return errorResponse(req, `Message at index ${i} must be a string`, 400);
      }
      if (messages[i].length > 500) {
        return errorResponse(req, `Message at index ${i} exceeds max length`, 400);
      }
    }

    // Verify topic exists and creator_token matches
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: topic, error: topicError } = await supabaseClient
      .from('discussion_topics')
      .select('id, creator_token')
      .eq('id', topic_id)
      .single();

    if (topicError || !topic) {
      return errorResponse(req, 'Topic not found', 404);
    }

    if (topic.creator_token !== creator_token) {
      return errorResponse(req, 'Unauthorized', 403);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const allText = messages.join('\n');
    if (allText.length > 50000) {
      return errorResponse(req, 'Total message content too large', 400);
    }

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "请分析以上弹幕内容。" },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return errorResponse("请求过于频繁，请稍后再试", 429);
      }
      if (status === 402) {
        return errorResponse("AI 额度不足，请充值", 402);
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
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
