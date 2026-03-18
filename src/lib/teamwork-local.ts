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

export interface SmartClassroomHistoryItem {
  id: string;
  name: string;
  createdAt: string;
  snapshot: SmartClassroomSnapshot;
}

export interface BanquetHallSnapshot {
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

export interface BanquetHallHistoryItem {
  id: string;
  name: string;
  createdAt: string;
  snapshot: BanquetHallSnapshot;
}

export interface ConferenceRoomAssignment {
  headLeft: string;
  headRight: string;
  mainTop: string[];
  mainBottom: string[];
  companionTop: string[][];
  companionBottom: string[][];
}

export interface ConferenceRoomSnapshot {
  seatsPerSide: number;
  groupCount: number;
  mode: 'balanced' | 'groupCluster' | 'verticalS' | 'horizontalS';
  seatGap: number;
  showCompanionSeats: boolean;
  companionRows: number;
  assignment: ConferenceRoomAssignment;
  closedSeats: string[];
  seated: boolean;
  updatedAt: string;
}

export interface ConferenceRoomHistoryItem {
  id: string;
  name: string;
  createdAt: string;
  snapshot: ConferenceRoomSnapshot;
}

const GROUPS_KEY = 'teachmate_groups_last';
const SMART_CLASSROOM_KEY = 'teachmate_smart_classroom_last';
const SMART_CLASSROOM_HISTORY_KEY = 'teachmate_smart_classroom_history';
const BANQUET_HALL_KEY = 'teachmate_banquet_hall_last';
const BANQUET_HALL_HISTORY_KEY = 'teachmate_banquet_hall_history';
const CONFERENCE_ROOM_KEY = 'teachmate_conference_room_last';
const CONFERENCE_ROOM_HISTORY_KEY = 'teachmate_conference_room_history';

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

export function loadSmartClassroomHistory(): SmartClassroomHistoryItem[] {
  const parsed = safeParse<SmartClassroomHistoryItem[]>(localStorage.getItem(SMART_CLASSROOM_HISTORY_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.snapshot)
    .slice(0, 50);
}

export function saveSmartClassroomHistory(name: string, snapshot: SmartClassroomSnapshot) {
  const current = loadSmartClassroomHistory();
  const now = new Date().toISOString();
  const item: SmartClassroomHistoryItem = {
    id: `smart_${Date.now()}`,
    name,
    createdAt: now,
    snapshot: { ...snapshot, updatedAt: now },
  };
  const next = [item, ...current].slice(0, 50);
  localStorage.setItem(SMART_CLASSROOM_HISTORY_KEY, JSON.stringify(next));
  return item;
}

export function loadBanquetHallSnapshot(): BanquetHallSnapshot | null {
  const parsed = safeParse<BanquetHallSnapshot>(localStorage.getItem(BANQUET_HALL_KEY));
  if (!parsed) return null;
  if (!Array.isArray(parsed.assignment)) return null;
  return parsed;
}

export function saveBanquetHallSnapshot(snapshot: BanquetHallSnapshot) {
  localStorage.setItem(BANQUET_HALL_KEY, JSON.stringify(snapshot));
}

export function loadBanquetHallHistory(): BanquetHallHistoryItem[] {
  const parsed = safeParse<BanquetHallHistoryItem[]>(localStorage.getItem(BANQUET_HALL_HISTORY_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.snapshot)
    .slice(0, 50);
}

export function saveBanquetHallHistory(name: string, snapshot: BanquetHallSnapshot) {
  const current = loadBanquetHallHistory();
  const now = new Date().toISOString();
  const item: BanquetHallHistoryItem = {
    id: `banquet_${Date.now()}`,
    name,
    createdAt: now,
    snapshot: { ...snapshot, updatedAt: now },
  };
  const next = [item, ...current].slice(0, 50);
  localStorage.setItem(BANQUET_HALL_HISTORY_KEY, JSON.stringify(next));
  return item;
}

export function loadConferenceRoomSnapshot(): ConferenceRoomSnapshot | null {
  const parsed = safeParse<ConferenceRoomSnapshot>(localStorage.getItem(CONFERENCE_ROOM_KEY));
  if (!parsed) return null;
  if (!parsed.assignment) return null;
  if (!Array.isArray(parsed.assignment.mainTop) || !Array.isArray(parsed.assignment.mainBottom)) return null;
  if (!Array.isArray(parsed.assignment.companionTop) || !Array.isArray(parsed.assignment.companionBottom)) return null;
  return parsed;
}

export function saveConferenceRoomSnapshot(snapshot: ConferenceRoomSnapshot) {
  localStorage.setItem(CONFERENCE_ROOM_KEY, JSON.stringify(snapshot));
}

export function loadConferenceRoomHistory(): ConferenceRoomHistoryItem[] {
  const parsed = safeParse<ConferenceRoomHistoryItem[]>(localStorage.getItem(CONFERENCE_ROOM_HISTORY_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.snapshot)
    .slice(0, 50);
}

export function saveConferenceRoomHistory(name: string, snapshot: ConferenceRoomSnapshot) {
  const current = loadConferenceRoomHistory();
  const now = new Date().toISOString();
  const item: ConferenceRoomHistoryItem = {
    id: `conference_${Date.now()}`,
    name,
    createdAt: now,
    snapshot: { ...snapshot, updatedAt: now },
  };
  const next = [item, ...current].slice(0, 50);
  localStorage.setItem(CONFERENCE_ROOM_HISTORY_KEY, JSON.stringify(next));
  return item;
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
