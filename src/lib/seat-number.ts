/**
 * Classroom seat numbering (排/号).
 *
 * The centre of the row is a *fixed column* (the geometric middle of the grid,
 * e.g. column 21 in a 41-wide grid) — not the middle of the open seats. That
 * column is No.1; going left the numbers are even (2, 4, 6, ...), going right
 * they are odd (3, 5, 7, ...). Closed (disabled) seats are skipped entirely
 * and never get a number, but they do not shift the centre.
 */

export interface ClassroomSeatNumberOptions {
  /** number of seat cells in this row */
  rowWidth: number;
  /** disabled seat keys, format `${row}-${col}` */
  disabledSeats?: Iterable<string>;
  /** fixed centre column index; defaults to the geometric middle of the row */
  anchorCol?: number;
  /**
   * Optional per-row widths of the whole grid (index = row). When provided,
   * 「第X排」counts only rows that still have at least one open seat, so fully
   * closed rows are skipped.
   */
  rowWidths?: number[];
}

const toSet = (v?: Iterable<string>) =>
  v instanceof Set ? (v as Set<string>) : new Set(v ? Array.from(v) : []);

/** Ordered list of open column indexes for a row */
export function openColsInRow(row: number, opts: ClassroomSeatNumberOptions): number[] {
  const disabled = toSet(opts.disabledSeats);
  const cols: number[] = [];
  for (let c = 0; c < opts.rowWidth; c++) {
    if (disabled.has(`${row}-${c}`)) continue;
    cols.push(c);
  }
  return cols;
}

/** The fixed centre column used for numbering */
export function anchorColOf(opts: ClassroomSeatNumberOptions): number {
  return Number.isInteger(opts.anchorCol) ? (opts.anchorCol as number) : Math.floor((opts.rowWidth - 1) / 2);
}

/**
 * Seat number for (row, col). Returns null when the seat is closed / invalid.
 */
export function classroomSeatNumber(
  row: number,
  col: number,
  opts: ClassroomSeatNumberOptions,
): number | null {
  const disabled = toSet(opts.disabledSeats);
  if (col < 0 || col >= opts.rowWidth) return null;
  if (disabled.has(`${row}-${col}`)) return null;

  const anchor = anchorColOf(opts);
  if (col === anchor) return 1;

  // rank among open seats on the same side of the anchor, counting outward
  let rank = 0;
  if (col < anchor) {
    for (let c = anchor - 1; c >= col; c--) {
      if (disabled.has(`${row}-${c}`)) continue;
      rank++;
    }
    return rank * 2; // left: 2, 4, 6...
  }
  for (let c = anchor + 1; c <= col; c++) {
    if (disabled.has(`${row}-${c}`)) continue;
    rank++;
  }
  return rank * 2 + 1; // right: 3, 5, 7...
}


/** How the student-facing seat position is phrased. */
export type SeatLabelMode = 'no' | 'col' | 'both';

export const normalizeSeatLabelMode = (value: unknown): SeatLabelMode =>
  value === 'col' || value === 'both' ? value : 'no';

/**
 * Student-facing label for a classroom seat, e.g. 「第3排第5号」/「第3排第7列」/
 * 「第3排第5号（第7列）」. The teacher picks the mode when publishing the QR code.
 */
export function formatClassroomSeatLabel(
  row: number,
  col: number,
  opts: ClassroomSeatNumberOptions,
  mode: SeatLabelMode = 'no',
): string {
  const no = classroomSeatNumber(row, col, opts) ?? col + 1;
  const rowText = `第${row + 1}排`;
  if (mode === 'col') return `${rowText}第${col + 1}列`;
  if (mode === 'both') return `${rowText}第${no}号（第${col + 1}列）`;
  return `${rowText}第${no}号`;
}
