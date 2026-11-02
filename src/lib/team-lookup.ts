// Pure helpers for the student "扫码查组 / 查队" page and its share QR title.

export interface LookupMember { id?: string; name: string }
export interface LookupTeam { id?: string; name: string; members: LookupMember[] }

/** Normalise a typed or stored name: trim and drop inner spaces (full- and half-width). */
export const normalizeLookupName = (name: string): string =>
  (name || '').replace(/[\s\u3000]+/g, '');

const collator = (() => {
  try { return new Intl.Collator('zh-Hans-CN-u-co-pinyin', { numeric: true }); }
  catch { return null; }
})();

/** Every member name across all groups/teams, de-duplicated and sorted by pinyin. */
export function buildNamePool(teams: LookupTeam[]): string[] {
  const seen = new Map<string, string>();
  for (const t of teams || []) {
    for (const m of t?.members || []) {
      const raw = (m?.name || '').trim();
      const key = normalizeLookupName(raw);
      if (key && !seen.has(key)) seen.set(key, raw);
    }
  }
  const names = Array.from(seen.values());
  return names.sort((a, b) => (collator ? collator.compare(a, b) : a.localeCompare(b)));
}

/**
 * Candidates for the typed text: names starting with it come first, then names
 * containing it. Empty input returns the whole pool so students can just pick.
 */
export function suggestNames(pool: string[], query: string, limit = 50): string[] {
  const q = normalizeLookupName(query).toLowerCase();
  if (!q) return pool.slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of pool) {
    const n = normalizeLookupName(name).toLowerCase();
    if (n.startsWith(q)) starts.push(name);
    else if (n.includes(q)) contains.push(name);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** The group/team containing this student, ignoring stray spaces. */
export function findTeamByName<T extends LookupTeam>(teams: T[], name: string): T | null {
  const key = normalizeLookupName(name);
  if (!key) return null;
  return (teams || []).find(t => (t.members || []).some(m => normalizeLookupName(m.name) === key)) || null;
}

/** Share title shown on the student page, e.g. "智能科学与技术1班 · 6个组 · 2026/11/2". */
export function buildTeamShareTitle(classLabel: string, count: number, type: 'teams' | 'groups', date: string): string {
  const unit = type === 'teams' ? '队' : '组';
  const label = (classLabel || '').trim();
  return `${label ? `${label} · ` : ''}${count}个${unit} · ${date}`;
}
