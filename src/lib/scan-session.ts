import { studentSupabase as supabase } from '@/lib/student-supabase';

/**
 * 学生扫码进入页面时，统一「会话 ID 解析 + 读取重试 + 诊断记录」。
 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function normalizeSessionId(raw?: string | null): string | null {
  if (!raw) return null;
  let s = raw;
  try { s = decodeURIComponent(raw); } catch { /* keep raw */ }
  const m = s.match(UUID_RE);
  return m ? m[0].toLowerCase() : null;
}


export interface ScanDiag {
  stage: string;      // timeout | fetch | server | parse | ok
  error: string;
  elapsedMs: number;
  attempts: number;
  ios: string;
  wechat: string;
  ua: string;
}

export type ScanLoadResult<T> =
  | { kind: 'ok'; data: T; diag?: ScanDiag }
  | { kind: 'not_found'; diag?: ScanDiag }
  | { kind: 'network'; diag: ScanDiag };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export function deviceInfo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const ios = (ua.match(/OS (\d+[_.]\d+(?:[_.]\d+)?) like Mac OS X/) || [])[1]?.replace(/_/g, '.') || '';
  const wechat = (ua.match(/MicroMessenger\/([\d.]+)/i) || [])[1] || '';
  return { ua, ios, wechat };
}

function classify(e: unknown): { stage: string; error: string } {
  const err = e as { name?: string; message?: string; code?: string } | null;
  const name = err?.name || '';
  const msg = String(err?.message || e || '').slice(0, 300);
  if (name === 'AbortError' || /abort/i.test(msg)) return { stage: 'timeout', error: `${name}: ${msg}` };
  if (/lock/i.test(msg)) return { stage: 'lock', error: `${name}: ${msg}` };
  if (name === 'TypeError' || /fetch|network|load failed/i.test(msg)) return { stage: 'fetch', error: `${name}: ${msg}` };
  return { stage: 'parse', error: `${name}: ${msg}` };
}

type R = { data: any; error: { message: string; code?: string; name?: string } | null };

/** 双路并发：一路 6 秒没回应就再发一路，谁先成功用谁 */
function hedged(rpcName: string, sessionId: string): Promise<R> {
  return new Promise((resolve) => {
    let done = false; let pending = 0; let lastErr: R | null = null;
    const fire = () => {
      pending++;
      supabase.get(rpcName, { p_session_id: sessionId }).then((r) => {
        pending--;
        if (done) return;
        if (!r.error || r.error.code) { done = true; resolve(r); return; }
        lastErr = r;
        if (pending === 0) { done = true; resolve(r); }
      });
    };
    fire();
    setTimeout(() => { if (!done) fire(); }, 2500);
    setTimeout(() => { if (!done) { done = true; resolve(lastErr || { data: null, error: { name: 'AbortError', message: 'AbortError: budget' } }); } }, 15000);
  });
}

const cacheKey = (id: string) => `tm-scan-session-${id}`;
function readCache(id: string) { try { const v = localStorage.getItem(cacheKey(id)); return v ? JSON.parse(v) : null; } catch { return null; } }
function writeCache(id: string, d: unknown) { try { localStorage.setItem(cacheKey(id), JSON.stringify(d)); } catch { /* full */ } }

/** 首页内联脚本抢先发起的请求（页面代码下载期间已在取数据） */
function takePrefetch(rpcName: string, sessionId: string): Promise<any> | null {
  const w = window as unknown as { __TM_PREFETCH__?: { id: string; fn: string; p: Promise<any> } };
  const pf = w.__TM_PREFETCH__;
  if (!pf || pf.id !== sessionId || pf.fn !== rpcName) return null;
  w.__TM_PREFETCH__ = undefined;
  return pf.p;
}

/**
 * 在约 60 秒总时长内持续重试：快速失败后 0.5–1.5 秒再试；
 * 手机网络恢复或切回页面时立即再试。onAttempt 用于显示「正在连接… 第 N 次」。
 */
export async function loadScanSession<T = any>(
  rpcName: string,
  sessionId: string | null,
  budgetMs = 60000,
  onAttempt?: (n: number) => void,
): Promise<ScanLoadResult<T>> {
  const dev = deviceInfo();
  const start = now();
  const log: string[] = [];
  // 启动信息：入口脚本几毫秒后开始运行（js:），是否经过看门狗自动刷新（r）
  try {
    const at = (window as unknown as { __TM_ENTRY_AT__?: number }).__TM_ENTRY_AT__;
    if (typeof at === 'number' && at > 0) log.push(`js:${at}`);
    if (/[?&]_r=\d+/.test(window.location.search)) log.push('r');
  } catch { /* ignore */ }
  const mk = (stage: string, error: string, n: number): ScanDiag => ({
    stage, error: (log.length ? `[${log.join(',')}] ` : '') + error, elapsedMs: now() - start, attempts: n, ...dev,
  });
  if (!sessionId) return { kind: 'not_found' };

  const pf = takePrefetch(rpcName, sessionId);
  if (pf) {
    const data = await Promise.race([pf.catch(() => null), sleep(3000).then(() => null)]);
    if (data) { writeCache(sessionId, data); log.push(`pf:${Math.round(now() - start)}`); return { kind: 'ok', data, diag: mk('ok', 'prefetch', 0) }; }
    log.push('pf:fail');
  }

  let wake: (() => void) | null = null;
  const onWake = () => { if (wake) wake(); };
  const onVis = () => { if (document.visibilityState === 'visible') onWake(); };
  window.addEventListener('online', onWake);
  document.addEventListener('visibilitychange', onVis);
  const pause = (ms: number) => new Promise<void>((r) => { const t = setTimeout(r, ms); wake = () => { clearTimeout(t); r(); }; });

  let last = { stage: 'fetch', error: '' };
  let n = 0;
  try {
    while (n === 0 || now() - start < budgetMs) {
      n++;
      onAttempt?.(n);
      const t0 = now();
      let res: R;
      try { res = await hedged(rpcName, sessionId); } catch (e) { res = { data: null, error: { message: String(e) } }; }
      const { data, error } = res;
      if (!error) {
        log.push(`${n}:ok:${Math.round(now() - t0)}`);
        if (data) writeCache(sessionId, data);
        const diag = mk('ok', '', n);
        return data ? { kind: 'ok', data: data as T, diag } : { kind: 'not_found', diag };
      }
      if (error.code === '22P02') return { kind: 'not_found' };
      last = error.code
        ? { stage: 'server', error: `${error.code} ${error.message || ''}`.trim().slice(0, 300) }
        : classify({ name: error.name || 'FetchError', message: error.message });
      log.push(`${n}:${last.stage}:${Math.round(now() - t0)}`);
      if (log.length > 12) log.shift();
      await pause(500 + Math.random() * 1000);
    }
  } finally {
    window.removeEventListener('online', onWake);
    document.removeEventListener('visibilitychange', onVis);
  }
  // 全部失败时，若本机存过这场签到，先用本机副本显示表单
  const cached = readCache(sessionId);
  if (cached) return { kind: 'ok', data: cached as T, diag: mk('cache', last.error, n) };
  return { kind: 'network', diag: mk(last.stage, last.error, n) };
}

/** 重扫时立即可用的本机副本 */
export const getCachedScanSession = (id: string | null) => (id ? readCache(id) : null);
