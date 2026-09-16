import { supabase } from '@/integrations/supabase/client';

/**
 * supabase.functions.invoke() 只给出 "Edge Function returned a non-2xx status code"，
 * 真实原因在 error.context（Response）里。这里把它解析成可读的中文提示。
 */
export async function readEdgeFunctionError(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response })?.context;
  const fallback = (err as Error)?.message || '请求失败';

  if (!ctx || typeof ctx !== 'object' || typeof (ctx as Response).text !== 'function') {
    return fallback;
  }

  let bodyText = '';
  try {
    bodyText = await (ctx as Response).clone().text();
  } catch {
    /* ignore */
  }

  let message = '';
  try {
    const parsed = JSON.parse(bodyText);
    message = parsed?.error || parsed?.message || '';
  } catch {
    message = bodyText.slice(0, 200);
  }

  const status = (ctx as Response).status;
  if (!message) {
    if (status === 401) return '登录状态已失效，请重新登录后再试。';
    if (status === 429) return '今日 AI 使用次数已用完，请明天再试或充值后继续。';
    if (status === 402) return 'AI 额度已用尽，请联系管理员充值。';
    if (status >= 500) return 'AI 服务暂时不可用，请稍后重试。';
    return fallback;
  }
  return message;
}

/** 401 时尝试刷新会话（令牌过期常见于长时间停留页面）。 */
export async function refreshSessionIfUnauthorized(err: unknown): Promise<boolean> {
  const status = (err as { context?: Response })?.context?.status;
  if (status !== 401) return false;
  const { data } = await supabase.auth.refreshSession();
  return !!data.session;
}
