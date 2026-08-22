/**
 * Classroom seat numbering (排/号).
 *
 * Within a row the middle *open* seat is No.1. Going left from it the numbers
 * are even (2, 4, 6, ...), going right they are odd (3, 5, 7, ...).
 * Closed (disabled) seats are skipped entirely and never get a number.
 */

export interface ClassroomSeatNumberOptions {
  /** number of seat cells in this row */
  rowWidth: number;
  /** disabled seat keys, format `${row}-${col}` */
  disabledSeats?: Iterable<string>;
}

/** Ordered list of open column indexes for a row */
export function openColsInRow(row: number, opts: ClassroomSeatNumberOptions): number[] {
  const disabled = opts.disabledSeats instanceof Set
    ? (opts.disabledSeats as Set<string>)
    : new Set(opts.disabledSeats ? Array.from(opts.disabledSeats) : []);
  const cols: number[] = [];
  for (let c = 0; c < opts.rowWidth; c++) {
    if (disabled.has(`${row}-${c}`)) continue;
    cols.push(c);
  }
  return cols;
}

/**
 * Seat number for (row, col). Returns null when the seat is closed / invalid.
 */
export function classroomSeatNumber(
  row: number,
  col: number,
  opts: ClassroomSeatNumberOptions,
): number | null {
  const cols = openColsInRow(row, opts);
  const idx = cols.indexOf(col);
  if (idx < 0) return null;
  const center = Math.floor((cols.length - 1) / 2);
  if (idx === center) return 1;
  if (idx < center) return (center - idx) * 2;      // left side: 2, 4, 6...
  return (idx - center) * 2 + 1;                     // right side: 3, 5, 7...
}
