export interface SeatIndexEntry {
  name: string;
  studentNumber?: string;
  row: number;
  col: number;
}

/** Sort: by student number when every entry has one, else by pinyin. */
export function sortSeatIndex(entries: SeatIndexEntry[]): { sortBy: 'number' | 'pinyin'; entries: SeatIndexEntry[] } {
  const byNumber = entries.length > 0 && entries.every(e => (e.studentNumber ?? '').trim());
  const collator = new Intl.Collator('zh-Hans-CN-u-co-pinyin', { numeric: true });
  const sorted = [...entries].sort((a, b) =>
    byNumber
      ? collator.compare(a.studentNumber!.trim(), b.studentNumber!.trim()) || collator.compare(a.name, b.name)
      : collator.compare(a.name, b.name),
  );
  return { sortBy: byNumber ? 'number' : 'pinyin', entries: sorted };
}

/**
 * Build index entries from a classroom grid (第X排第Y座, door side = 第1座).
 * Numbering matches the exported chart's 第N排 / 第N列 labels exactly: closed
 * seats and closed rows still count, so the index never contradicts page 1.
 */
export function buildClassroomSeatIndex(
  seats: (string | null)[][],
  disabledSeats: Iterable<string>,
  doorOnRight: boolean,
  numberByName?: Map<string, string | undefined>,
): SeatIndexEntry[] {
  const disabled = new Set(disabledSeats);
  const cols = seats.reduce((m, r) => Math.max(m, r.length), 0);
  const out: SeatIndexEntry[] = [];
  seats.forEach((rowArr, r) => {
    rowArr.forEach((name, c) => {
      if (!name || disabled.has(`${r}-${c}`)) return;
      out.push({ name, studentNumber: numberByName?.get(name), row: r + 1, col: doorOnRight ? cols - c : c + 1 });
    });
  });
  return out;
}

/** Fixed A4 index page geometry (CSS px at 96dpi). Every page maps 1:1 onto A4. */
export const INDEX_PAGE = { width: 794, height: 1123, padX: 32, rowHeight: 24, rows: 38, columnGap: 20, seatWidth: 84, nameFont: 13 } as const;

export interface SeatIndexLayout {
  columns: 2 | 3;
  rowsPerPage: number;
  perPage: number;
  /** Width of the student-number slot; 0 when nobody has a number. */
  numberWidth: number;
  /** Max name characters that fit the name slot at the fixed font size. */
  nameChars: number;
}

/**
 * Pick a column count so number, name and seat each keep their own slot at a
 * fixed font size. Long student numbers drop to 2 columns instead of shrinking
 * text or letting the slots overlap.
 */
export function planSeatIndexLayout(entries: SeatIndexEntry[]): SeatIndexLayout {
  const maxNum = entries.reduce((m, e) => Math.max(m, (e.studentNumber ?? '').trim().length), 0);
  const numberWidth = maxNum > 0 ? Math.ceil(maxNum * 7.4 + 6) : 0;
  const usable = INDEX_PAGE.width - INDEX_PAGE.padX * 2;
  const colWidth = (n: number) => (usable - INDEX_PAGE.columnGap * (n - 1)) / n;
  const gaps = numberWidth > 0 ? 16 : 8;
  const nameSlot = (n: number) => colWidth(n) - numberWidth - INDEX_PAGE.seatWidth - gaps;
  const columns: 2 | 3 = nameSlot(3) >= INDEX_PAGE.nameFont * 4 ? 3 : 2;
  const nameChars = Math.max(2, Math.floor(nameSlot(columns) / INDEX_PAGE.nameFont));
  return { columns, rowsPerPage: INDEX_PAGE.rows, perPage: columns * INDEX_PAGE.rows, numberWidth, nameChars };
}

/** Truncate in JS: html2canvas does not render CSS text-overflow ellipsis. */
export function fitIndexName(name: string, maxChars: number): string {
  const chars = Array.from(name);
  return chars.length <= maxChars ? name : `${chars.slice(0, Math.max(1, maxChars - 1)).join('')}…`;
}

