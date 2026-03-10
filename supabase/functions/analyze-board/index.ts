import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Auth check - require valid user JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(req, 'Unauthorized', 401);
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return errorResponse(req, 'Unauthorized', 401);
    }

    const body = await req.json();
    const { cards } = body;

    if (!Array.isArray(cards) || cards.length === 0) {
      return errorResponse(req, 'Cards must be a non-empty array', 400);
    }
    if (cards.length > 500) {
      return errorResponse(req, 'Too many cards (max 500)', 400);
    }

    const lines: string[] = [];
    for (const card of cards) {
      if (typeof card.content === 'string' && card.content.trim()) {
        const author = card.author_nickname || '匿名';
        lines.push(`[${author}]: ${card.content.slice(0, 500)}`);
      }
    }

    if (lines.length === 0) {
      return errorResponse(req, 'No valid card content', 400);
    }

    const allText = lines.join('\n');
    if (allText.length > 80000) {
      return errorResponse(req, 'Total content too large', 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const totalCards = cards.length;
    const uniqueAuthors = new Set(cards.map((c: any) => c.author_nickname || '匿名')).size;

    const systemPrompt = `你是一个课堂协作白板分析助手。请对以下白板卡片内容进行全面的汇总分析，生成一份结构化的智能报告。

基本统计：共 ${totalCards} 张卡片，${uniqueAuthors} 位参与者。

请按以下格式输出报告（使用中文）：

## 📊 数据概览
- 总卡片数、参与人数、内容类型分布等基本统计

## 🎯 核心主题分析
提取 3-5 个最集中的讨论主题，每个主题包含：
- 主题名称与占比估算
- 代表性观点摘要（1-2句）

## 💡 关键洞察
- 列出 3-5 个值得关注的发现或趋势
- 包括共识点和分歧点

## 🏆 精选内容
- 挑选 3-5 条最有价值/最有创意的卡片内容

## 📈 建议与展望
- 基于讨论内容，给出 2-3 条后续行动建议

白板卡片内容：
${allText}`;

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
          { role: "user", content: "请分析以上白板卡片内容，生成智能报告。" },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return errorResponse(req, "请求过于频繁，请稍后再试", 429);
      if (status === 402) return errorResponse(req, "AI 额度不足", 402);
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return errorResponse(req, "AI 分析失败", 500);
    }

    // Pass through the SSE stream directly
    return new Response(response.body, {
      headers: { ...getCorsHeaders(req), "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-board error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
