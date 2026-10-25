import { formatClassroomSeatLabel } from './seat-number';

export interface SeatIndexEntry {
  name: string;
  studentNumber?: string;
  row: number;
  col: number;
  /** Seat text shown in the index; defaults to 第{row}排{col}座. */
  label?: string;
}

export const seatIndexLabel = (e: SeatIndexEntry) => e.label ?? `第${e.row}排${e.col}座`;

/**
 * Table rooms (智慧教室, 宴会厅): the chart prints only the table name and
 * each student's name on a seat, so the index points to the table.
 */
export function buildTableSeatIndex(
  tables: string[][],
  closedSeats: Iterable<string>,
  tableLabel: (tableIndex: number) => string,
): SeatIndexEntry[] {
  const closed = new Set(closedSeats);
  const out: SeatIndexEntry[] = [];
  tables.forEach((people, t) => {
    (people ?? []).forEach((raw, s) => {
      const name = (raw || '').trim();
      if (!name || closed.has(`${t}-${s}`)) return;
      out.push({ name, row: t + 1, col: s + 1, label: tableLabel(t) });
    });
  });
  return out;
}

/**
 * Computer lab: rows numbered from the front board (第1排 is printed on the
 * chart's table bar), seats counted left to right along each side.
 */
export function buildLabSeatIndex(
  groups: { rowIndex: number; side: 'top' | 'bottom'; students?: string[] }[],
  closedSeats: Iterable<string>,
  opts: { seatsPerRow: number; showTop: boolean; showBottom: boolean },
): SeatIndexEntry[] {
  const closed = new Set(closedSeats);
  const dual = opts.showTop && opts.showBottom;
  const out: SeatIndexEntry[] = [];
  for (const g of groups) {
    if (g.side === 'top' ? !opts.showTop : !opts.showBottom) continue;
    (g.students ?? []).slice(0, opts.seatsPerRow).forEach((raw, c) => {
      const name = (raw || '').trim();
      if (!name || closed.has(`${g.rowIndex}-${g.side}-${c}`)) return;
      const side = dual ? (g.side === 'top' ? '上' : '下') : '';
      out.push({ name, row: g.rowIndex + 1, col: c + 1, label: `第${g.rowIndex + 1}排${side}${c + 1}号` });
    });
  }
  return out;
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
 * How an ordinary classroom's index phrases a seat:
 * - 'rowcol' (default): 第X行第Y列, matching the chart's 第N排 / 第N列 labels
 *   (closed seats and rows still count, door side = 第1列).
 * - 'rowno': 第X排第Y号, the same centre-out numbering students see after
 *   scanning the check-in QR code.
 */
export type ClassroomIndexLabelMode = 'rowcol' | 'rowno';

export const normalizeClassroomIndexLabelMode = (v: unknown): ClassroomIndexLabelMode =>
  v === 'rowno' ? 'rowno' : 'rowcol';

export const CLASSROOM_INDEX_NOTES: Record<ClassroomIndexLabelMode, string> = {
  rowcol: '第1行在讲台一侧，第1列在前门一侧',
  rowno: '每排正中为1号，向左双号、向右单号（与扫码签到一致）',
};

/** Build index entries from a classroom grid. */
export function buildClassroomSeatIndex(
  seats: (string | null)[][],
  disabledSeats: Iterable<string>,
  doorOnRight: boolean,
  numberByName?: Map<string, string | undefined>,
  mode: ClassroomIndexLabelMode = 'rowcol',
): SeatIndexEntry[] {
  const disabled = new Set(disabledSeats);
  const cols = seats.reduce((m, r) => Math.max(m, r.length), 0);
  const rowWidths = seats.map(r => r?.length ?? 0);
  const out: SeatIndexEntry[] = [];
  seats.forEach((rowArr, r) => {
    rowArr.forEach((name, c) => {
      if (!name || disabled.has(`${r}-${c}`)) return;
      const row = r + 1;
      const col = doorOnRight ? cols - c : c + 1;
      const label = mode === 'rowno'
        ? formatClassroomSeatLabel(r, c, { rowWidth: rowArr.length, disabledSeats: disabled, rowWidths, doorOnRight }, 'no')
        : `第${row}行第${col}列`;
      out.push({ name, studentNumber: numberByName?.get(name), row, col, label });
    });
  });
  return out;
}

/**
 * Fixed A4 index page geometry (CSS px at 96dpi). Every page maps 1:1 onto A4.
 * 30px rows leave clear space between names; 30 rows still fit above the footer.
 */
export const INDEX_PAGE = { width: 794, height: 1123, padX: 32, rowHeight: 30, rows: 30, columnGap: 20, seatWidth: 100, nameFont: 13 } as const;
/** Space between number, name and seat slots; keeps long names off the seat text. */
export const INDEX_CELL_GAP = 12;
/** Per-character spacing on index text; widths below include it. */
export const INDEX_LETTER_SPACING = 1;

export interface SeatIndexLayout {
  columns: 2 | 3;
  rowsPerPage: number;
  perPage: number;
  /** Width of the student-number slot; 0 when nobody has a number. */
  numberWidth: number;
  /** Max name characters that fit the name slot at the fixed font size. */
  nameChars: number;
  /** Width of the seat slot, sized to the longest seat text. */
  seatWidth: number;
}

/** Conservative width: CJK = 1em, others 0.62em, plus letter-spacing per char. */
export const indexTextWidth = (text: string, px: number) =>
  Array.from(text).reduce((w, ch) => w + (/[\u2e80-\uffef]/.test(ch) ? px : px * 0.62) + INDEX_LETTER_SPACING, 0);

/**
 * Pick a column count so number, name and seat each keep their own slot at a
 * fixed font size. Long student numbers or long seat text drop to 2 columns
 * instead of shrinking text or letting the slots overlap.
 */
export function planSeatIndexLayout(entries: SeatIndexEntry[]): SeatIndexLayout {
  const maxNum = entries.reduce((m, e) => Math.max(m, (e.studentNumber ?? '').trim().length), 0);
  const numberWidth = maxNum > 0 ? Math.ceil(maxNum * (12 * 0.62 + INDEX_LETTER_SPACING) + 6) : 0;
  const usable = INDEX_PAGE.width - INDEX_PAGE.padX * 2;
  const colWidth = (n: number) => (usable - INDEX_PAGE.columnGap * (n - 1)) / n;
  const seatWidth = Math.max(INDEX_PAGE.seatWidth, ...entries.map(e => Math.ceil(indexTextWidth(seatIndexLabel(e), 12.5) + 8)));
  const gaps = INDEX_CELL_GAP * (numberWidth > 0 ? 2 : 1);
  const nameSlot = (n: number) => colWidth(n) - numberWidth - seatWidth - gaps;
  const charW = INDEX_PAGE.nameFont + INDEX_LETTER_SPACING;
  const columns: 2 | 3 = nameSlot(3) >= charW * 4 ? 3 : 2;
  const nameChars = Math.max(2, Math.floor(nameSlot(columns) / charW));
  return { columns, rowsPerPage: INDEX_PAGE.rows, perPage: columns * INDEX_PAGE.rows, numberWidth, nameChars, seatWidth };
}

/** Truncate in JS: html2canvas does not render CSS text-overflow ellipsis. */
export function fitIndexName(name: string, maxChars: number): string {
  const chars = Array.from(name);
  return chars.length <= maxChars ? name : `${chars.slice(0, Math.max(1, maxChars - 1)).join('')}…`;
}

