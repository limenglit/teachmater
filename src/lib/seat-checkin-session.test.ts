import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeatCheckinSession } from './seat-checkin-session';

const rpcMock = vi.fn();
const singleMock = vi.fn();
const selectMock = vi.fn(() => ({ single: singleMock }));
const insertMock = vi.fn(() => ({ select: selectMock }));
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: 'user-1' },
        },
      }),
    },
    rpc: ((...args: any[]) => (rpcMock as any)(...args)) as any,
    from: ((...args: any[]) => (fromMock as any)(...args)) as any,
  },
}));

describe('createSeatCheckinSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'function gen_random_bytes(integer) does not exist' },
    });

    singleMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'column "duration_minutes" does not exist' },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'session-1',
          creator_token: 'server-token',
          created_at: '2026-05-13T00:00:00.000Z',
          status: 'active',
          scene_type: 'classroom',
          student_names: ['张三'],
        },
        error: null,
      });
  });

  it('falls back to creator_token-only insert before trying the broken rpc path', async () => {
    await createSeatCheckinSession({
      seatData: { rows: [] },
      studentNames: ['张三'],
      sceneConfig: { rows: 1, cols: 1 },
      sceneType: 'classroom',
      durationMinutes: 5,
      className: '高一(1)班',
    });

    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith('seat_checkin_sessions');

    expect(insertMock).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        creator_token: expect.any(String),
        duration_minutes: 5,
        class_name: '高一(1)班',
        scene_type: 'classroom',
        user_id: 'user-1',
      }),
    ]);

    expect(insertMock).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        creator_token: expect.any(String),
        scene_type: 'classroom',
        user_id: 'user-1',
      }),
    ]);
  });
});