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

export interface PersistedTeamMember {
  id: string;
  name: string;
  isCaptain?: boolean;
}

export interface PersistedTeam {
  id: string;
  name: string;
  members: PersistedTeamMember[];
}

export interface SmartClassroomSnapshot {
  seatsPerTable: number;
  tableCount: number;
  tableCols: number;
  tableRows: number;
  groupCount: number;
  mode: 'tableRoundRobin' | 'tableGrouped' | 'verticalS' | 'horizontalS' | 'orgTablePodium';
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
  mode: 'tableRoundRobin' | 'tableGrouped' | 'verticalS' | 'horizontalS' | 'orgTableStage';
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
  mode: 'balanced' | 'groupCluster' | 'verticalS' | 'horizontalS' | 'orgSideRankCenter';
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

export interface ClassroomSnapshot {
  rows: number;
  cols: number;
  mode: 'verticalS' | 'horizontalS' | 'groupCol' | 'groupRow' | 'smartCluster' | 'random' | 'exam';
  groupCount: number;
  groupSource?: 'auto' | 'groups' | 'teams' | 'count';
  disabledSeats: string[];
  examSkipRow: boolean;
  examSkipCol: boolean;
  startFrom: 'door' | 'window' | 'center';
  smartClusterStrategy?: 'classic' | 'orgFrontWeighted';
  windowOnLeft: boolean;
  colAisles: number[];
  rowAisles: number[];
  seats: (string | null)[][];
  updatedAt: string;
}

export interface ClassroomHistoryItem {
  id: string;
  name: string;
  createdAt: string;
  snapshot: ClassroomSnapshot;
}

export interface ComputerLabRowAssignment {
  rowIndex: number;
  side: 'top' | 'bottom';
  students: string[];
}

export interface ComputerLabRowTransform {
  x: number;
  y: number;
  rotation: number;
}

export interface ComputerLabSnapshot {
  rowCount: number;
  seatsPerSide: number;
  groupCount: number;
  mode: 'balanced' | 'groupRow' | 'verticalS' | 'horizontalS';
  dualSide: boolean;
  tableGap: number;
  assignment: ComputerLabRowAssignment[];
  closedSeats: string[];
  rowTransforms: ComputerLabRowTransform[];
  seated: boolean;
  updatedAt: string;
}

export interface ComputerLabHistoryItem {
  id: string;
  name: string;
  createdAt: string;
  snapshot: ComputerLabSnapshot;
}

export interface ConcertHallSnapshot {
  seatsPerRow: number;
  rowCount: number;
  groupCount: number;
  mode: 'arcBalanced' | 'groupZone' | 'verticalS' | 'horizontalS';
  genderSeatPolicy?: 'none' | 'alternate' | 'cluster' | 'alternateRows';
  genderFirst?: 'male' | 'female';
  centerRowsByGender?: boolean;
  assignment: string[][];
  closedSeats: string[];
  updatedAt: string;
}

export interface ConcertHallHistoryItem {
  id: string;
  name: string;
  createdAt: string;
  snapshot: ConcertHallSnapshot;
}

const GROUPS_KEY = 'teachmate_groups_last';
const TEAMS_KEY = 'teachmate_teams_last';
const SMART_CLASSROOM_KEY = 'teachmate_smart_classroom_last';
const SMART_CLASSROOM_HISTORY_KEY = 'teachmate_smart_classroom_history';
const BANQUET_HALL_KEY = 'teachmate_banquet_hall_last';
const BANQUET_HALL_HISTORY_KEY = 'teachmate_banquet_hall_history';
const CONFERENCE_ROOM_KEY = 'teachmate_conference_room_last';
const CONFERENCE_ROOM_HISTORY_KEY = 'teachmate_conference_room_history';
const CLASSROOM_KEY = 'teachmate_classroom_last';
const CLASSROOM_HISTORY_KEY = 'teachmate_classroom_history';
const COMPUTER_LAB_KEY = 'teachmate_computer_lab_last';
const COMPUTER_LAB_HISTORY_KEY = 'teachmate_computer_lab_history';
const CONCERT_HALL_KEY = 'teachmate_concert_hall_last';
const CONCERT_HALL_HISTORY_KEY = 'teachmate_concert_hall_history';

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

export function loadLastTeams(): PersistedTeam[] {
  const parsed = safeParse<PersistedTeam[]>(localStorage.getItem(TEAMS_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(team => team && typeof team.name === 'string' && Array.isArray(team.members))
    .map((team, ti) => ({
      id: typeof team.id === 'string' ? team.id : `t_${ti}`,
      name: team.name,
      members: team.members
        .filter(member => member && typeof member.name === 'string' && typeof member.id === 'string')
        .map(member => ({ id: member.id, name: member.name, isCaptain: !!member.isCaptain })),
    }))
    .filter(team => team.members.length > 0);
}

export function saveLastTeams(teams: PersistedTeam[]) {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
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

export function loadClassroomSnapshot(): ClassroomSnapshot | null {
  const parsed = safeParse<ClassroomSnapshot>(localStorage.getItem(CLASSROOM_KEY));
  if (!parsed) return null;
  if (!Array.isArray(parsed.seats)) return null;
  return parsed;
}

export function saveClassroomSnapshot(snapshot: ClassroomSnapshot) {
  localStorage.setItem(CLASSROOM_KEY, JSON.stringify(snapshot));
}

export function loadClassroomHistory(): ClassroomHistoryItem[] {
  const parsed = safeParse<ClassroomHistoryItem[]>(localStorage.getItem(CLASSROOM_HISTORY_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.snapshot)
    .slice(0, 50);
}

export function saveClassroomHistory(name: string, snapshot: ClassroomSnapshot) {
  const current = loadClassroomHistory();
  const now = new Date().toISOString();
  const item: ClassroomHistoryItem = {
    id: `classroom_${Date.now()}`,
    name,
    createdAt: now,
    snapshot: { ...snapshot, updatedAt: now },
  };
  const next = [item, ...current].slice(0, 50);
  localStorage.setItem(CLASSROOM_HISTORY_KEY, JSON.stringify(next));
  return item;
}

export function loadComputerLabSnapshot(): ComputerLabSnapshot | null {
  const parsed = safeParse<ComputerLabSnapshot>(localStorage.getItem(COMPUTER_LAB_KEY));
  if (!parsed) return null;
  if (!Array.isArray(parsed.assignment)) return null;
  if (!Array.isArray(parsed.rowTransforms)) return null;
  return parsed;
}

export function saveComputerLabSnapshot(snapshot: ComputerLabSnapshot) {
  localStorage.setItem(COMPUTER_LAB_KEY, JSON.stringify(snapshot));
}

export function loadComputerLabHistory(): ComputerLabHistoryItem[] {
  const parsed = safeParse<ComputerLabHistoryItem[]>(localStorage.getItem(COMPUTER_LAB_HISTORY_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.snapshot)
    .slice(0, 50);
}

export function saveComputerLabHistory(name: string, snapshot: ComputerLabSnapshot) {
  const current = loadComputerLabHistory();
  const now = new Date().toISOString();
  const item: ComputerLabHistoryItem = {
    id: `computer_lab_${Date.now()}`,
    name,
    createdAt: now,
    snapshot: { ...snapshot, updatedAt: now },
  };
  const next = [item, ...current].slice(0, 50);
  localStorage.setItem(COMPUTER_LAB_HISTORY_KEY, JSON.stringify(next));
  return item;
}

export function loadConcertHallSnapshot(): ConcertHallSnapshot | null {
  const parsed = safeParse<ConcertHallSnapshot>(localStorage.getItem(CONCERT_HALL_KEY));
  if (!parsed) return null;
  if (!Array.isArray(parsed.assignment)) return null;
  return parsed;
}

export function saveConcertHallSnapshot(snapshot: ConcertHallSnapshot) {
  localStorage.setItem(CONCERT_HALL_KEY, JSON.stringify(snapshot));
}

export function loadConcertHallHistory(): ConcertHallHistoryItem[] {
  const parsed = safeParse<ConcertHallHistoryItem[]>(localStorage.getItem(CONCERT_HALL_HISTORY_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.snapshot)
    .slice(0, 50);
}

export function saveConcertHallHistory(name: string, snapshot: ConcertHallSnapshot) {
  const current = loadConcertHallHistory();
  const now = new Date().toISOString();
  const item: ConcertHallHistoryItem = {
    id: `concert_${Date.now()}`,
    name,
    createdAt: now,
    snapshot: { ...snapshot, updatedAt: now },
  };
  const next = [item, ...current].slice(0, 50);
  localStorage.setItem(CONCERT_HALL_HISTORY_KEY, JSON.stringify(next));
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
