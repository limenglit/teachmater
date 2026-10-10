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

/** 诊断上报：失败不影响签到，只尝试一次。 */
export function reportScanDiag(page: string, sessionId: string | null, ok: boolean, diag: ScanDiag) {
  try {
    void (supabase.rpc as any)('log_scan_diagnostic', {
      p_session_id: sessionId,
      p_page: page,
      p_ok: ok,
      p_stage: diag.stage,
      p_error: diag.error,
      p_elapsed_ms: Math.round(diag.elapsedMs),
      p_attempts: diag.attempts,
      p_ua: diag.ua,
      p_ios_version: diag.ios,
      p_wechat_version: diag.wechat,
    }).then(() => undefined, () => undefined);
  } catch { /* ignore */ }
}

export function formatScanDiag(d: ScanDiag): string {
  const sys = d.ios ? `iOS ${d.ios}` : (d.ua.match(/Android [\d.]+|HarmonyOS[\s/]?[\d.]*|OpenHarmony[\s/]?[\d.]*/i) || [''])[0];
  return [
    sys || '未知系统',
    d.wechat ? `微信 ${d.wechat}` : '非微信',
    `环节 ${d.stage}`,
    `${d.attempts} 次 / ${(d.elapsedMs / 1000).toFixed(1)}s`,
    d.error,
  ].filter(Boolean).join(' · ');
}

export async function loadScanSession<T = any>(
  rpcName: string,
  sessionId: string | null,
  attempts = 4,
): Promise<ScanLoadResult<T>> {
  const dev = deviceInfo();
  const start = now();
  const mk = (stage: string, error: string, n: number): ScanDiag => ({
    stage, error, elapsedMs: now() - start, attempts: n, ...dev,
  });
  if (!sessionId) return { kind: 'not_found' };
  let last = { stage: 'fetch', error: '' };
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await (supabase.rpc as any)(rpcName, { p_session_id: sessionId });
      if (!error) {
        const diag = mk('ok', '', i + 1);
        return data ? { kind: 'ok', data: data as T, diag } : { kind: 'not_found', diag };
      }
      // 非法 UUID 等参数错误属于「不存在」，无需重试
      if (error.code === '22P02') return { kind: 'not_found' };
      const cls = error.message && /fetch|network|load failed|abort/i.test(error.message)
        ? classify({ name: (error as any).name || 'FetchError', message: error.message })
        : { stage: 'server', error: `${error.code || ''} ${error.message || ''} ${(error as any).hint || ''}`.trim().slice(0, 300) };
      last = cls;
    } catch (e) {
      last = classify(e);
    }
    if (i < attempts - 1) await sleep(Math.min(800 * 2 ** i, 5000));
  }
  return { kind: 'network', diag: mk(last.stage, last.error, attempts) };
}
