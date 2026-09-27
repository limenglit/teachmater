import { supabase } from '@/integrations/supabase/client';

/**
 * 学生扫码进入页面时，统一「会话 ID 解析 + 读取重试」。
 *
 * 背景：部分扫码器/微信会在链接末尾附加标点、空格、大写化或多余路径，
 * 且课堂 Wi-Fi/4G 首个请求常因弱网失败。原实现只请求一次、失败即提示
 * 「签到会话不存在」，与机型无关。这里：
 *  1. 从原始参数中提取标准 UUID（小写）；
 *  2. 网络/服务端错误自动重试（指数退避），仅在服务端明确返回空时判定不存在。
 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function normalizeSessionId(raw?: string | null): string | null {
  if (!raw) return null;
  let s = raw;
  try { s = decodeURIComponent(raw); } catch { /* keep raw */ }
  const m = s.match(UUID_RE);
  return m ? m[0].toLowerCase() : null;
}

export type ScanLoadResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'not_found' }
  | { kind: 'network' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function loadScanSession<T = any>(
  rpcName: string,
  sessionId: string | null,
  attempts = 4,
): Promise<ScanLoadResult<T>> {
  if (!sessionId) return { kind: 'not_found' };
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await (supabase.rpc as any)(rpcName, { p_session_id: sessionId });
      if (!error) return data ? { kind: 'ok', data: data as T } : { kind: 'not_found' };
      // 非法 UUID 等参数错误属于「不存在」，无需重试
      if (error.code === '22P02') return { kind: 'not_found' };
    } catch { /* network error → retry */ }
    if (i < attempts - 1) await sleep(600 * 2 ** i);
  }
  return { kind: 'network' };
}
