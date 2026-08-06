import { describe, it, expect } from 'vitest';
import { extractStudentNo, sortNamesByStudentNo } from './seat-student-no';
import { autoSeat } from './seat-utils';

describe('extractStudentNo', () => {
  it('parses leading numbers', () => {
    expect(extractStudentNo('01 张三')).toBe(1);
    expect(extractStudentNo('2026001-李四')).toBe(2026001);
    expect(extractStudentNo('12.王五')).toBe(12);
  });
  it('parses trailing / bracketed numbers', () => {
    expect(extractStudentNo('张三(2026001)')).toBe(2026001);
    expect(extractStudentNo('张三 7')).toBe(7);
  });
  it('handles full-width digits and plain names', () => {
    expect(extractStudentNo('０３ 赵六')).toBe(3);
    expect(extractStudentNo('陈晨')).toBeNull();
  });
});

describe('sortNamesByStudentNo', () => {
  it('sorts ascending and keeps unnumbered names last in roster order', () => {
    const out = sortNamesByStudentNo(['10 B', '甲', '2 A', '乙', '003 C']);
    expect(out).toEqual(['2 A', '003 C', '10 B', '甲', '乙']);
  });
});

describe('autoSeat studentNo mode', () => {
  it('fills front-to-back, left-to-right by student number', () => {
    const grid = autoSeat({
      names: ['3 C', '1 A', '2 B', '4 D'],
      rows: 2, cols: 2, mode: 'studentNo',
      disabledSeats: new Set(), colOrder: [0, 1],
    });
    expect(grid.flat()).toEqual(['1 A', '2 B', '3 C', '4 D']);
  });
});
