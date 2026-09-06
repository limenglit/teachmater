import { describe, expect, it } from 'vitest';
import { alignGridRow, alignGridRows } from './seat-alignment-grid';

const seg = (start: number, end: number) => ({ start, end });

describe('alignGridRow', () => {
  it('aligns occupied seats to the left', () => {
    const row = [null, 'A', null, 'B', null, null];
    expect(alignGridRow(row, [seg(0, 6)], 'left')).toEqual(['A', 'B', null, null, null, null]);
  });

  it('aligns occupied seats to the right', () => {
    const row = ['A', null, 'B', null];
    expect(alignGridRow(row, [seg(0, 4)], 'right')).toEqual([null, null, 'A', 'B']);
  });

  it('centers occupied seats', () => {
    const row = ['A', 'B', null, null, null];
    const out = alignGridRow(row, [seg(0, 5)], 'center');
    expect(out.filter(Boolean)).toEqual(['A', 'B']);
    expect(out.indexOf('A')).toBeGreaterThan(0);
  });

  it('keeps the seat count unchanged for every alignment', () => {
    const row = ['A', null, 'B', 'C', null, 'D'];
    for (const mode of ['left', 'right', 'center', 'justify'] as const) {
      expect(alignGridRow(row, [seg(0, 6)], mode).filter(Boolean).length).toBe(4);
    }
  });

  it('aligns each aisle segment independently', () => {
    const row = [null, 'A', null, null, 'B', null];
    const out = alignGridRow(row, [seg(0, 3), seg(3, 6)], 'left');
    expect(out).toEqual(['A', null, null, 'B', null, null]);
  });

  it('never places a student on a closed seat', () => {
    const row = [null, 'A', null, 'B'];
    const out = alignGridRow(row, [seg(0, 4)], 'left', new Set([0]));
    expect(out[0]).toBeNull();
    expect(out.filter(Boolean)).toEqual(['A', 'B']);
  });

  it('leaves an empty row untouched', () => {
    expect(alignGridRow([null, null], [seg(0, 2)], 'center')).toEqual([null, null]);
  });
});

describe('alignGridRows', () => {
  it('applies per-row alignments across the grid', () => {
    const rows = [
      [null, 'A', null],
      [null, null, 'B'],
    ];
    const out = alignGridRows(
      rows,
      () => [seg(0, 3)],
      r => (r === 0 ? 'left' : 'right'),
    );
    expect(out[0]).toEqual(['A', null, null]);
    expect(out[1]).toEqual([null, null, 'B']);
  });

  it('honours per-row closed seats', () => {
    const rows = [[null, 'A', null]];
    const out = alignGridRows(rows, () => [seg(0, 3)], () => 'left', () => new Set([2]));
    expect(out[0]).toEqual(['A', null, null]);
  });
});
