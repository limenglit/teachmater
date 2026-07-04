import { describe, it, expect } from 'vitest';
import { computeSegments, placementCols, alignRow } from './seat-alignment';

describe('computeSegments', () => {
  it('no aisles → single segment', () => {
    expect(computeSegments([], 5)).toEqual([{ start: 0, end: 5 }]);
  });
  it('single aisle splits in two', () => {
    expect(computeSegments([1], 5)).toEqual([{ start: 0, end: 2 }, { start: 2, end: 5 }]);
  });
  it('multiple aisles produce ordered contiguous segments', () => {
    expect(computeSegments([3, 1], 8)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 4, end: 8 },
    ]);
  });
  it('ignores out-of-range aisles', () => {
    expect(computeSegments([-1, 4, 10], 5)).toEqual([{ start: 0, end: 5 }]);
  });
});

describe('placementCols', () => {
  const seg = [0, 1, 2, 3, 4]; // width 5
  it('left aligns to the start', () => {
    expect(placementCols(seg, 3, 'left')).toEqual([0, 1, 2]);
  });
  it('right aligns to the end', () => {
    expect(placementCols(seg, 3, 'right')).toEqual([2, 3, 4]);
  });
  it('center picks middle slots', () => {
    expect(placementCols(seg, 3, 'center')).toEqual([1, 2, 3]);
  });
  it('justify puts first & last at edges', () => {
    const p = placementCols(seg, 3, 'justify');
    expect(p[0]).toBe(0);
    expect(p[p.length - 1]).toBe(4);
    expect(p.length).toBe(3);
  });
  it('n >= width returns all', () => {
    expect(placementCols(seg, 6, 'center')).toEqual(seg);
  });
  it('n = 0 returns empty', () => {
    expect(placementCols(seg, 0, 'left')).toEqual([]);
  });
});

describe('alignRow', () => {
  const segs = [{ start: 0, end: 3 }, { start: 3, end: 6 }];

  it('right-aligns a single segment and disables freed slots', () => {
    const disabled = new Set<string>();
    const { seatsRow, disabledAdd } = alignRow({
      r: 0,
      rowLength: 6,
      seatsRow: ['A', 'B', null, 'C', 'D', 'E'],
      disabled,
      segments: [{ start: 0, end: 6 }],
      segmentAlignments: ['right'],
    });
    // 5 active names → right-aligned to cols [1..5]
    expect(seatsRow).toEqual([null, 'A', 'B', 'C', 'D', 'E']);
    expect(disabledAdd).toEqual(['0-0']);
  });

  it('center-aligns per segment independently', () => {
    const disabled = new Set<string>();
    const { seatsRow } = alignRow({
      r: 1,
      rowLength: 6,
      seatsRow: ['A', null, null, 'B', 'C', null],
      disabled,
      segments: segs,
      segmentAlignments: ['center', 'center'],
    });
    // seg1: 1 name into 3 cols → col 1; seg2: 2 names into 3 cols → cols 3,4
    expect(seatsRow).toEqual([null, 'A', null, 'B', 'C', null]);
  });

  it('preserves total seat count when re-aligning', () => {
    const disabled = new Set<string>();
    const seats = ['A', 'B', 'C', 'D', 'E', 'F'];
    const before = seats.filter(Boolean).length;
    const { seatsRow } = alignRow({
      r: 0, rowLength: 6, seatsRow: seats, disabled, segments: segs,
      segmentAlignments: ['justify', 'left'],
    });
    expect(seatsRow.filter(Boolean).length).toBe(before);
  });

  it('re-enables previously disabled slot that now hosts a seat', () => {
    const disabled = new Set<string>(['0-2']);
    const { disabledRemove } = alignRow({
      r: 0, rowLength: 3, seatsRow: ['A', 'B', null], disabled,
      segments: [{ start: 0, end: 3 }],
      segmentAlignments: ['right'],
    });
    // 2 names right-aligned into 3 cols → cols 1,2; col 2 was disabled → remove.
    expect(disabledRemove).toContain('0-2');
  });

  it('honours rowLength shorter than segment end (irregular row)', () => {
    const { seatsRow } = alignRow({
      r: 0, rowLength: 4, // only cols 0..3 exist
      seatsRow: ['A', 'B', null, 'C', null, null],
      disabled: new Set(),
      segments: [{ start: 0, end: 6 }],
      segmentAlignments: ['right'],
    });
    // 3 active names right-aligned into 4 usable cols → cols 1,2,3
    expect(seatsRow[0]).toBe(null);
    expect(seatsRow[1]).toBe('A');
    expect(seatsRow[3]).toBe('C');
  });
});
