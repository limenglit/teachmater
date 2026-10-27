/**
 * Keep groups, teams and seat charts in step with the student roster.
 *
 * - Renames pass through silently (members are matched by student id, falling
 *   back to name when a re-import regenerated ids).
 * - Removed students are dropped; a group that lost its leader promotes its
 *   first remaining member.
 * - New students are never placed automatically: callers list them as
 *   "pending" and the teacher fills them in with one click or by dragging.
 * - When less than half of the existing members still match the roster the
 *   roster was most likely switched to another class, so nothing is touched.
 */

export interface RosterRef { id: string; name: string }
export interface SyncMember { id: string; name: string }
export interface SyncBucket<M extends SyncMember> { members: M[] }

export interface LeaderOps<M> {
  isLeader: (m: M) => boolean;
  makeLeader: (m: M) => M;
}

export interface BucketSyncResult<B> {
  buckets: B[];
  changed: boolean;
  /** Roster looks like a different class; buckets were left untouched. */
  mismatched: boolean;
  renamed: { from: string; to: string }[];
  removed: string[];
  promoted: string[];
}

export function syncBucketMembers<M extends SyncMember, B extends SyncBucket<M>>(
  buckets: B[],
  students: RosterRef[],
  leader: LeaderOps<M>,
): BucketSyncResult<B> {
  const unchanged: BucketSyncResult<B> = { buckets, changed: false, mismatched: false, renamed: [], removed: [], promoted: [] };
  const total = buckets.reduce((sum, b) => sum + b.members.length, 0);
  if (total === 0) return unchanged;

  const byId = new Map(students.map(s => [s.id, s]));
  const claimed = new Set<string>();
  // Pass 1: exact id matches (first occurrence wins).
  const resolved: (RosterRef | null)[][] = buckets.map(b => b.members.map(m => {
    const s = byId.get(m.id);
    if (s && !claimed.has(s.id)) { claimed.add(s.id); return s; }
    return null;
  }));
  // Pass 2: name fallback for members whose id disappeared (e.g. re-import).
  const namePool = new Map<string, RosterRef[]>();
  for (const s of students) {
    if (claimed.has(s.id)) continue;
    const list = namePool.get(s.name) ?? [];
    list.push(s);
    namePool.set(s.name, list);
  }
  buckets.forEach((b, bi) => b.members.forEach((m, mi) => {
    if (resolved[bi][mi]) return;
    const s = namePool.get(m.name)?.shift();
    if (s) { claimed.add(s.id); resolved[bi][mi] = s; }
  }));

  const matched = resolved.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  if (matched * 2 < total) return { ...unchanged, mismatched: true };

  const renamed: { from: string; to: string }[] = [];
  const removed: string[] = [];
  const promoted: string[] = [];
  let changed = false;

  const next = buckets.map((b, bi) => {
    let lostLeader = false;
    const members: M[] = [];
    b.members.forEach((m, mi) => {
      const s = resolved[bi][mi];
      if (!s) {
        removed.push(m.name);
        if (leader.isLeader(m)) lostLeader = true;
        changed = true;
        return;
      }
      if (s.name !== m.name) renamed.push({ from: m.name, to: s.name });
      if (s.name !== m.name || s.id !== m.id) {
        changed = true;
        members.push({ ...m, id: s.id, name: s.name });
      } else {
        members.push(m);
      }
    });
    if (lostLeader && members.length > 0 && !members.some(leader.isLeader)) {
      members[0] = leader.makeLeader(members[0]);
      promoted.push(members[0].name);
    }
    return members === b.members ? b : { ...b, members };
  });

  if (!changed) return unchanged;
  return { buckets: next, changed, mismatched: false, renamed, removed, promoted };
}

/** Roster students that are not in any bucket yet, in roster order. */
export function findUnassigned<S extends RosterRef>(buckets: SyncBucket<SyncMember>[], students: S[]): S[] {
  if (buckets.length === 0) return [];
  const ids = new Set<string>();
  buckets.forEach(b => b.members.forEach(m => ids.add(m.id)));
  return students.filter(s => !ids.has(s.id));
}

/** Add each new member to the currently smallest bucket (earliest on ties). */
export function fillSmallestBuckets<M, B extends { members: M[] }>(buckets: B[], newMembers: M[]): B[] {
  if (buckets.length === 0 || newMembers.length === 0) return buckets;
  const next = buckets.map(b => ({ ...b, members: [...b.members] }));
  for (const m of newMembers) {
    let target = 0;
    for (let i = 1; i < next.length; i++) {
      if (next[i].members.length < next[target].members.length) target = i;
    }
    next[target].members.push(m);
  }
  return next;
}

// ---------------------------------------------------------------- seats ----

export interface RosterDiff {
  mismatched: boolean;
  renamed: { from: string; to: string }[];
  removed: string[];
}

/** Id-based roster diff between the roster a seat chart was last synced with and the live one. */
export function diffRoster(prev: RosterRef[], next: RosterRef[]): RosterDiff {
  const empty: RosterDiff = { mismatched: false, renamed: [], removed: [] };
  if (prev.length === 0) return empty;
  const nextById = new Map(next.map(s => [s.id, s]));
  const matched = prev.filter(p => nextById.has(p.id)).length;
  if (matched * 2 < prev.length) return { ...empty, mismatched: true };
  const renamed: { from: string; to: string }[] = [];
  const removed: string[] = [];
  for (const p of prev) {
    const s = nextById.get(p.id);
    if (!s) removed.push(p.name);
    else if (s.name !== p.name) renamed.push({ from: p.name, to: s.name });
  }
  return { mismatched: false, renamed, removed };
}

/**
 * Apply a roster diff to a flat list of seated names (seat grid cells plus the
 * leave pool). Renames replace one occurrence each; a removed name is cleared
 * only while more people sit under it than the roster still holds.
 */
export function applyRosterDiffToNames(
  cells: (string | null)[],
  diff: RosterDiff,
  nextRoster: RosterRef[],
): { cells: (string | null)[]; changed: boolean; cleared: string[] } {
  if (diff.mismatched || (diff.renamed.length === 0 && diff.removed.length === 0)) {
    return { cells, changed: false, cleared: [] };
  }
  const out = [...cells];
  const touched = new Set<number>();
  let changed = false;
  for (const { from, to } of diff.renamed) {
    const idx = out.findIndex((n, i) => n === from && !touched.has(i));
    if (idx < 0) continue;
    out[idx] = to;
    touched.add(idx);
    changed = true;
  }
  const rosterCount = new Map<string, number>();
  nextRoster.forEach(s => rosterCount.set(s.name, (rosterCount.get(s.name) ?? 0) + 1));
  const cleared: string[] = [];
  for (const name of diff.removed) {
    const seated = out.filter(n => n === name).length;
    if (seated <= (rosterCount.get(name) ?? 0)) continue;
    const idx = out.lastIndexOf(name);
    if (idx < 0) continue;
    out[idx] = null;
    cleared.push(name);
    changed = true;
  }
  return { cells: out, changed, cleared };
}

/** Roster students without a seat (and not on leave). Duplicate names are counted. */
export function findUnseated<S extends RosterRef>(students: S[], seatedNames: (string | null | undefined)[]): S[] {
  const counts = new Map<string, number>();
  seatedNames.forEach(n => { if (n) counts.set(n, (counts.get(n) ?? 0) + 1); });
  return students.filter(s => {
    const c = counts.get(s.name) ?? 0;
    if (c > 0) { counts.set(s.name, c - 1); return false; }
    return true;
  });
}

/** Fill empty, available seats row by row (front first) following the column order. */
export function fillEmptySeats(
  grid: (string | null)[][],
  names: string[],
  isAvailable: (r: number, c: number) => boolean,
  colOrder: number[],
): { grid: (string | null)[][]; placed: number } {
  const next = grid.map(row => [...row]);
  let idx = 0;
  for (let r = 0; r < next.length && idx < names.length; r++) {
    for (const c of colOrder) {
      if (idx >= names.length) break;
      if (c < 0 || c >= next[r].length) continue;
      if (next[r][c] || !isAvailable(r, c)) continue;
      next[r][c] = names[idx++];
    }
  }
  return { grid: next, placed: idx };
}

/** Short Chinese summary for a sync toast, e.g. "改名 1 人，移除 2 人（张三、李四）". */
export function describeRosterSync(renamed: number, removed: string[], extra?: string): string {
  const parts: string[] = [];
  if (renamed > 0) parts.push(`改名 ${renamed} 人`);
  if (removed.length > 0) {
    const shown = removed.slice(0, 3).join('、') + (removed.length > 3 ? ' 等' : '');
    parts.push(`移除 ${removed.length} 人（${shown}）`);
  }
  if (extra) parts.push(extra);
  return parts.join('，');
}
