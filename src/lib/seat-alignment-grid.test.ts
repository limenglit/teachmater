import { describe, it, expect } from 'vitest';
import { alignGridRow, alignGridRows } from './seat-alignment-grid';
import { computeSegments } from './seat-alignment';

const segs = (aisles: number[], cols: number) => computeSegments(aisles, cols);

describe('alignGridRow', () => {
  it('left aligns occupied seats', () => {
    expect(alignGridRow([null, 'A', null, 'B'], segs([], 4), 'left')).toEqual(['A', 'B', null, null]);
  });

  it('right aligns occupied seats', () => {
    expect(alignGridRow(['A', null, 'B', null], segs([], 4), 'right')).toEqual([null, null, 'A', 'B']);
  });

  it('centers occupied seats', () => {
    expect(alignGridRow(['A', 'B', null, null], segs([], 4), 'center')).toEqual([null, 'A', 'B', null]);
  });

  it('justify puts first and last at the edges', () => {
    const out = alignGridRow(['A', 'B', 'C', null, null, null], segs([], 6), 'justify');
    expect(out[0]).toBe('A');
    expect(out[5]).toBe('C');
    expect(out.filter(Boolean)).toEqual(['A', 'B', 'C']);
  });

  it('aligns each aisle segment independently', () => {
    const out = alignGridRow([null, 'A', null, 'B'], segs([1], 4), 'left');
    expect(out).toEqual(['A', null, 'B', null]);
  });

  it('skips disabled columns entirely', () => {
    const out = alignGridRow(['A', null, 'B', null], segs([], 4), 'left', new Set([0]));
    expect(out[0]).toBe(null);
    expect(out).toEqual([null, 'A', 'B', null]);
  });

  it('never changes the number of seated students', () => {
    const row = ['A', null, 'B', 'C', null, 'D'];
    for (const a of ['left', 'right', 'center', 'justify'] as const) {
      expect(alignGridRow(row, segs([2], 6), a).filter(Boolean).length).toBe(4);
    }
  });
});

describe('alignGridRows', () => {
  it('applies per-row alignment and disabled sets', () => {
    const rows = [['A', null, null], [null, null, 'B']];
    const out = alignGridRows(
      rows,
      () => segs([], 3),
      r => (r === 0 ? 'right' : 'left'),
      () => new Set<number>(),
    );
    expect(out[0]).toEqual([null, null, 'A']);
    expect(out[1]).toEqual(['B', null, null]);
  });
});
