/**
 * 学生扫码页专用的极简后台连接：只用浏览器自带 fetch。
 * - 读取（get）用不带自定义请求头的 GET，钥匙放在地址里 → 浏览器不发「预检」请求，往返减半。
 * - 写入（rpc/insert）遇到连接被掐断（Load failed）会在 30 秒内自动重发。
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Err = { message: string; code?: string; name?: string };
type Result<T = any> = { data: T | null; error: Err | null };

const isNetErr = (e: Err | null) => !!e && !e.code && /fetch|network|load failed|abort|Error:/i.test(e.message);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once<T>(url: string, init: RequestInit, timeoutMs: number, direct = false): Promise<Result<T>> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  // direct：绕过本站转发，直接连后台（本站转发连不上时的第二路）
  const nativeFetch = (typeof window !== 'undefined' && (window as unknown as { __TM_NATIVE_FETCH__?: typeof fetch }).__TM_NATIVE_FETCH__) || fetch;
  const f = direct ? nativeFetch : fetch;
  try {
    const res = await f(url, { ...init, signal: ctrl ? ctrl.signal : undefined });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!res.ok) return { data: null, error: { message: (json && json.message) || `HTTP ${res.status}`, code: (json && json.code) || `HTTP${res.status}` } };
    return { data: json as T, error: null };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return { data: null, error: { name: err?.name, message: `${err?.name || 'Error'}: ${err?.message || e}` } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// 学生点「扫码失败重试」后翻转线路偏好：下一次写入先走另一条线路
let routeFlip = 0;
export function flipStudentRoute() { routeFlip++; }
export const studentRouteFlip = () => routeFlip;

/** 写入：网络被掐断时自动重发（服务器已返回的错误不重发），重发时本站转发与直连交替 */
async function post<T>(path: string, body: unknown, prefer?: string): Promise<Result<T>> {
  const headers: Record<string, string> = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const init: RequestInit = { method: 'POST', headers, body: JSON.stringify(body ?? {}) };
  const deadline = Date.now() + 30000;
  let r: Result<T>;
  let n = routeFlip;
  do {
    r = await once<T>(`${URL_}/rest/v1/${path}`, init, 20000, n % 2 === 1);
    n++;
    if (!isNetErr(r.error)) return r;
    await sleep(600 + Math.random() * 900);
  } while (Date.now() < deadline);
  return r;
}

/** 读取：简单 GET 请求（无预检），单次最长 timeoutMs */
function get<T>(fn: string, args: Record<string, string>, timeoutMs = 12000, direct = false): Promise<Result<T>> {
  const q = Object.keys(args).map((k) => `${k}=${encodeURIComponent(args[k])}`).join('&');
  return once<T>(`${URL_}/rest/v1/rpc/${fn}?${q}&apikey=${KEY}`, { method: 'GET', cache: 'no-store' }, timeoutMs, direct);
}

export const studentSupabase = {
  rpc: <T = any>(fn: string, args?: Record<string, unknown>) => post<T>(`rpc/${fn}`, args),
  get,
  from: (table: string) => ({
    insert: (row: Record<string, unknown> | Record<string, unknown>[]) => post(table, row, 'return=minimal'),
  }),
};
