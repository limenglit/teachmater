import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/**
 * 学生扫码页专用的轻量后台连接。
 *
 * - 不保存/刷新登录状态：学生无需登录，避免旧会话、刷新令牌带来的额外请求与失败。
 * - 「同地址空间」优先：先走网站自己域名下的后台中转（STUDENT_API_ORIGIN），
 *   国内微信/iPhone 访问更稳定；中转不可用时自动回退直连后台。
 */
const DIRECT_URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/** 网站同域名下的后台中转地址（在域名解析中配置后生效）。 */
export const STUDENT_API_ORIGIN = 'https://api.teachermate.org.cn';

let proxyHealthy: boolean | null = null; // null=未知

function withTimeout(input: RequestInfo | URL, init: RequestInit | undefined, ms: number) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const outer = init?.signal;
  if (ctrl && outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
  return fetch(input, { ...init, signal: ctrl ? ctrl.signal : init?.signal }).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

const routedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isApi = url.startsWith(DIRECT_URL);
  if (!isApi || proxyHealthy === false || typeof window === 'undefined') {
    return withTimeout(input, init, 12000);
  }
  const proxied = STUDENT_API_ORIGIN + url.slice(DIRECT_URL.length);
  try {
    const res = await withTimeout(proxied, init, proxyHealthy ? 12000 : 4000);
    // 中转未配置时常返回 404/5xx 页面；仅把后台真实响应视为可用。
    if (res.status === 404 || res.status >= 500 || !res.headers.get('content-type')?.includes('json')) {
      if (!proxyHealthy) { proxyHealthy = false; return withTimeout(input, init, 12000); }
    } else {
      proxyHealthy = true;
    }
    return res;
  } catch {
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    proxyHealthy = false;
    return withTimeout(input, init, 12000);
  }
};

export const studentSupabase = createClient<Database>(DIRECT_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: routedFetch },
});
