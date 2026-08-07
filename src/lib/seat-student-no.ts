/**
 * Helpers for the "按学号顺序落座" (student-number order) seating rule.
 *
 * The roster store only keeps a display name, so the student number is parsed
 * from the name text itself. Supported shapes (all common in imported rosters):
 *   "01 张三" / "2026001-张三" / "张三(2026001)" / "张三 12" / "12.张三"
 * Students without a detectable number keep their original roster order and are
 * placed after all numbered students.
 */

const FULLWIDTH_DIGITS = /[\uFF10-\uFF19]/g;

const toHalfWidth = (value: string) =>
  value.replace(FULLWIDTH_DIGITS, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));

export type StudentNoSource = 'leading' | 'trailing' | 'whole' | 'none';

export interface StudentNoParse {
  name: string;
  no: number | null;
  source: StudentNoSource;
  /** The digits matched inside the name, for preview display. */
  matched: string | null;
}

/** Parse the student number out of a display name with provenance info. */
export function parseStudentNo(name: string): StudentNoParse {
  const raw = String(name ?? '');
  const text = toHalfWidth(raw).trim();
  if (!text) return { name: raw, no: null, source: 'none', matched: null };

  // Whole token is a number
  if (/^\d{1,12}$/.test(text)) return { name: raw, no: Number(text), source: 'whole', matched: text };

  // Leading number: "01 张三", "2026001-张三", "12.张三", "3张三"
  const leading = text.match(/^(\d{1,12})\s*[\s.、,，\-_:：()（）]?\s*\S/);
  if (leading) return { name: raw, no: Number(leading[1]), source: 'leading', matched: leading[1] };

  // Trailing / bracketed number: "张三(2026001)", "张三 12", "张三-07", "张三12"
  const trailing = text.match(/(\d{1,12})\s*[)）\]]?$/);
  if (trailing) return { name: raw, no: Number(trailing[1]), source: 'trailing', matched: trailing[1] };

  return { name: raw, no: null, source: 'none', matched: null };
}

/** Extract the student number from a display name, or null when absent. */
export function extractStudentNo(name: string): number | null {
  return parseStudentNo(name).no;
}

/**
 * Build a preview of how each name is parsed and where it lands in the seating
 * order (1-based). Names without a number keep roster order and go last.
 */
export function describeStudentNoOrder(names: string[]): Array<StudentNoParse & { order: number }> {
  const ordered = sortNamesByStudentNo(names);
  const rank = new Map<string, number>();
  ordered.forEach((n, i) => { if (!rank.has(n)) rank.set(n, i + 1); });
  return names.map(name => ({ ...parseStudentNo(name), order: rank.get(name) ?? 0 }));
}

/**
 * Sort names ascending by student number (stable). Names without a number keep
 * their relative roster order and are appended at the end.
 */
export function sortNamesByStudentNo(names: string[]): string[] {
  const numbered: { name: string; no: number; idx: number }[] = [];
  const rest: string[] = [];
  names.forEach((name, idx) => {
    const no = extractStudentNo(name);
    if (no === null) rest.push(name);
    else numbered.push({ name, no, idx });
  });
  numbered.sort((a, b) => (a.no - b.no) || (a.idx - b.idx));
  return [...numbered.map(n => n.name), ...rest];
}

