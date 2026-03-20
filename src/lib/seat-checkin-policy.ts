const REQUIRE_SEAT_ASSIGNMENT_KEY = 'teachmate_require_seat_assignment_before_checkin_v1';

export const getRequireSeatAssignmentBeforeCheckin = () => {
  const raw = localStorage.getItem(REQUIRE_SEAT_ASSIGNMENT_KEY);
  if (raw === null) return true;
  return raw !== 'false';
};

export const setRequireSeatAssignmentBeforeCheckin = (required: boolean) => {
  localStorage.setItem(REQUIRE_SEAT_ASSIGNMENT_KEY, String(required));
};

const normalize = (value: string) => value.trim();

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
