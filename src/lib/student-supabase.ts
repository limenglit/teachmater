import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/**
 * 学生扫码页专用的轻量后台连接。
 *
 * - 不保存/刷新登录状态：不使用浏览器「跨页面锁」(navigator.locks)，
 *   避免部分 iOS 版本微信内置浏览器中锁等待卡死导致请求一直排队。
 * - 每个请求最长等 40 秒：8 月 28 日版本不设超时，慢线路上旧机型常需 15–30 秒才连上，过短超时会把本可成功的请求反复掐断。
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const timedFetch: typeof fetch = (input, init) => {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const outer = init?.signal;
  if (ctrl && outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 40000) : null;
  return fetch(input, { ...init, signal: ctrl ? ctrl.signal : init?.signal }).then(
    (r) => { if (timer) clearTimeout(timer); return r; },
    (e) => { if (timer) clearTimeout(timer); throw e; },
  );
};

export const studentSupabase = createClient<Database>(URL_, KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'tm-student-scan',
    lock: async (_name, _timeout, fn) => fn(),
  },
  realtime: { params: { eventsPerSecond: 2 } },
  global: { fetch: timedFetch },
});
