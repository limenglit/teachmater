import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { messages, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const allText = messages.join('\n');

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
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI 额度不足，请充值" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI 分析失败" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-barrage error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
