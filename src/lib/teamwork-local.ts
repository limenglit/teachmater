export interface PersistedGroupMember {
  id: string;
  name: string;
  isLeader?: boolean;
}

export interface PersistedGroup {
  id: string;
  name: string;
  members: PersistedGroupMember[];
}

export interface SmartClassroomSnapshot {
  seatsPerTable: number;
  tableCount: number;
  tableCols: number;
  tableRows: number;
  groupCount: number;
  mode: 'tableRoundRobin' | 'tableGrouped' | 'verticalS' | 'horizontalS';
  tableGap: number;
  assignment: string[][];
  closedSeats: string[];
  reservedTables?: number[];
  updatedAt: string;
}

const GROUPS_KEY = 'teachmate_groups_last';
const SMART_CLASSROOM_KEY = 'teachmate_smart_classroom_last';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadLastGroups(): PersistedGroup[] {
  const parsed = safeParse<PersistedGroup[]>(localStorage.getItem(GROUPS_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(group => group && typeof group.name === 'string' && Array.isArray(group.members))
    .map((group, gi) => ({
      id: typeof group.id === 'string' ? group.id : `g_${gi}`,
      name: group.name,
      members: group.members
        .filter(member => member && typeof member.name === 'string' && typeof member.id === 'string')
        .map(member => ({ id: member.id, name: member.name, isLeader: !!member.isLeader })),
    }))
    .filter(group => group.members.length > 0);
}

export function saveLastGroups(groups: PersistedGroup[]) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

export function loadSmartClassroomSnapshot(): SmartClassroomSnapshot | null {
  const parsed = safeParse<SmartClassroomSnapshot>(localStorage.getItem(SMART_CLASSROOM_KEY));
  if (!parsed) return null;
  if (!Array.isArray(parsed.assignment)) return null;
  return parsed;
}

export function saveSmartClassroomSnapshot(snapshot: SmartClassroomSnapshot) {
  localStorage.setItem(SMART_CLASSROOM_KEY, JSON.stringify(snapshot));
}

export function groupsFromSeatAssignment(
  assignment: string[][],
  existingNames: string[] = []
): PersistedGroup[] {
  return assignment
    .map((tableMembers, tableIndex) => {
      const nonEmptyNames = tableMembers.filter(name => !!name && name.trim().length > 0);
      if (nonEmptyNames.length === 0) return null;
      const defaultName = `第${tableIndex + 1}组`;
      return {
        id: `g_${tableIndex}`,
        name: existingNames[tableIndex] || defaultName,
        members: nonEmptyNames.map((name, memberIndex) => ({
          id: `seat_${tableIndex}_${memberIndex}_${name}`,
          name,
          isLeader: false,
        })),
      } as PersistedGroup;
    })
    .filter((group): group is PersistedGroup => !!group);
}
