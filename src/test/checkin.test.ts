import { describe, it, expect, vi } from 'vitest';
import { processCheckinPayload } from '@/components/CheckInPanel';
import { supabase } from '@/integrations/supabase/client';

// Helper to create a dummy payload
function makePayload(eventType: 'INSERT' | 'UPDATE', rec: any) {
  return { eventType, new: rec };
}

describe('processCheckinPayload', () => {
  beforeEach(() => {
    // reset mocks
    vi.resetAllMocks();
  });

  it('adds new matched record and does not call update', async () => {
    const students = [{ name: 'Alice' }];
    const records: any[] = [];
    const addStudent = vi.fn();

    const payload = makePayload('INSERT', {
      id: 'r1',
      student_name: 'Alice',
      checked_in_at: new Date().toISOString(),
      status: 'pending',
    });

    // stub supabase chain; eqMock records calls
    const eqMock = vi.fn().mockReturnValue({ update: vi.fn().mockResolvedValue({ error: null }) });
    const fromMock = vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqMock }) });
    vi.spyOn(supabase, 'from').mockImplementation(fromMock as any);

    await processCheckinPayload(payload, students, addStudent, (fn) => {
      records.push(...fn(records));
    });

    // record should be added with status 'matched'
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('matched');
    // since status changed from pending → matched, we expect the query builder's
    // eq method to be invoked once
    expect(eqMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith('id', 'r1');
    expect(addStudent).not.toHaveBeenCalled();
  });

  it('adds unknown record and updates status via supabase', async () => {
    const students = [{ name: 'Bob' }];
    const records: any[] = [];
    const addStudent = vi.fn();

    const payload = makePayload('INSERT', {
      id: 'r2',
      student_name: 'Charlie',
      checked_in_at: new Date().toISOString(),
      status: 'pending',
    });

    // stub supabase chain and track update call separately
    const updateMock = vi.fn().mockResolvedValue({ error: null });
    const eqMock = vi.fn().mockReturnValue({ update: updateMock });
    const fromMock = vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqMock }) });
    vi.spyOn(supabase, 'from').mockImplementation(fromMock as any);

    await processCheckinPayload(payload, students, addStudent, (fn) => {
      records.push(...fn(records));
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('unknown');
    expect(eqMock).toHaveBeenCalledWith('id', 'r2');
    // name should be added to student list
    expect(addStudent).toHaveBeenCalledWith('Charlie');
  });

  it('updates an existing record on UPDATE event', async () => {
    const students = [{ name: 'Alice' }];
    const records = [{ id: 'r1', student_name: 'Alice', status: 'matched' }];
    const addStudent = vi.fn();

    const payload = makePayload('UPDATE', {
      id: 'r1',
      student_name: 'Alice',
      status: 'matched',
      checked_in_at: new Date().toISOString(),
    });

    await processCheckinPayload(payload, students, addStudent, (fn) => {
      const result = fn(records);
      records.splice(0, records.length, ...result);
    });

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('r1');
    expect(addStudent).not.toHaveBeenCalled();
  });
});
