import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { internalErrorResponse } from '../_shared/responses.ts';
import { callDeepSeek, callLovableAI, cardsToResponse } from './lib.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  topic: string;
  count?: number;
  audience?: string;
  hint?: string;
}

const SYSTEM_PROMPT = `你是教学词库设计助手。根据用户给出的主题，生成"消消乐"匹配学习卡片。
每张卡片包含一对配对内容：word（题面/术语/英文/缩写等），definition（对应的中文释义/解释/对照）。
- word 与 definition 必须语义一一对应、简洁、不超过 20 个字符（用于卡片显示）。
- 严禁重复；尽量覆盖经典/高频内容。
- 必要时可附 example（一句话示例，可省略）。
仅通过 emit_cards 工具返回结果，不要输出其他文本。`;

function buildPrompt(b: Body): string {
  const audience = b.audience ? `适用对象：${b.audience}。` : '';
  const hint = b.hint ? `补充说明：${b.hint}。` : '';
  const count = Math.max(2, Math.min(40, b.count ?? 10));
  return `${audience}${hint}请围绕主题"${b.topic}"，生成 ${count} 对匹配卡片，调用 emit_cards 返回。`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  try {
    // Require authenticated user to prevent anonymous abuse of AI credits
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Server-side AI quota
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: quotaOk } = await svc.rpc('consume_ai_quota', { p_user_id: claimsData.claims.sub });
    if (quotaOk === false) {
      return new Response(JSON.stringify({ error: '已达今日 AI 使用上限' }), {
        status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.topic || typeof body.topic !== 'string') {
      return new Response(JSON.stringify({ error: '缺少 topic' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(body) },
    ];

    let json: any;
    try {
      json = await callLovableAI(messages);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg === 'RATE_LIMIT') {
        return new Response(JSON.stringify({ error: 'AI 请求过于频繁，请稍后重试' }), {
          status: 429,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      // Fallback to DeepSeek on 402 / other errors
      console.warn('Lovable AI failed, falling back to DeepSeek:', msg);
      try {
        json = await callDeepSeek(messages);
      } catch (e2: any) {
        console.error('DeepSeek fallback failed:', e2);
        return new Response(JSON.stringify({ error: 'AI 生成失败，请稍后重试' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    return cardsToResponse(json, CORS_HEADERS);
  } catch (e: any) {
    console.error('generate-vocab-cards error:', e);
    return internalErrorResponse(CORS_HEADERS);
  }
});
