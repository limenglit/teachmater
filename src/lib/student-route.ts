/** 学生扫码页（无需登录）：这些页面不触发全站登录检查与功能配置读取。 */
export function isStudentScanRoute(pathname?: string): boolean {
  const p = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  return p.startsWith('/checkin/') || p.startsWith('/seat-checkin/');
}

/** 其它学生扫码页（测验/投票/讨论/任务）：仍用完整应用，但跳过登录检查与配置读取，减少首屏请求。 */
export function isStudentLiteRoute(pathname?: string): boolean {
  const p = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  return p.startsWith('/quiz/') || p.startsWith('/poll/') || p.startsWith('/discuss/') || p.startsWith('/task/') || /^\/board\/[^/]+\/submit/.test(p);
}

/** 学生读请求重试：iOS 跨境连接偶发 Load failed，指数退避+抖动，约 30 秒预算。 */
export async function retryRead<T extends { data: unknown; error: unknown }>(fn: () => PromiseLike<T>, budgetMs = 30000): Promise<T> {
  const start = Date.now();
  let last: T | undefined;
  for (let i = 0; ; i++) {
    try {
      last = await fn();
      if (!last.error || Date.now() - start > budgetMs) return last;
      const msg = String((last.error as { message?: string })?.message || '');
      if (!/load failed|failed to fetch|network|timeout|fetch/i.test(msg)) return last;
    } catch (e) {
      if (Date.now() - start > budgetMs) throw e;
    }
    await new Promise((r) => setTimeout(r, Math.min(4000, 500 * 2 ** i) + Math.random() * 500));
  }
}

/** 取 index.html 首帧预取的数据（只用一次，最多等 3 秒）；拿不到返回 null，交给正常请求。 */
export async function takePagePrefetch(fn: string, id: string): Promise<unknown | null> {
  const w = window as unknown as { __TM_PREFETCH__?: { id: string; fn: string; p: Promise<unknown> } | null };
  const pf = w.__TM_PREFETCH__;
  if (!pf || pf.fn !== fn || pf.id.toLowerCase() !== String(id).toLowerCase()) return null;
  w.__TM_PREFETCH__ = null;
  return Promise.race([pf.p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
}

/** 先用预取结果，没有再走带重试的正常请求。 */
export async function prefetchOr<T extends { data: unknown; error: unknown }>(fn: string, id: string, call: () => PromiseLike<T>): Promise<T> {
  const d = await takePagePrefetch(fn, id);
  if (d) return { data: d, error: null } as T;
  return call();
}
