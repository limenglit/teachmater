import { describe, it, expect } from 'vitest';
import {
  splitIntoGroups,
  findNextFree,
  getVisualRow,
  getColOrder,
  makeGrid,
  seatKey,
  autoSeat,
  swapSeats,
  toggleDisabledSeat,
} from './seat-utils';

// ── Helper ──────────────────────────────────────────────
const names6 = ['A', 'B', 'C', 'D', 'E', 'F'];
const names24 = Array.from({ length: 24 }, (_, i) => `S${i + 1}`);
const defaultColOrder = (cols: number) => Array.from({ length: cols }, (_, i) => i);
const flatNames = (grid: (string | null)[][]) =>
  grid.flat().filter(Boolean) as string[];

// ── splitIntoGroups ─────────────────────────────────────
describe('splitIntoGroups', () => {
  it('distributes evenly', () => {
    const g = splitIntoGroups(names6, 3);
    expect(g).toEqual([['A', 'D'], ['B', 'E'], ['C', 'F']]);
  });
  it('handles uneven split', () => {
    const g = splitIntoGroups(['A', 'B', 'C', 'D', 'E'], 3);
    expect(g.map(x => x.length)).toEqual([2, 2, 1]);
  });
  it('returns empty groups when count > names', () => {
    const g = splitIntoGroups(['A'], 4);
    expect(g[0]).toEqual(['A']);
    expect(g[1]).toEqual([]);
  });
  it('handles empty input', () => {
    const g = splitIntoGroups([], 3);
    expect(g.every(x => x.length === 0)).toBe(true);
  });
});

// ── findNextFree ────────────────────────────────────────
describe('findNextFree', () => {
  it('returns start when free', () => {
    expect(findNextFree(3, 8, [1, 2])).toBe(3);
  });
  it('skips occupied slots', () => {
    expect(findNextFree(3, 8, [3, 4])).toBe(5);
  });
  it('wraps around', () => {
    expect(findNextFree(6, 8, [6, 7])).toBe(0);
  });
  it('returns null when all taken', () => {
    expect(findNextFree(0, 3, [0, 1, 2])).toBeNull();
  });
});

// ── getVisualRow ────────────────────────────────────────
describe('getVisualRow', () => {
  it('no aisles → same index', () => {
    expect(getVisualRow(3, [])).toBe(3);
  });
  it('one aisle before row', () => {
    expect(getVisualRow(3, [1])).toBe(4);
  });
  it('two aisles before row', () => {
    expect(getVisualRow(5, [1, 3])).toBe(7);
  });
  it('aisle after row → no offset', () => {
    expect(getVisualRow(2, [4])).toBe(2);
  });
});

// ── getColOrder ─────────────────────────────────────────
describe('getColOrder', () => {
  it('window left + start from door → right-to-left', () => {
    expect(getColOrder(4, true, 'door')).toEqual([3, 2, 1, 0]);
  });
  it('window left + start from window → left-to-right', () => {
    expect(getColOrder(4, true, 'window')).toEqual([0, 1, 2, 3]);
  });
  it('window right + start from door → left-to-right', () => {
    expect(getColOrder(4, false, 'door')).toEqual([0, 1, 2, 3]);
  });
  it('window right + start from window → right-to-left', () => {
    expect(getColOrder(4, false, 'window')).toEqual([3, 2, 1, 0]);
  });
});

// ── makeGrid ────────────────────────────────────────────
describe('makeGrid', () => {
  it('creates correct dimensions', () => {
    const g = makeGrid(3, 4);
    expect(g.length).toBe(3);
    expect(g[0].length).toBe(4);
    expect(g.flat().every(v => v === null)).toBe(true);
  });
});

// ── autoSeat: verticalS ─────────────────────────────────
describe('autoSeat – verticalS', () => {
  it('fills column-by-column in S-pattern', () => {
    const grid = autoSeat({
      names: names6, rows: 3, cols: 3, mode: 'verticalS',
      disabledSeats: new Set(), colOrder: defaultColOrder(3),
    });
    // Col 0 top-down: A B C, Col 1 bottom-up: D E F
    expect(grid[0][0]).toBe('A');
    expect(grid[1][0]).toBe('B');
    expect(grid[2][0]).toBe('C');
    expect(grid[2][1]).toBe('D');
    expect(grid[1][1]).toBe('E');
    expect(grid[0][1]).toBe('F');
  });

  it('places all students (no loss)', () => {
    const grid = autoSeat({
      names: names24, rows: 10, cols: 8, mode: 'verticalS',
      disabledSeats: new Set(), colOrder: defaultColOrder(8),
    });
    expect(flatNames(grid).length).toBe(24);
  });

  it('skips disabled seats', () => {
    const disabled = new Set(['0-0', '1-0']);
    const grid = autoSeat({
      names: names6, rows: 3, cols: 3, mode: 'verticalS',
      disabledSeats: disabled, colOrder: defaultColOrder(3),
    });
    expect(grid[0][0]).toBeNull();
    expect(grid[1][0]).toBeNull();
    expect(grid[2][0]).toBe('A');
    expect(flatNames(grid).length).toBe(6);
  });
});

// ── autoSeat: horizontalS ───────────────────────────────
describe('autoSeat – horizontalS', () => {
  it('fills row-by-row in S-pattern', () => {
    const grid = autoSeat({
      names: names6, rows: 2, cols: 3, mode: 'horizontalS',
      disabledSeats: new Set(), colOrder: defaultColOrder(3),
    });
    // Row 0 L→R: A B C, Row 1 R→L: D E F
    expect(grid[0]).toEqual(['A', 'B', 'C']);
    expect(grid[1]).toEqual(['F', 'E', 'D']);
  });
});

// ── autoSeat: exam ──────────────────────────────────────
describe('autoSeat – exam', () => {
  it('skip-row places only on even rows', () => {
    const grid = autoSeat({
      names: ['A', 'B', 'C'], rows: 4, cols: 2, mode: 'exam',
      disabledSeats: new Set(), colOrder: defaultColOrder(2),
      examSkipRow: true, examSkipCol: false,
    });
    // Even rows only: 0, 2
    const occupied = grid.flatMap((row, ri) => row.map((v, ci) => v ? ri : null)).filter(v => v !== null);
    expect(occupied.every(r => r! % 2 === 0)).toBe(true);
  });

  it('skip-col skips odd columns', () => {
    const grid = autoSeat({
      names: ['A', 'B'], rows: 2, cols: 4, mode: 'exam',
      disabledSeats: new Set(), colOrder: defaultColOrder(4),
      examSkipRow: false, examSkipCol: true,
    });
    // Only even column indices used (0, 2)
    const occupiedCols = grid.flatMap(row => row.map((v, ci) => v ? ci : null)).filter(v => v !== null) as number[];
    expect(occupiedCols.every(c => c % 2 === 0)).toBe(true);
  });

  it('combined skip-row + skip-col produces sparse layout', () => {
    const grid = autoSeat({
      names: names24, rows: 10, cols: 8, mode: 'exam',
      disabledSeats: new Set(), colOrder: defaultColOrder(8),
      examSkipRow: true, examSkipCol: true,
    });
    const placed = flatNames(grid);
    // Max slots = 5 rows * 4 cols = 20
    expect(placed.length).toBeLessThanOrEqual(20);
    expect(placed.length).toBeGreaterThan(0);
  });
});

// ── autoSeat: random ────────────────────────────────────
describe('autoSeat – random', () => {
  it('places all students without duplicates', () => {
    const grid = autoSeat({
      names: names24, rows: 10, cols: 8, mode: 'random',
      disabledSeats: new Set(), colOrder: defaultColOrder(8),
    });
    const placed = flatNames(grid);
    expect(placed.length).toBe(24);
    expect(new Set(placed).size).toBe(24);
  });
});

// ── autoSeat: groupCol ──────────────────────────────────
describe('autoSeat – groupCol', () => {
  it('places all students', () => {
    const grid = autoSeat({
      names: names24, rows: 10, cols: 8, mode: 'groupCol',
      disabledSeats: new Set(), colOrder: defaultColOrder(8), groupCount: 4,
    });
    expect(flatNames(grid).length).toBe(24);
  });
});

// ── autoSeat: groupRow ──────────────────────────────────
describe('autoSeat – groupRow', () => {
  it('places all students', () => {
    const grid = autoSeat({
      names: names24, rows: 10, cols: 8, mode: 'groupRow',
      disabledSeats: new Set(), colOrder: defaultColOrder(8), groupCount: 4,
    });
    expect(flatNames(grid).length).toBe(24);
  });
});

// ── autoSeat: smartCluster ──────────────────────────────
describe('autoSeat – smartCluster', () => {
  it('places all students in blocks', () => {
    const grid = autoSeat({
      names: names24, rows: 10, cols: 8, mode: 'smartCluster',
      disabledSeats: new Set(), colOrder: defaultColOrder(8), groupCount: 4,
    });
    expect(flatNames(grid).length).toBe(24);
  });
});

// ── Disabled seats ──────────────────────────────────────
describe('toggleDisabledSeat', () => {
  it('disables a seat and clears its name', () => {
    const grid: (string | null)[][] = [['A', 'B'], ['C', 'D']];
    const result = toggleDisabledSeat(new Set(), grid, 0, 1);
    expect(result.disabledSeats.has('0-1')).toBe(true);
    expect(result.grid[0][1]).toBeNull();
    expect(result.grid[0][0]).toBe('A'); // other seats untouched
  });

  it('re-enables a disabled seat', () => {
    const result = toggleDisabledSeat(new Set(['0-1']), [['A', null], ['C', 'D']], 0, 1);
    expect(result.disabledSeats.has('0-1')).toBe(false);
  });

  it('disabled seats are respected by autoSeat', () => {
    const disabled = new Set(['0-0', '0-1', '0-2', '0-3']);
    const grid = autoSeat({
      names: ['A', 'B'], rows: 3, cols: 4, mode: 'verticalS',
      disabledSeats: disabled, colOrder: defaultColOrder(4),
    });
    // Entire row 0 disabled – no one there
    expect(grid[0].every(v => v === null)).toBe(true);
    expect(flatNames(grid).length).toBe(2);
  });
});

// ── swapSeats (drag-and-drop) ───────────────────────────
describe('swapSeats', () => {
  it('swaps two occupied seats', () => {
    const grid: (string | null)[][] = [['A', 'B'], ['C', 'D']];
    const result = swapSeats(grid, { r: 0, c: 0 }, { r: 1, c: 1 });
    expect(result[0][0]).toBe('D');
    expect(result[1][1]).toBe('A');
    // Originals unchanged
    expect(grid[0][0]).toBe('A');
  });

  it('swaps occupied with empty', () => {
    const grid: (string | null)[][] = [['A', null], [null, null]];
    const result = swapSeats(grid, { r: 0, c: 0 }, { r: 1, c: 1 });
    expect(result[0][0]).toBeNull();
    expect(result[1][1]).toBe('A');
  });

  it('swap is symmetric', () => {
    const grid: (string | null)[][] = [['X', 'Y']];
    const r1 = swapSeats(grid, { r: 0, c: 0 }, { r: 0, c: 1 });
    const r2 = swapSeats(grid, { r: 0, c: 1 }, { r: 0, c: 0 });
    expect(r1).toEqual(r2);
  });
});

// ── Aisle management ────────────────────────────────────
describe('aisle management', () => {
  it('findNextFree finds gap for aisle insertion', () => {
    // Simulating: aisles at [3], trying to add at mid=3 → finds 4
    expect(findNextFree(3, 8, [3])).toBe(4);
  });

  it('getVisualRow offsets correctly with multiple aisles', () => {
    // Aisles after row 2 and row 5
    expect(getVisualRow(0, [2, 5])).toBe(0); // before both
    expect(getVisualRow(3, [2, 5])).toBe(4); // after first
    expect(getVisualRow(6, [2, 5])).toBe(8); // after both
  });

  it('aisle at boundary: row 0', () => {
    expect(getVisualRow(0, [0])).toBe(0); // not > 0
    expect(getVisualRow(1, [0])).toBe(2); // > 0
  });
});

// ── useRoundTableDrag (cross-table swap logic) ──────────
describe('round table cross-table swap', () => {
  it('swaps within same table', () => {
    const tables = [['A', 'B', 'C'], ['D', 'E', 'F']];
    // Simulate swap: table 0 seat 0 ↔ table 0 seat 2
    const next = tables.map(t => [...t]);
    const from = { table: 0, seat: 0 };
    const to = { table: 0, seat: 2 };
    const fromName = next[from.table][from.seat];
    const toName = next[to.table][to.seat];
    next[from.table][from.seat] = toName;
    next[to.table][to.seat] = fromName;
    expect(next[0]).toEqual(['C', 'B', 'A']);
  });

  it('swaps across tables', () => {
    const tables = [['A', 'B'], ['C', 'D']];
    const next = tables.map(t => [...t]);
    const fromName = next[0][0];
    const toName = next[1][1];
    next[0][0] = toName;
    next[1][1] = fromName;
    expect(next[0][0]).toBe('D');
    expect(next[1][1]).toBe('A');
  });
});

// ── Edge cases ──────────────────────────────────────────
describe('edge cases', () => {
  it('autoSeat with zero students produces empty grid', () => {
    const grid = autoSeat({
      names: [], rows: 5, cols: 5, mode: 'verticalS',
      disabledSeats: new Set(), colOrder: defaultColOrder(5),
    });
    expect(flatNames(grid).length).toBe(0);
  });

  it('autoSeat with more students than seats truncates', () => {
    const grid = autoSeat({
      names: names24, rows: 2, cols: 2, mode: 'verticalS',
      disabledSeats: new Set(), colOrder: defaultColOrder(2),
    });
    expect(flatNames(grid).length).toBe(4); // only 4 seats
  });

  it('autoSeat with all seats disabled places no one', () => {
    const disabled = new Set<string>();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) disabled.add(seatKey(r, c));
    const grid = autoSeat({
      names: names6, rows: 3, cols: 3, mode: 'verticalS',
      disabledSeats: disabled, colOrder: defaultColOrder(3),
    });
    expect(flatNames(grid).length).toBe(0);
  });

  it('splitIntoGroups with 1 group returns all names', () => {
    expect(splitIntoGroups(names6, 1)).toEqual([names6]);
  });

  it('seatKey produces consistent keys', () => {
    expect(seatKey(0, 0)).toBe('0-0');
    expect(seatKey(9, 7)).toBe('9-7');
  });

  it('reversed colOrder fills from right side', () => {
    const grid = autoSeat({
      names: ['A', 'B', 'C'], rows: 3, cols: 3, mode: 'verticalS',
      disabledSeats: new Set(), colOrder: [2, 1, 0],
    });
    // First column filled is col 2
    expect(grid[0][2]).toBe('A');
    expect(grid[1][2]).toBe('B');
    expect(grid[2][2]).toBe('C');
  });
});
