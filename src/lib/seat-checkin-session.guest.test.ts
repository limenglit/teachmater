/**
 * Guest (anonymous) end-to-end regression for createSeatCheckinSession.
 *
 * Locks in the fix for:
 *   1. PostgREST error 42501 "new row violates row-level security policy
 *      for table seat_checkin_sessions" when an anonymous teacher tries to
 *      generate a sign-in code.
 *   2. The follow-up bug where the session row got created but the client
 *      lost the creator_token / id, leaving the roster unmanageable (no one
 *      could read records or end the session).
 *
 * Strategy: mock the Supabase client so direct `.insert().select().single()`
 * always returns 42501 (mirroring the production RLS posture for `anon`).
 * Only the SECURITY DEFINER RPC `create_seat_checkin_session` succeeds.
 * Across a range of seating scenes (classroom / smart-classroom / banquet /
 * concert hall / extreme rosters) we verify:
 *   - the RPC path is used, no 42501 reaches the caller,
 *   - the returned sessionId + checkinUrl + creator_token are persisted to
 *     localStorage so the roster stays manageable after creation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeatCheckinSession, getSeatCheckinSessionToken } from './seat-checkin-session';

type SupabaseModule = typeof import('@/integrations/supabase/client');

const { mockRpc, mockSingle, mockSelect, mockInsert, mockFrom } = vi.hoisted(() => {
  const singleFn = vi.fn();
  const selectFn = vi.fn(() => ({ single: singleFn }));
  const insertFn = vi.fn(() => ({ select: selectFn }));
  const fromFn = vi.fn(() => ({ insert: insertFn }));
  return {
    mockRpc: vi.fn(),
    mockSingle: singleFn,
    mockSelect: selectFn,
    mockInsert: insertFn,
    mockFrom: fromFn,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    rpc: mockRpc,
    from: mockFrom,
  } as unknown as SupabaseModule['supabase'];
  return { supabase } satisfies SupabaseModule;
});



// Mirror the PostgREST shape of an RLS violation so the fallback paths
// behave exactly like the production failure mode.
const rlsError = {
  code: '42501',
  message: 'new row violates row-level security policy for table "seat_checkin_sessions"',
};

interface Scenario {
  label: string;
  sceneType: string;
  className: string;
  durationMinutes: number;
  studentNames: string[];
  sceneConfig: Record<string, unknown>;
  seatData: unknown;
}

const SCENARIOS: Scenario[] = [
  {
    label: '教室 · 30人均衡',
    sceneType: 'classroom',
    className: '高一(1)班',
    durationMinutes: 5,
    studentNames: Array.from({ length: 30 }, (_, i) => `学生${i + 1}`),
    sceneConfig: { rows: 5, cols: 6 },
    seatData: { rows: 5, cols: 6 },
  },
  {
    label: '智慧教室 · 男女间隔',
    sceneType: 'smart_classroom',
    className: '智慧教室A',
    durationMinutes: 10,
    studentNames: ['张三', '李四', '王五', '赵六', '钱七', '孙八'],
    sceneConfig: { rows: 2, cols: 3, gender: 'alternate' },
    seatData: [[{ name: '张三' }, { name: '李四' }, { name: '王五' }]],
  },
  {
    label: '宴会厅 · 按单位集中',
    sceneType: 'banquet',
    className: '校友返校宴',
    durationMinutes: 30,
    studentNames: ['张教授', '王主任', '李博士'],
    sceneConfig: { tables: 6, perTable: 8 },
    seatData: { tables: [] },
  },
  {
    label: '音乐厅 · 大规模',
    sceneType: 'concert_hall',
    className: '校庆音乐会',
    durationMinutes: 60,
    studentNames: Array.from({ length: 120 }, (_, i) => `观众${i + 1}`),
    sceneConfig: { rows: 10, cols: 12 },
    seatData: { rows: 10, cols: 12 },
  },
  {
    label: '极端 · 空名单 + 0分钟',
    sceneType: 'classroom',
    className: '',
    durationMinutes: 0,
    studentNames: [],
    sceneConfig: {},
    seatData: null,
  },
  {
    label: '极端 · 含全角空格与重复',
    sceneType: 'classroom',
    className: '  ',
    durationMinutes: 5,
    studentNames: ['张三', '张三', '张　三', ' 李四 ', ''],
    sceneConfig: { rows: 1, cols: 5 },
    seatData: [],
  },
];

describe('createSeatCheckinSession — guest regression for 42501', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // RPC succeeds — this is the only path that works for anon users.
    mockRpc.mockImplementation((fnName: string, params: Record<string, unknown>) => {
      if (fnName !== 'create_seat_checkin_session') {
        return Promise.resolve({ data: null, error: { message: `unexpected rpc ${fnName}` } });
      }
      return Promise.resolve({
        data: [
          {
            id: `session-${Math.random().toString(36).slice(2, 10)}`,
            creator_token: `token-${Math.random().toString(36).slice(2, 10)}`,
            created_at: new Date().toISOString(),
            duration_minutes: params.p_duration_minutes,
            status: 'active',
            ended_at: null,
            scene_type: params.p_scene_type,
            class_name: params.p_class_name,
            student_names: params.p_student_names,
          },
        ],
        error: null,
      });
    });

    // Any direct insert path is rejected by RLS — exactly like prod for anon.
    mockSingle.mockResolvedValue({ data: null, error: rlsError });
  });

  it.each(SCENARIOS)(
    'creates session and persists creator_token via RPC for scenario: $label',
    async (scenario) => {
      const result = await createSeatCheckinSession({
        seatData: scenario.seatData,
        studentNames: scenario.studentNames,
        sceneConfig: scenario.sceneConfig,
        sceneType: scenario.sceneType,
        durationMinutes: scenario.durationMinutes,
        className: scenario.className,
      });

      // RPC path was used — no 42501 ever bubbled up.
      expect(mockRpc).toHaveBeenCalledWith(
        'create_seat_checkin_session',
        expect.objectContaining({
          p_scene_type: scenario.sceneType,
          // duration is normalized to at least 1 minute by the client.
          p_duration_minutes: expect.any(Number),
        }),
      );
      // Direct insert fallback must NOT be exercised on the happy RPC path,
      // otherwise the 42501 would have surfaced to the user.
      expect(mockInsert).not.toHaveBeenCalled();

      // Session is returned with a usable id + checkin URL.
      expect(result.sessionId).toMatch(/^session-/);
      expect(result.checkinUrl).toContain(`/seat-checkin/${result.sessionId}`);
      expect(result.session.status).toBe('active');
      expect(result.session.scene_type).toBe(scenario.sceneType);

      // Creator token is persisted to localStorage so the roster stays
      // manageable (load records, end / delete the session) after creation.
      const persistedToken = getSeatCheckinSessionToken(result.sessionId);
      expect(persistedToken).toBeTruthy();
      expect(persistedToken).toMatch(/^token-/);

      // Session id is also indexed locally for history fallback queries.
      const indexedIds = JSON.parse(
        localStorage.getItem('teachmate_seat_checkin_session_ids_v1') || '[]',
      );
      expect(indexedIds).toContain(result.sessionId);

      // Duration is normalized to >= 1 minute even when caller passes 0.
      const rpcCall = mockRpc.mock.calls.find(([name]) => name === 'create_seat_checkin_session');
      expect(rpcCall?.[1]?.p_duration_minutes).toBeGreaterThanOrEqual(1);
    },
  );

  it('surfaces a clear error (no orphan roster) when RPC and every insert fallback are blocked by 42501', async () => {
    mockRpc.mockResolvedValue({ data: null, error: rlsError });

    await expect(
      createSeatCheckinSession({
        seatData: {},
        studentNames: ['张三'],
        sceneConfig: {},
        sceneType: 'classroom',
        durationMinutes: 5,
        className: '测试班',
      }),
    ).rejects.toThrow(/row-level security|42501/i);

    // Nothing was persisted locally — no half-created session left behind
    // for the UI to "manage".
    expect(localStorage.getItem('teachmate_seat_checkin_session_tokens_v1')).toBeFalsy();
    const indexedIds = JSON.parse(
      localStorage.getItem('teachmate_seat_checkin_session_ids_v1') || '[]',
    );
    expect(indexedIds).toEqual([]);
  });
});
