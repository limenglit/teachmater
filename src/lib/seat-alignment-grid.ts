import { placementCols, type SeatAlignment, type Segment } from './seat-alignment';

/**
 * Align the occupied seats in one row while keeping empty seats available.
 * Closed seats are excluded from both the source and target positions.
 */
export function alignGridRow(
  row: (string | null)[],
  segments: Segment[],
  alignment: SeatAlignment,
  disabled = new Set<number>(),
): (string | null)[] {
  const next = row.map(value => value || null);
  for (const segment of segments) {
    const available = [];
    for (let col = segment.start; col < Math.min(segment.end, row.length); col++) {
      if (!disabled.has(col)) available.push(col);
    }
    const names = available.map(col => row[col]).filter((name): name is string => !!name);
    const targets = placementCols(available, names.length, alignment);
    for (const col of available) next[col] = null;
    targets.forEach((col, index) => { next[col] = names[index] || null; });
  }
  return next;
}

export function alignGridRows(
  rows: (string | null)[][],
  segmentsForRow: (rowIndex: number) => Segment[],
  alignments: (rowIndex: number) => SeatAlignment,
  disabledForRow?: (rowIndex: number) => Set<number>,
): (string | null)[][] {
  return rows.map((row, rowIndex) => alignGridRow(
    row,
    segmentsForRow(rowIndex),
    alignments(rowIndex),
    disabledForRow?.(rowIndex),
  ));
}
