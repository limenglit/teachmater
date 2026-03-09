import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { content, audience } = await req.json();
    
    if (!content || content.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Content too short" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const audiencePrompt = {
      report: "汇报型风格，重点突出结论和数据支撑",
      teaching: "教学型风格，循序渐进，便于理解",
      marketing: "营销型风格，突出亮点和说服力",
    }[audience] || "通用风格";

    const systemPrompt = `你是专业的PPT大纲生成专家。根据用户提供的文稿内容，生成结构化的PPT大纲。

要求：
1. 提取3-5个核心关键词
2. 生成8-12页幻灯片大纲
3. 每页包含标题和3-5个要点
4. 风格：${audiencePrompt}
5. 必须包含：标题页、目录页、若干内容页、总结页
6. 内容页可使用多种布局类型，增加视觉多样性

支持的幻灯片类型：
- title: 标题页（含标题和副标题）
- toc: 目录页（含章节列表）
- content: 标准内容页（含标题和要点列表）
- section: 章节分隔页（仅标题）
- two-column: 双栏布局（左右两列内容对比或并列展示）
- image-text: 图文混排（左侧图片占位，右侧文字要点）
- comparison: 对比分析（左右两个对比方案，如优缺点、前后对比）
- quote: 名言引用（引用文字和作者）
- timeline: 时间线（展示发展历程或步骤流程）
- conclusion: 总结页（含总结要点）

输出JSON格式（不要包含任何其他文字）：
{
  "title": "演示文稿标题",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "slides": [
    {"type": "title", "title": "标题", "subtitle": "副标题"},
    {"type": "toc", "title": "目录", "bullets": ["章节1", "章节2", "章节3"]},
    {"type": "content", "title": "内容标题", "bullets": ["要点1", "要点2", "要点3"]},
    {"type": "two-column", "title": "双栏对比", "leftTitle": "方面A", "leftBullets": ["要点1", "要点2"], "rightTitle": "方面B", "rightBullets": ["要点1", "要点2"]},
    {"type": "image-text", "title": "图文说明", "imagePlaceholder": "示意图描述", "bullets": ["说明1", "说明2"]},
    {"type": "comparison", "title": "方案对比", "leftTitle": "方案A", "leftBullets": ["优点1", "优点2"], "rightTitle": "方案B", "rightBullets": ["优点1", "优点2"]},
    {"type": "quote", "title": "启示", "quoteText": "引用的名言内容", "quoteAuthor": "作者姓名"},
    {"type": "timeline", "title": "发展历程", "timelineItems": [{"year": "2020", "text": "事件1"}, {"year": "2022", "text": "事件2"}]},
    {"type": "section", "title": "章节分隔"},
    {"type": "conclusion", "title": "总结", "bullets": ["总结1", "总结2"]}
  ],
  "audience": "${audience}"
}

请根据内容的特点，合理选择不同的幻灯片类型，使演示更加生动有层次。`;

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
          { role: "user", content: `请根据以下内容生成PPT大纲：\n\n${content.slice(0, 8000)}` },
        ],
        temperature: 0.7,
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "Payment required" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in response");
    }

    const outline = JSON.parse(jsonMatch[0]);
    
    return new Response(
      JSON.stringify({ outline }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-ppt-outline error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
