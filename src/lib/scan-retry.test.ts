import { describe, it, expect, vi, afterEach } from 'vitest';

// 「扫码失败重试」：点一次就放弃卡住的请求，换另一条线路立即重连
const calls: boolean[] = [];
let hangFirst = true;
vi.mock('@/lib/student-supabase', async () => {
  let flip = 0;
  return {
    flipStudentRoute: () => { flip++; },
    studentRouteFlip: () => flip,
    studentSupabase: {
      get: (_fn: string, _a: Record<string, string>, _t: number, direct: boolean) => {
        calls.push(direct);
        if (hangFirst) return new Promise(() => undefined); // 线路被掐住，一直不回应
        return Promise.resolve({ data: { status: 'active' }, error: null });
      },
    },
  };
});

import { loadScanSession, retryScanNow } from './scan-session';

const ID = '11111111-2222-3333-4444-555555555555';

afterEach(() => { calls.length = 0; hangFirst = true; vi.useRealTimers(); });

describe('scan retry button', () => {
  it('abandons a stuck request and reconnects on the other line first', async () => {
    const p = loadScanSession('get_checkin_session_for_student', ID, 60000);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toEqual([false]); // 第一次走本站转发，卡住
    hangFirst = false;
    expect(retryScanNow()).toBe(true);
    const res = await p;
    expect(res.kind).toBe('ok');
    expect(calls[1]).toBe(true); // 重试先走直连后台
  });

  it('reports no active load when the page already failed', () => {
    expect(retryScanNow()).toBe(false);
  });
});
