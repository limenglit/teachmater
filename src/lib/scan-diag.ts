/** 扫码诊断：上报与显示文字。只在需要时由签到页按需加载。 */
import { studentSupabase as supabase } from '@/lib/student-supabase';
import type { ScanDiag } from '@/lib/scan-session';

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

