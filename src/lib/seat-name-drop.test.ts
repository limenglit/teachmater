import { describe, it, expect } from 'vitest';
import { applyStudentDropToGrid } from './seat-name-drop';

describe('applyStudentDropToGrid', () => {
  it('places a new student into an empty seat', () => {
    const grid = [['', ''], ['', '']];
    const next = applyStudentDropToGrid(grid, '张三', 1, 0);
    expect(next).toEqual([['', ''], ['张三', '']]);
    // original untouched
    expect(grid).toEqual([['', ''], ['', '']]);
  });

  it('swaps when the student is already seated elsewhere', () => {
    const grid = [['张三', ''], ['', '李四']];
    const next = applyStudentDropToGrid(grid, '张三', 1, 1);
    // 张三 moves to (1,1); 李四 evicted back to (0,0)
    expect(next).toEqual([['李四', ''], ['', '张三']]);
  });

  it('evicts the previous occupant when dropping a new student', () => {
    const grid = [['李四', '']];
    const next = applyStudentDropToGrid(grid, '张三', 0, 0);
    // 张三 replaces 李四; 李四 not present elsewhere so simply removed
    expect(next).toEqual([['张三', '']]);
  });

  it('no-op when target row missing', () => {
    const grid = [['']];
    const next = applyStudentDropToGrid(grid, '张三', 5, 0);
    expect(next).toBe(grid);
  });

  it('handles null-based grids', () => {
    const grid: (string | null)[][] = [[null, null], [null, null]];
    const next = applyStudentDropToGrid(grid, '张三', 0, 1);
    expect(next).toEqual([[null, '张三'], [null, null]]);
  });
});
