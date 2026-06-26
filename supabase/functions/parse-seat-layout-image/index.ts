import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `你是一个会场座位图视觉解析专家。用户上传一张会场/教室座位示意图（通常是表格型或剧院型，含主席台/舞台/屏幕/分区/座位编号/姓名）。请精确识别并输出严格 JSON。

输出 JSON 结构（不要 markdown，不要解释，仅 JSON）：
{
  "title": "座位图标题（若可识别）",
  "podiumSide": "top|bottom|left|right|none",   // 主席台/舞台/讲台所在方向，相对观众视角
  "windowSide": "left|right",                    // 若图中暗示窗户/屏幕方向，否则默认 left
  "rowCols": [int, ...],                         // 每一排的座位总列数（含所有分区合并后的总列数）
  "rowAisles": [int, ...],                       // 在该索引行之后插入横向走道（0-based）
  "colAisles": [int, ...],                       // 在该索引列之后插入纵向走道（0-based，用于分隔左/中/右区块）
  "seats": [                                     // 二维数组，按 rowCols 对齐。可填姓名字符串、空字符串(空座)、或 null(占位无座)
    ["姓名1","姓名2",...],
    ...
  ],
  "specialZones": [                              // 可选：标注非座位区域（如 "校领导班子成员" 整排横幅）
    { "row": int, "label": "..." }
  ],
  "notes": "识别说明或不确定项"
}

规则：
- 仔细数清每行格子数。若某行只有部分座位有姓名（其余为空），用 "" 表示空座，用 null 表示该位置非座位（占位）。
- 优先识别中文姓名（2-4 字）；数字编号（如 20/18/16）属于座位号，不要写入 seats，但可放进 notes。
- 若图片含多个独立区块（左/中/右），用 colAisles 标出区块分隔位置，并将 rowCols 设为合并后的总列数。
- 弧形/阶梯式剧院图，仍展平为按排数的二维结构，前排短后排长。
- 不要臆造姓名；看不清就用 ""。`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return errorResponse('Unauthorized', 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return errorResponse('Unauthorized', 401);

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: quotaOk } = await svc.rpc('consume_ai_quota', { p_user_id: user.id });
    if (quotaOk === false) return errorResponse('已达今日 AI 使用上限', 429);

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') return errorResponse('imageBase64 required', 400);
    if (imageBase64.length > 15_000_000) return errorResponse('Image too large (max ~10MB)', 400);
    const mt = typeof mimeType === 'string' && /^image\/(png|jpe?g|webp|gif)$/i.test(mimeType) ? mimeType : 'image/png';

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse('LOVABLE_API_KEY not configured', 500);

    const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mt};base64,${imageBase64}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "请解析这张座位图并输出严格 JSON。" },
            { type: "image_url", image_url: { url: dataUrl } },
          ] },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Gemini error:", resp.status, t);
      if (resp.status === 429) return errorResponse("请求过于频繁，请稍后再试", 429);
      if (resp.status === 402) return errorResponse("AI 额度不足", 402);
      return errorResponse(`AI 解析失败: ${t.slice(0, 200)}`, 500);
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON block
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) return errorResponse("AI 返回内容非 JSON", 502);
      parsed = JSON.parse(m[0]);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-seat-layout-image error:", e);
    return errorResponse(`Internal error: ${(e as Error).message}`, 500);
  }
});
