/** 扫码诊断：上报与显示文字。只在需要时由签到页按需加载。 */
import { studentSupabase as supabase } from '@/lib/student-supabase';
import type { ScanDiag } from '@/lib/scan-session';

const QKEY = 'tm-diag-queue';
type Row = Record<string, unknown>;
const readQ = (): Row[] => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; } };
const writeQ = (q: Row[]) => { try { if (q.length) localStorage.setItem(QKEY, JSON.stringify(q.slice(-20))); else localStorage.removeItem(QKEY); } catch { /* full */ } };

async function send(row: Row): Promise<boolean> {
  try {
    const r = await (supabase.rpc as any)('log_scan_diagnostic', row);
    return !r?.error || !!r.error.code; // 服务器已回应（含拒绝）就不再重发
  } catch { return false; }
}

let flushing = false;
/** 补发本机暂存的诊断记录（网络恢复或下次进入时） */
export async function flushScanDiagQueue() {
  if (flushing) return; flushing = true;
  try {
    const q = readQ(); const left: Row[] = [];
    for (const row of q) if (!(await send(row))) left.push(row);
    writeQ(left);
  } finally { flushing = false; }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => { void flushScanDiagQueue(); });

/** 诊断上报：失败先存手机上，之后自动补发。 */
export function reportScanDiag(page: string, sessionId: string | null, ok: boolean, diag: ScanDiag) {
  const row: Row = {
    p_session_id: sessionId, p_page: page, p_ok: ok, p_stage: diag.stage, p_error: diag.error,
    p_elapsed_ms: Math.round(diag.elapsedMs), p_attempts: diag.attempts, p_ua: diag.ua,
    p_ios_version: diag.ios, p_wechat_version: diag.wechat,
  };
  void send(row).then((sent) => {
    if (!sent) writeQ([...readQ(), row]);
    else void flushScanDiagQueue();
  });
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
