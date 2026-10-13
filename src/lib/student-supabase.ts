/**
 * 学生扫码页专用的极简后台连接（约 1KB）：只用浏览器自带 fetch 调用后台函数和插入记录，
 * 不加载完整连接库、不保存登录状态、不使用跨页面锁（部分 iOS 微信内核锁等待会卡死）。
 * 每个请求最长等 40 秒：慢线路上旧机型常需 15–30 秒才连上。
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Result<T = any> = { data: T | null; error: { message: string; code?: string; name?: string } | null };

async function call<T>(path: string, body: unknown, prefer?: string): Promise<Result<T>> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 40000) : null;
  try {
    const headers: Record<string, string> = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${URL_}/rest/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body ?? {}), signal: ctrl ? ctrl.signal : undefined });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!res.ok) return { data: null, error: { message: (json && json.message) || `HTTP ${res.status}`, code: json && json.code } };
    return { data: json as T, error: null };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return { data: null, error: { name: err?.name, message: `${err?.name || 'Error'}: ${err?.message || e}` } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const studentSupabase = {
  rpc: <T = any>(fn: string, args?: Record<string, unknown>) => call<T>(`rpc/${fn}`, args),
  from: (table: string) => ({
    insert: (row: Record<string, unknown> | Record<string, unknown>[]) => call(table, row, 'return=minimal'),
  }),
};
