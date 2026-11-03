// Pure helpers for the student "扫码查座位" page and its share payload.
import { normalizeLookupName } from './team-lookup';

export interface SeatLookupEntry { name: string; label: string; r: number; c: number }
export interface SeatLookupPayload {
  kind: 'seats';
  rows: number;
  cols: number;
  doorOnRight: boolean;
  colAisles: number[];
  rowAisles: number[];
  /** Seat names by [row][col]; '' = empty seat. */
  cells: string[][];
  /** "r-c" keys of closed seats. */
  closed: string[];
  entries: SeatLookupEntry[];
  /** Optional groups/teams so students also see their group. */
  groups?: SeatLookupGroup[];
  groupKind?: 'group' | 'team';
}

export function buildSeatLookupPayload(opts: {
  seats: (string | null)[][];
  disabledSeats: Iterable<string>;
  doorOnRight: boolean;
  colAisles?: number[];
  rowAisles?: number[];
  labels: { name: string; label?: string }[];
}): SeatLookupPayload {
  const closed = Array.from(opts.disabledSeats);
  const closedSet = new Set(closed);
  const rows = opts.seats.length;
  const cols = opts.seats.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);
  const labelByName = new Map(opts.labels.map(l => [l.name, l.label || '']));
  const entries: SeatLookupEntry[] = [];
  const cells = opts.seats.map((row, r) => Array.from({ length: cols }, (_, c) => {
    const name = row?.[c];
    if (!name || closedSet.has(`${r}-${c}`)) return '';
    entries.push({ name, r, c, label: labelByName.get(name) || `第${r + 1}行第${c + 1}列` });
    return name;
  }));
  return { kind: 'seats', rows, cols, doorOnRight: opts.doorOnRight, colAisles: opts.colAisles || [], rowAisles: opts.rowAisles || [], cells, closed, entries };
}

/** The seat for a typed/picked name, ignoring stray spaces. */
export function findSeatByName(payload: Pick<SeatLookupPayload, 'entries'> | null, name: string): SeatLookupEntry | null {
  const key = normalizeLookupName(name);
  if (!key || !payload) return null;
  return payload.entries.find(e => normalizeLookupName(e.name) === key) || null;
}

/** Share title, e.g. "智能科学与技术1班 · 座位表 · 2026/11/2". */
export function buildSeatShareTitle(classLabel: string, date: string): string {
  const label = (classLabel || '').trim();
  return `${label ? `${label} · ` : ''}座位表 · ${date}`;
}

export interface SeatLookupGroup { name: string; leader: string; members: string[] }

/** Keep only groups/teams whose members are seated, so another class's groups never leak in. */
export function buildSeatLookupGroups(
  buckets: { name: string; members: { name: string; leader?: boolean }[] }[],
  seatedNames: Iterable<string>,
): SeatLookupGroup[] {
  const seated = new Set(seatedNames);
  const out = buckets
    .map(b => {
      const members = b.members.map(m => m.name).filter(n => seated.has(n));
      const leader = b.members.find(m => m.leader && seated.has(m.name))?.name || '';
      return { name: b.name, leader, members };
    })
    .filter(g => g.members.length > 0);
  const covered = out.reduce((s, g) => s + g.members.length, 0);
  const total = buckets.reduce((s, b) => s + b.members.length, 0);
  return total > 0 && covered * 2 >= total ? out : [];
}

export function findGroupByName(groups: SeatLookupGroup[] | undefined, name: string): SeatLookupGroup | null {
  const key = normalizeLookupName(name);
  if (!key || !groups) return null;
  return groups.find(g => g.members.some(m => normalizeLookupName(m) === key)) || null;
}
