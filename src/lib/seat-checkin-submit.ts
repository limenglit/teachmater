/** 座位签到提交与外来人员排座：点击签到时才下载，缩小首屏。 */
import { studentSupabase as supabase } from '@/lib/student-supabase';
import { buildSeatHint, normalizeStudentName } from '@/lib/seat-hint';

export const hasExistingSeatCheckinRecord = async (sessionId: string, studentName: string) => {
  const { data, error } = await supabase.rpc('has_seat_checkin_record', {
    p_session_id: sessionId,
    p_student_name: studentName,
  } as any);
  if (error) throw error;
  return data === true;
};

export const submitSeatCheckinRecord = async (
  sessionId: string,
  studentName: string,
  otp?: string,
  extra?: { org?: string; phone?: string; extra?: Record<string, string> },
) => {
  const { data, error } = await (supabase.rpc as any)('submit_seat_checkin_record', {
    p_session_id: sessionId,
    p_student_name: studentName,
    ...(otp ? { p_otp: otp } : {}),
    ...(extra?.org ? { p_org: extra.org } : {}),
    ...(extra?.phone ? { p_phone: extra.phone } : {}),
    ...(extra?.extra && Object.keys(extra.extra).length > 0 ? { p_extra: extra.extra } : {}),
  } as any);
  if (error) {
    if (/INVALID_OTP/i.test(error.message || '')) throw new Error('INVALID_OTP');
    throw error;
  }
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error('NO_RECORD_CREATED');
  }
  return Array.isArray(data) ? data[0] : data;
};

const isSeatEmptyValue = (value: unknown) => value === null || value === '';

const countEmptySeatSlots = (node: unknown): number => {
  if (Array.isArray(node)) {
    return node.reduce((sum: number, item) => sum + countEmptySeatSlots(item), 0 as number);
  }
  if (node && typeof node === 'object') {
    return (Object.values(node as Record<string, unknown>) as unknown[]).reduce<number>((sum, value) => sum + countEmptySeatSlots(value), 0);
  }
  return isSeatEmptyValue(node) ? 1 : 0;
};

/**
 * Build classroom guest seat priority: front rows first, center columns first,
 * skipping disabled seats and seats already taken.
 */
const buildClassroomGuestSlots = (
  grid: (string | null)[][],
  disabledKeys: Set<string>
): Array<{ r: number; c: number }> => {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0]?.length ?? 0;
  const centerC = (cols - 1) / 2;
  const slots: Array<{ r: number; c: number; score: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (disabledKeys.has(`${r}-${c}`)) continue;
      if (!isSeatEmptyValue(grid[r][c])) continue;
      // Lower score = higher priority. Front row first (heavy), then center.
      const score = r * 100 + Math.abs(c - centerC);
      slots.push({ r, c, score });
    }
  }
  slots.sort((a, b) => a.score - b.score);
  return slots.map(({ r, c }) => ({ r, c }));
};

const cloneSeatDataWithGuestAssignments = (
  seatData: unknown,
  guestNames: string[],
  options: { sceneType?: string; disabledSeats?: string[] } = {}
) => {
  if (guestNames.length === 0) return seatData;

  // Classroom: smart front-center placement that respects disabled seats.
  if (options.sceneType === 'classroom' && Array.isArray(seatData)) {
    const grid = (seatData as (string | null)[][]).map(row => [...row]);
    const disabledKeys = new Set(options.disabledSeats || []);
    const slots = buildClassroomGuestSlots(grid, disabledKeys);
    for (let i = 0; i < guestNames.length && i < slots.length; i++) {
      const { r, c } = slots[i];
      grid[r][c] = guestNames[i];
    }
    return grid;
  }

  // Other scenes: sequential fill of empty slots (preserve existing behavior).
  let cursor = 0;
  const assign = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map(item => assign(item));
    }
    if (node && typeof node === 'object') {
      const next: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        next[key] = assign(value);
      }
      return next;
    }
    if (isSeatEmptyValue(node) && cursor < guestNames.length) {
      const assigned = guestNames[cursor];
      cursor += 1;
      return assigned;
    }
    return node;
  };
  return assign(seatData);
};

export const resolveSeatDataForName = async (sessionId: string, sessionData: {
  seat_data: unknown;
  student_names: string[];
  scene_type: string;
  scene_config?: Record<string, unknown>;
}, targetName: string, includeCurrentAsGuest: boolean) => {
  const normalized = normalizeStudentName(targetName);
  const registeredSet = new Set(sessionData.student_names.map(normalizeStudentName).filter(Boolean));
  const isRegistered = registeredSet.has(normalized);

  if (isRegistered) {
    return {
      seatData: sessionData.seat_data,
      guestAssigned: false,
      hint: buildSeatHint(sessionData.scene_type, sessionData.seat_data, normalized, sessionData.scene_config),
    };
  }

  const { data, error } = await supabase.rpc('get_seat_checkin_guest_records', {
    p_session_id: sessionId,
  } as any);

  if (error) throw error;

  const guestNames: string[] = [];
  const seen = new Set<string>();
  for (const row of (data || []) as Array<{ student_name: string }>) {
    const studentName = normalizeStudentName(row.student_name);
    if (!studentName || registeredSet.has(studentName) || seen.has(studentName)) continue;
    seen.add(studentName);
    guestNames.push(studentName);
  }

  if (includeCurrentAsGuest && !seen.has(normalized)) {
    guestNames.push(normalized);
    seen.add(normalized);
  }

  const disabledSeats = Array.isArray(sessionData.scene_config?.disabledSeats)
    ? (sessionData.scene_config!.disabledSeats as string[])
    : [];

  // For classroom, capacity excludes disabled seats.
  let capacity = countEmptySeatSlots(sessionData.seat_data);
  if (sessionData.scene_type === 'classroom' && Array.isArray(sessionData.seat_data)) {
    const disabledKeys = new Set(disabledSeats);
    const grid = sessionData.seat_data as (string | null)[][];
    capacity = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (disabledKeys.has(`${r}-${c}`)) continue;
        if (isSeatEmptyValue(grid[r][c])) capacity += 1;
      }
    }
  }
  if (includeCurrentAsGuest && guestNames.length > capacity) {
    throw new Error('NO_SEAT_FOR_GUEST');
  }

  const assignedSeatData = cloneSeatDataWithGuestAssignments(sessionData.seat_data, guestNames, {
    sceneType: sessionData.scene_type,
    disabledSeats,
  });
  const hint = buildSeatHint(sessionData.scene_type, assignedSeatData, normalized, sessionData.scene_config);
  return { seatData: assignedSeatData, guestAssigned: true, hint };
};
