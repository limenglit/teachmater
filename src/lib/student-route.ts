/** 学生扫码页（无需登录）：这些页面不触发全站登录检查与功能配置读取。 */
export function isStudentScanRoute(pathname?: string): boolean {
  const p = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  return p.startsWith('/checkin/') || p.startsWith('/seat-checkin/');
}

/** 其它学生扫码页（测验/投票/讨论/任务）：仍用完整应用，但跳过登录检查与配置读取，减少首屏请求。 */
export function isStudentLiteRoute(pathname?: string): boolean {
  const p = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  return p.startsWith('/quiz/') || p.startsWith('/poll/') || p.startsWith('/discuss/') || p.startsWith('/task/');
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
