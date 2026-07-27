import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// 火山引擎方舟 (Ark) 图像生成
const ARK_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const ALLOWED_MODELS = new Set([
  "doubao-seedream-4-0-250828",
  "doubao-seedream-3-0-t2i-250415",
]);
const ALLOWED_SIZES = new Set(["1024x1024", "2048x2048", "2304x1728", "1728x2304", "2560x1440"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await authClient.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: quotaOk } = await svc.rpc('consume_ai_quota', { p_user_id: user.id });
    if (quotaOk === false) return json({ error: '已达今日 AI 使用上限' }, 429);

    const body = await req.json().catch(() => null);
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 2000) : '';
    if (prompt.length < 4) return json({ error: 'Prompt too short' }, 400);

    const model = ALLOWED_MODELS.has(body?.model) ? body.model : 'doubao-seedream-4-0-250828';
    const size = ALLOWED_SIZES.has(body?.size) ? body.size : '2048x2048';

    const ARK_API_KEY = Deno.env.get('ARK_API_KEY');
    if (!ARK_API_KEY) return json({ error: '未配置火山引擎 API Key' }, 500);

    const resp = await fetch(ARK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ARK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        response_format: 'url',
        watermark: false,
      }),
    });

    if (resp.status === 429) return json({ error: '火山引擎接口限流，请稍后重试' }, 429);
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Ark error:', resp.status, txt);
      return json({ error: '生图服务返回错误' }, 502);
    }

    const data = await resp.json();
    const item = data?.data?.[0];
    const imageUrl = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
    if (!imageUrl) return json({ error: '未返回图片' }, 502);

    return json({ imageUrl, model, size });
  } catch (e) {
    console.error('generate-visual-image error:', e);
    return json({ error: 'Internal error' }, 500);
  }
});
