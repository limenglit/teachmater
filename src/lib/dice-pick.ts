/**
 * Smart dice helpers: the dice pick a whole group/team (never a single student).
 * Pure functions so the selection rules can be unit-tested without the UI.
 */

export interface DiceBucket {
  /** Stable key used for the no-repeat pool. */
  key: string;
  /** 1-based position in the teacher's group/team list (what the dice show). */
  number: number;
  /** Display name saved by the group/team page. */
  name: string;
  memberCount: number;
}

const DEFAULT_NAME_RE = /^(第[一二三四五六七八九十百零〇\d]+[组队]|(group|team|группа|команда|grupo|equipo|그룹|팀)\s*\d+|(グループ|チーム)\s*\d+)$/i;

/** True when the name is just the automatic "第一组 / Group 1" style name. */
export function isDefaultBucketName(name: string): boolean {
  return DEFAULT_NAME_RE.test(name.trim());
}

/**
 * Builds the dice buckets from saved groups/teams, keeping only members still on
 * the roster. Groups that have no current student are dropped, but the remaining
 * ones keep their original number so "第3组" always means the third group.
 */
export function buildDiceBuckets(
  list: { id?: string; name: string; members: { id: string }[] }[],
  rosterIds: Set<string>,
): DiceBucket[] {
  return list
    .map((item, i) => ({
      key: item.id || `b_${i}`,
      number: i + 1,
      name: item.name,
      memberCount: item.members.filter(m => rosterIds.has(m.id)).length,
    }))
    .filter(b => b.memberCount > 0);
}

/**
 * Label shown/spoken for a bucket. `prefix` is the localized "第{0}组" pattern.
 * Default names are shown as-is; custom names keep the number in front.
 */
export function formatBucketLabel(bucket: DiceBucket, prefix: string): string {
  const numbered = prefix.replace('{0}', String(bucket.number));
  const name = bucket.name.trim();
  if (!name || isDefaultBucketName(name) || name === numbered) return name || numbered;
  return `${numbered}（${name}）`;
}

/** Text for speech: parentheses read awkwardly, so they become a pause. */
export function speechLabel(label: string): string {
  return label.replace(/（(.+)）$/, '，$1').replace(/\((.+)\)$/, ', $1');
}

/** Number of dice: 1 die for up to 6 groups, 2 dice (block × 6 + slot) up to 36. */
export function diceCountFor(totalBuckets: number): 1 | 2 {
  return totalBuckets > 6 ? 2 : 1;
}

/**
 * Dice faces that point at a bucket number.
 * 1 die: the face is the number. 2 dice: number = (first − 1) × 6 + second.
 */
export function facesForNumber(number: number, diceCount: 1 | 2): number[] {
  const n = Math.max(1, number);
  if (diceCount === 1) return [Math.min(6, n)];
  const block = Math.min(6, Math.floor((n - 1) / 6) + 1);
  const slot = ((n - 1) % 6) + 1;
  return [block, slot];
}

/** Uniformly picks one bucket from those not yet used (when no-repeat is on). */
export function pickBucket(
  buckets: DiceBucket[],
  usedKeys: Set<string>,
  noRepeat: boolean,
  random: () => number = Math.random,
): DiceBucket | null {
  const pool = noRepeat ? buckets.filter(b => !usedKeys.has(b.key)) : buckets;
  if (pool.length === 0) return null;
  const idx = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[idx];
}
