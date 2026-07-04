/**
 * Seat alignment utilities for irregular (custom) venue layouts.
 *
 * A "segment" is a contiguous run of columns delimited by vertical (column)
 * aisles. For a maxCols-wide grid and colAisles=[1,4] (aisle after col 1 and
 * after col 4) segments are [0..2), [2..5), [5..maxCols). Each row can align
 * its currently-enabled seats within each segment independently:
 *   - left      → seats hug the segment's left wall / aisle
 *   - right     → seats hug the segment's right wall / aisle
 *   - center    → seats centered inside the segment
 *   - justify   → first & last seats hug both edges, others evenly spaced
 *
 * Alignment PRESERVES the number of enabled seats in each row-segment; it
 * only shifts their column positions and updates the disabled set to reflect
 * the newly-emptied cells.
 */

export type SeatAlignment = 'left' | 'right' | 'center' | 'justify';

export interface Segment { start: number; end: number }

/** Split [0..maxCols) into segments based on `colAisles` (aisle-after-column). */
export function computeSegments(colAisles: number[], maxCols: number): Segment[] {
  if (maxCols <= 0) return [];
  const sorted = Array.from(new Set(colAisles))
    .filter((a) => Number.isInteger(a) && a >= 0 && a < maxCols - 1)
    .sort((a, b) => a - b);
  const segs: Segment[] = [];
  let s = 0;
  for (const a of sorted) {
    segs.push({ start: s, end: a + 1 });
    s = a + 1;
  }
  segs.push({ start: s, end: maxCols });
  return segs;
}

/** Compute the target column positions for N seats within `width` slots. */
export function placementCols(
  segCols: number[],
  n: number,
  alignment: SeatAlignment,
): number[] {
  const width = segCols.length;
  if (n <= 0 || width <= 0) return [];
  if (n >= width) return segCols.slice(0, width);
  switch (alignment) {
    case 'left':
      return segCols.slice(0, n);
    case 'right':
      return segCols.slice(width - n);
    case 'center': {
      const offset = Math.floor((width - n) / 2);
      return segCols.slice(offset, offset + n);
    }
    case 'justify': {
      if (n === 1) return [segCols[Math.floor((width - 1) / 2)]];
      const out: number[] = [];
      const step = (width - 1) / (n - 1);
      for (let i = 0; i < n; i++) out.push(segCols[Math.round(i * step)]);
      // Guarantee uniqueness (Math.round collisions on small widths)
      const seen = new Set<number>();
      const unique: number[] = [];
      for (const c of out) if (!seen.has(c)) { seen.add(c); unique.push(c); }
      if (unique.length < n) {
        for (const c of segCols) if (unique.length < n && !seen.has(c)) { seen.add(c); unique.push(c); }
        unique.sort((a, b) => a - b);
      }
      return unique;
    }
  }
}

/**
 * Align one row across all its segments.
 * Returns new seats-row, and the delta to apply to the disabled set.
 * Names outside `rowLength` are ignored (irregular row shorter than maxCols).
 */
export function alignRow(opts: {
  r: number;
  rowLength: number;
  seatsRow: (string | null)[];
  disabled: Set<string>;
  segments: Segment[];
  /** Alignment per segment index. Missing entries default to 'left'. */
  segmentAlignments: (SeatAlignment | undefined)[];
}): {
  seatsRow: (string | null)[];
  disabledAdd: string[];
  disabledRemove: string[];
} {
  const { r, rowLength, seatsRow, disabled, segments, segmentAlignments } = opts;
  const next = [...seatsRow];
  const disabledAdd: string[] = [];
  const disabledRemove: string[] = [];
  const key = (c: number) => `${r}-${c}`;

  segments.forEach((seg, i) => {
    const alignment: SeatAlignment = segmentAlignments[i] ?? 'left';
    const segCols: number[] = [];
    for (let c = seg.start; c < Math.min(seg.end, rowLength); c++) segCols.push(c);
    if (segCols.length === 0) return;

    // Alignment repositions NAMED seats within the segment. Unnamed but
    // enabled cells are collapsed away (marked disabled) so the wall / aisle
    // side stays visually flush — that's the whole point of alignment.
    const namedCols = segCols.filter((c) => !disabled.has(key(c)) && !!seatsRow[c]);
    const names = namedCols.map((c) => seatsRow[c] as string);
    const n = names.length;

    const target = placementCols(segCols, n, alignment);
    const targetSet = new Set(target);

    // Clear the whole segment, then write names into target slots in order.
    for (const c of segCols) next[c] = null;
    target.forEach((c, idx) => { next[c] = activeNames[idx] ?? null; });

    // Update disabled deltas: target cols must be enabled, others disabled.
    for (const c of segCols) {
      const k = key(c);
      if (targetSet.has(c)) {
        if (disabled.has(k)) disabledRemove.push(k);
      } else {
        if (!disabled.has(k)) disabledAdd.push(k);
      }
    }
  });

  return { seatsRow: next, disabledAdd, disabledRemove };
}
