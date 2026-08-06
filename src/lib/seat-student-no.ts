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

/** Extract the student number from a display name, or null when absent. */
export function extractStudentNo(name: string): number | null {
  const text = toHalfWidth(String(name ?? '')).trim();
  if (!text) return null;

  // Leading number: "01 张三", "2026001-张三", "12.张三"
  const leading = text.match(/^(\d{1,12})\s*[\s.、,，\-_:：()（）]/);
  if (leading) return Number(leading[1]);

  // Whole token is a number
  if (/^\d{1,12}$/.test(text)) return Number(text);

  // Trailing / bracketed number: "张三(2026001)", "张三 12", "张三-07"
  const trailing = text.match(/[\s\-_()（）[\]#:：]\s*(\d{1,12})\s*[)）\]]?$/);
  if (trailing) return Number(trailing[1]);

  return null;
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
