const REQUIRE_SEAT_ASSIGNMENT_KEY = 'teachmate_require_seat_assignment_before_checkin_v1';
const SYSTEM_REQUIRE_SEAT_ASSIGNMENT_KEY = 'teachmate_system_require_seat_assignment_before_checkin_v1';

export const getRequireSeatAssignmentBeforeCheckin = () => {
  const systemRaw = localStorage.getItem(SYSTEM_REQUIRE_SEAT_ASSIGNMENT_KEY);
  if (systemRaw !== null) return systemRaw !== 'false';

  const raw = localStorage.getItem(REQUIRE_SEAT_ASSIGNMENT_KEY);
  if (raw === null) return true;
  return raw !== 'false';
};

export const setRequireSeatAssignmentBeforeCheckin = (required: boolean) => {
  localStorage.setItem(REQUIRE_SEAT_ASSIGNMENT_KEY, String(required));
};

export const setSystemRequireSeatAssignmentBeforeCheckin = (required: boolean) => {
  localStorage.setItem(SYSTEM_REQUIRE_SEAT_ASSIGNMENT_KEY, String(required));
};

const normalize = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

const collectAssignedNames = (seatData: unknown, knownNames: Set<string>) => {
  const assigned = new Set<string>();
  const stack: unknown[] = [seatData];

  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === 'string') {
      const maybeName = normalize(current);
      if (maybeName && knownNames.has(maybeName)) {
        assigned.add(maybeName);
      }
      continue;
    }

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }

    if (current && typeof current === 'object') {
      for (const value of Object.values(current as Record<string, unknown>)) {
        stack.push(value);
      }
    }
  }

  return assigned;
};

export const isSeatAssignmentComplete = (seatData: unknown, studentNames: string[]) => {
  const targetNames = studentNames.map(normalize).filter(Boolean);
  if (targetNames.length === 0) return false;

  const knownNameSet = new Set(targetNames);
  const assigned = collectAssignedNames(seatData, knownNameSet);

  return targetNames.every(name => assigned.has(name));
};

export interface SeatCheckinReadiness {
  ready: boolean;
  assignedCount: number;
  reason: string;
}

/**
 * Unified check-in readiness rule shared across classroom / smart classroom /
 * banquet hall / art studio scenes: a scene is ready to start check-in as long
 * as at least one seat is occupied. Returns a human-readable reason for UI use.
 */
export const evaluateSeatCheckinReadiness = (seatData: unknown): SeatCheckinReadiness => {
  let assigned = 0;
  const seen = new WeakSet<object>();
  const stack: unknown[] = [seatData];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (typeof cur === 'string') {
      if (normalize(cur)) assigned++;
      continue;
    }
    if (cur && typeof cur === 'object') {
      if (seen.has(cur as object)) continue;
      seen.add(cur as object);
      if (Array.isArray(cur)) { for (const item of cur) stack.push(item); continue; }
      for (const v of Object.values(cur as Record<string, unknown>)) stack.push(v);
    }
  }
  const ready = assigned > 0;
  return {
    ready,
    assignedCount: assigned,
    reason: ready
      ? `已排座 ${assigned} 人，可发起签到`
      : '尚未安排任何座位，暂不可发起签到',
  };
};

