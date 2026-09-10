import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `你是会场座次图视觉定位专家。用户上传的是一张座次图（可能只是整图的一小块）。
你的任务：找出图片中每一个"人名"文字，并给出它在**这张图片**中的归一化中心坐标。

严格输出 JSON（不要 markdown、不要解释）：
{
  "markers": [
    { "name": "张三", "x": 0.42, "y": 0.17, "row": 3, "seatNo": 7, "zone": "A区" }
  ]
}

规则：
- x、y 为该姓名文字块中心相对本图片宽/高的比例，取值 0~1，保留 3 位小数。
- 只输出人名（一般 2~4 个汉字，也可能是外文姓名）。标题、区号说明、"主席台"、"过道"、纯数字座位号等不要作为 name 输出。
- row / seatNo / zone 为可选：只有在图中明确可读时才填写，读不到就省略该字段。
- 姓名不清晰、被裁切一半时不要臆造；宁可跳过。
- 不要遗漏：逐排、逐列扫描，确保每个格子里的姓名都被输出。`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return errorResponse('Unauthorized', 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return errorResponse('Unauthorized', 401);

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: quotaOk } = await svc.rpc('consume_ai_quota', { p_user_id: user.id });
    if (quotaOk === false) return errorResponse('已达今日 AI 使用上限', 429);

    const body = await req.json().catch(() => null);
    const imageBase64 = body?.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== 'string') return errorResponse('imageBase64 required', 400);
    if (imageBase64.length > 12_000_000) return errorResponse('图片分块过大，请重试', 400);
    const mt = typeof body?.mimeType === 'string' && /^image\/(png|jpe?g|webp)$/i.test(body.mimeType)
      ? body.mimeType
      : 'image/jpeg';
    const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mt};base64,${imageBase64}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse('AI 服务未配置', 500);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "请识别这张座次图分块中的所有姓名及其归一化坐标，输出 JSON。" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      console.warn(`[parse-seat-chart-markers] gateway ${r.status}: ${text.slice(0, 300)}`);
      if (r.status === 429) return errorResponse('AI 服务繁忙，请稍后重试', 429);
      if (r.status === 402) return errorResponse('AI 额度不足，请补充后重试', 402);
      if (r.status === 403) return errorResponse('AI 服务当前不可用', 403);
      return errorResponse('AI 识别失败，请重试', 502);
    }

    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = null; } }
    }
    const markers = Array.isArray(parsed?.markers) ? parsed.markers : [];

    return new Response(JSON.stringify({ markers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-seat-chart-markers error:", e);
    return errorResponse("Internal error", 500);
  }
});
