import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeatCheckinSession } from './seat-checkin-session';

const singleMock = vi.fn();
const selectMock = vi.fn(() => ({ single: singleMock }));
const insertMock = vi.fn(() => ({ select: selectMock }));
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args),
  },
}));

describe('createSeatCheckinSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    singleMock.mockResolvedValue({
      data: {
        id: 'session-1',
        creator_token: 'server-token',
        created_at: '2026-05-13T00:00:00.000Z',
        duration_minutes: 5,
        status: 'active',
        ended_at: null,
        scene_type: 'classroom',
        class_name: '高一(1)班',
        student_names: ['张三'],
      },
      error: null,
    });
  });

  it('sends creator_token in insert payload', async () => {
    await createSeatCheckinSession({
      seatData: { rows: [] },
      studentNames: ['张三'],
      sceneConfig: { rows: 1, cols: 1 },
      sceneType: 'classroom',
      durationMinutes: 5,
      className: '高一(1)班',
    });

    expect(fromMock).toHaveBeenCalledWith('seat_checkin_sessions');
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        creator_token: expect.any(String),
        scene_type: 'classroom',
      }),
    ]);
  });
});