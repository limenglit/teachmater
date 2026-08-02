import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callVolcVisual } from "../_shared/volc-sign.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// 即梦 AI-视频生成 req_key 白名单
const VIDEO_MODELS = new Set([
  'jimeng_ti2v_v30_pro',
  'jimeng_t2v_v30_1080p',
  'jimeng_t2v_v30',
]);
const RATIOS = new Set(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9']);

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
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 800) : '';
    if (prompt.length < 4) return json({ error: '提示词过短' }, 400);

    const reqKey = VIDEO_MODELS.has(body?.model) ? body.model : 'jimeng_ti2v_v30_pro';
    const aspectRatio = RATIOS.has(body?.aspectRatio) ? body.aspectRatio : '16:9';
    const frames = body?.frames === 241 ? 241 : 121;
    const seed = Number.isFinite(body?.seed) ? Math.trunc(body.seed) : undefined;

    // 首帧图（可选，data URL 或 https）
    const firstFrame = typeof body?.firstFrame === 'string' ? body.firstFrame : '';
    const frameBase64 = firstFrame.startsWith('data:image/')
      ? [firstFrame.slice(firstFrame.indexOf(',') + 1)]
      : [];
    const frameUrls = firstFrame.startsWith('https://') ? [firstFrame] : [];

    const VOLC_AK = Deno.env.get('VOLC_ACCESS_KEY_ID');
    const VOLC_SK = Deno.env.get('VOLC_SECRET_ACCESS_KEY');
    if (!VOLC_AK || !VOLC_SK) return json({ error: '视频生成服务未配置火山引擎密钥' }, 502);

    const submit = await callVolcVisual({
      accessKeyId: VOLC_AK,
      secretAccessKey: VOLC_SK,
      action: 'CVSync2AsyncSubmitTask',
      version: '2022-08-31',
      body: {
        req_key: reqKey,
        prompt,
        frames,
        aspect_ratio: aspectRatio,
        ...(seed !== undefined ? { seed } : {}),
        ...(frameBase64.length ? { binary_data_base64: frameBase64 } : {}),
        ...(frameUrls.length ? { image_urls: frameUrls } : {}),
      },
    });

    const submitData = await submit.json().catch(() => null);
    const taskId = submitData?.data?.task_id;
    if (!taskId) {
      const detail = `${submitData?.code ?? submit.status}: ${submitData?.message ?? ''}`;
      console.error('Video submit failed:', detail);
      return json({ error: `视频任务提交失败（${detail}）` }, 502);
    }

    // 轮询（视频生成较慢，最长约 5 分钟）
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await callVolcVisual({
        accessKeyId: VOLC_AK,
        secretAccessKey: VOLC_SK,
        action: 'CVSync2AsyncGetResult',
        version: '2022-08-31',
        body: { req_key: reqKey, task_id: taskId },
      });
      const pollData = await poll.json().catch(() => null);
      const status = pollData?.data?.status;
      const videoUrl = pollData?.data?.video_url;
      if (videoUrl) {
        return json({ videoUrl, model: reqKey, aspectRatio, frames, provider: 'volc-visual', taskId });
      }
      if (status === 'done' || status === 'not_found' || status === 'expired') {
        console.error('Video task ended without url:', JSON.stringify(pollData).slice(0, 500));
        return json({ error: `视频生成失败（status=${status}）` }, 502);
      }
    }

    return json({ error: '视频生成超时，请稍后在火山引擎控制台查看或重试', taskId }, 504);
  } catch (e) {
    console.error('generate-visual-video error:', e);
    return json({ error: 'Internal error' }, 500);
  }
});
