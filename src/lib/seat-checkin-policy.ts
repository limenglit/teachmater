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
  // Only strings that are (a) array elements, or (b) values of a `name`-typed
  // key in an object, are treated as seat occupants. Other object string
  // properties (e.g. `id: 't1'`, `label: 'Row 1'`) must not inflate the count.
  const NAME_KEYS = new Set(['name', 'student', 'studentName', 'occupant']);
  type Frame = { value: unknown; fromArray: boolean; key?: string };
  const stack: Frame[] = [{ value: seatData, fromArray: true }];
  while (stack.length > 0) {
    const { value, fromArray, key } = stack.pop()!;
    if (typeof value === 'string') {
      if (fromArray || (key && NAME_KEYS.has(key))) {
        if (normalize(value)) assigned++;
      }
      continue;
    }
    if (value && typeof value === 'object') {
      if (seen.has(value as object)) continue;
      seen.add(value as object);
      if (Array.isArray(value)) {
        for (const item of value) stack.push({ value: item, fromArray: true });
        continue;
      }
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        stack.push({ value: v, fromArray: false, key: k });
      }
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

export interface SeatCheckinCoverage {
  /** Number of occupied seats (may exceed unique names when names repeat). */
  assignedCount: number;
  /** Roster size used for the check-in session (before name de-duplication). */
  rosterCount: number;
  /** Unique names actually sent to the check-in session. */
  uniqueCount: number;
  /** Roster names that hold no seat — these break indoor navigation. */
  unseatedNames: string[];
  /** Names that appear more than once in the roster (check-in cannot tell them apart). */
  duplicateNames: string[];
}

const collectSeatStrings = (seatData: unknown): string[] => {
  const out: string[] = [];
  const seen = new WeakSet<object>();
  const NAME_KEYS = new Set(['name', 'student', 'studentName', 'occupant']);
  type Frame = { value: unknown; fromArray: boolean; key?: string };
  const stack: Frame[] = [{ value: seatData, fromArray: true }];
  while (stack.length > 0) {
    const { value, fromArray, key } = stack.pop()!;
    if (typeof value === 'string') {
      if (fromArray || (key && NAME_KEYS.has(key))) {
        const n = normalize(value);
        if (n) out.push(n);
      }
      continue;
    }
    if (value && typeof value === 'object') {
      if (seen.has(value as object)) continue;
      seen.add(value as object);
      if (Array.isArray(value)) {
        for (const item of value) stack.push({ value: item, fromArray: true });
        continue;
      }
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        stack.push({ value: v, fromArray: false, key: k });
      }
    }
  }
  return out;
};

/**
 * Explains the gap teachers see between "roster size", "occupied seats" and the
 * number of people a check-in session can track: unseated students break indoor
 * navigation, duplicate names collapse into a single check-in entry.
 */
export const analyzeSeatCheckinCoverage = (
  seatData: unknown,
  studentNames: string[],
): SeatCheckinCoverage => {
  const roster = studentNames.map(normalize).filter(Boolean);
  const seated = new Set(collectSeatStrings(seatData));

  const counts = new Map<string, number>();
  for (const name of roster) counts.set(name, (counts.get(name) || 0) + 1);

  const unseatedNames: string[] = [];
  const duplicateNames: string[] = [];
  for (const [name, count] of counts) {
    if (!seated.has(name)) unseatedNames.push(name);
    if (count > 1) duplicateNames.push(name);
  }

  return {
    assignedCount: collectSeatStrings(seatData).length,
    rosterCount: roster.length,
    uniqueCount: counts.size,
    unseatedNames,
    duplicateNames,
  };
};


