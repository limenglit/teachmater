import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callVolcVisual } from "../_shared/volc-sign.ts";

// 即梦 Seedream 4.0 文生图 req_key
const VISUAL_REQ_KEY = "jimeng_t2i_v40";


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
// 方舟 Seedream 尺寸范围：边长 512–4096，总像素不超过 ~4096*4096
const MAX_PIXELS = { "doubao-seedream-4-0-250828": 4096, "doubao-seedream-3-0-t2i-250415": 2048 } as Record<string, number>;

function normalizeSize(raw: unknown, model: string): string {
  const fallback = "2048x2048";
  if (typeof raw !== "string") return fallback;
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(raw.trim());
  if (!m) return fallback;
  let w = Number(m[1]);
  let h = Number(m[2]);
  const cap = MAX_PIXELS[model] ?? 4096;
  const scale = Math.min(1, cap / Math.max(w, h));
  w = Math.max(512, Math.round((w * scale) / 8) * 8);
  h = Math.max(512, Math.round((h * scale) / 8) * 8);
  return `${w}x${h}`;
}


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
    const watermark = body?.watermark === true;
    const seed = Number.isFinite(body?.seed) ? Math.trunc(body.seed) : undefined;

    // 参考图（最多 3 张，data URL 或 https 链接）
    const rawRefs: unknown = body?.refImages;
    const refImages: string[] = Array.isArray(rawRefs)
      ? rawRefs
          .filter((v): v is string => typeof v === 'string' && (v.startsWith('data:image/') || v.startsWith('https://')))
          .slice(0, 3)
      : [];
    const refBase64 = refImages
      .filter((v) => v.startsWith('data:image/'))
      .map((v) => v.slice(v.indexOf(',') + 1))
      .filter((v) => v.length > 0 && v.length < 8_000_000);
    const refUrls = refImages.filter((v) => v.startsWith('https://'));

    const ARK_API_KEY = Deno.env.get('ARK_API_KEY');
    const VOLC_AK = Deno.env.get('VOLC_ACCESS_KEY_ID');
    const VOLC_SK = Deno.env.get('VOLC_SECRET_ACCESS_KEY');

    let size = normalizeSize(body?.size, model);
    const [wStr, hStr] = size.split('x');

    // 1) 优先走火山引擎 Visual (即梦/Seedream) —— 地域 cn-north-1，服务 cv
    let volcError: string | null = null;
    if (VOLC_AK && VOLC_SK) {
      try {
        const submit = await callVolcVisual({
          accessKeyId: VOLC_AK,
          secretAccessKey: VOLC_SK,
          action: 'CVSync2AsyncSubmitTask',
          version: '2022-08-31',
          body: {
            req_key: VISUAL_REQ_KEY,
            prompt,
            width: Number(wStr),
            height: Number(hStr),
            ...(seed !== undefined ? { seed } : {}),
            ...(refBase64.length ? { binary_data_base64: refBase64 } : {}),
            ...(refUrls.length ? { image_urls: refUrls } : {}),
            use_pre_llm: true,
          },
        });

        const submitData = await submit.json().catch(() => null);
        const taskId = submitData?.data?.task_id;
        if (!taskId) {
          volcError = `submit ${submit.status}: ${submitData?.code ?? ''} ${submitData?.message ?? JSON.stringify(submitData)?.slice(0, 300)}`;
          console.error('Visual submit failed:', volcError);
        } else {
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const poll = await callVolcVisual({
              accessKeyId: VOLC_AK,
              secretAccessKey: VOLC_SK,
              action: 'CVSync2AsyncGetResult',
              version: '2022-08-31',
              body: {
                req_key: VISUAL_REQ_KEY,
                task_id: taskId,
                req_json: JSON.stringify({ return_url: true, logo_info: { add_logo: watermark } }),
              },
            });
            const pollData = await poll.json().catch(() => null);
            const status = pollData?.data?.status;
            const url = pollData?.data?.image_urls?.[0];
            const b64 = pollData?.data?.binary_data_base64?.[0];
            if (url || b64) {
              // 火山返回的是带签名/有时效且不带 CORS 头的 TOS 链接，
              // 浏览器既无法稳定显示也无法 fetch 存档，这里统一转成 data URL 返回。
              let imageUrl = b64 ? `data:image/jpeg;base64,${b64}` : '';
              if (!imageUrl && url) {
                try {
                  const imgResp = await fetch(url);
                  if (!imgResp.ok) throw new Error(`download ${imgResp.status}`);
                  const buf = new Uint8Array(await imgResp.arrayBuffer());
                  let bin = '';
                  for (let k = 0; k < buf.length; k += 0x8000) {
                    bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
                  }
                  const mime = imgResp.headers.get('content-type') || 'image/jpeg';
                  imageUrl = `data:${mime};base64,${btoa(bin)}`;
                } catch (dlErr) {
                  console.error('Visual image download failed:', dlErr);
                  imageUrl = url; // 兜底仍返回原始链接
                }
              }
              return json({
                imageUrl,
                model: VISUAL_REQ_KEY,
                size,
                provider: 'volc-visual',
              });
            }

            if (status === 'done' || status === 'not_found' || status === 'expired') {
              volcError = `poll status=${status}: ${pollData?.message ?? ''}`;
              console.error('Visual task ended without image:', JSON.stringify(pollData));
              break;
            }
          }
          if (!volcError) volcError = 'poll timeout';
        }
      } catch (visualErr) {
        volcError = `exception: ${visualErr instanceof Error ? visualErr.message : String(visualErr)}`;
        console.error('Visual request failed:', visualErr);
      }
    } else {
      volcError = 'VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY 未配置';
    }


    // 2) 兼容旧的方舟 Ark 链路
    if (ARK_API_KEY) {

      // 依次尝试可用模型（账号可能仅开通其中之一）
      const candidates = [model, ...[...ALLOWED_MODELS].filter(m => m !== model)];
      for (const m of candidates) {
        size = normalizeSize(body?.size, m);
        try {
          const resp = await fetch(ARK_ENDPOINT, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ARK_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: m,
              prompt,
              size,
              response_format: 'url',
              watermark,
              ...(seed !== undefined ? { seed } : {}),
              ...(refImages.length ? { image: refImages.length === 1 ? refImages[0] : refImages } : {}),

            }),
          });


          if (resp.ok) {
            const data = await resp.json();
            const item = data?.data?.[0];
            const imageUrl = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
            if (imageUrl) return json({ imageUrl, model: m, size, provider: 'ark' });
            console.error('Ark returned no image for model', m);
          } else {
            console.error('Ark error:', m, resp.status, await resp.text());
          }
        } catch (arkErr) {
          console.error('Ark request failed:', m, arkErr);
        }
      }
    }

    // 降级：Lovable AI 生图
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return json({ error: '生图服务暂不可用：火山引擎 API Key 无效或已过期，请更新后重试' }, 502);
    }

    const fbResp = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (fbResp.status === 429) return json({ error: '生图请求过于频繁，请稍后重试' }, 429);
    if (fbResp.status === 402) return json({ error: 'AI 算力额度不足，请充值后重试' }, 402);
    if (!fbResp.ok) {
      console.error('Fallback image error:', fbResp.status, await fbResp.text());
      return json({ error: '生图服务返回错误' }, 502);
    }

    const fbData = await fbResp.json();
    const fbItem = fbData?.data?.[0];
    const fbUrl = fbItem?.url || (fbItem?.b64_json ? `data:image/png;base64,${fbItem.b64_json}` : null);
    if (!fbUrl) return json({ error: '未返回图片' }, 502);

    return json({ imageUrl: fbUrl, model: 'google/gemini-3.1-flash-image', size, provider: 'lovable', volcError });

  } catch (e) {
    console.error('generate-visual-image error:', e);
    return json({ error: 'Internal error' }, 500);
  }
});
