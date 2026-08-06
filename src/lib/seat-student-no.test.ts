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

describe('extractStudentNo — extended coverage', () => {
  it('parses the "01 张三" family with separators and padding', () => {
    expect(extractStudentNo('01 张三')).toBe(1);
    expect(extractStudentNo('007、张三')).toBe(7);
    expect(extractStudentNo('15，张三')).toBe(15);
    expect(extractStudentNo('9:张三')).toBe(9);
    expect(extractStudentNo('  08  张三  ')).toBe(8);
  });

  it('parses the "张三(2026001)" family with half/full-width brackets', () => {
    expect(extractStudentNo('张三(2026001)')).toBe(2026001);
    expect(extractStudentNo('张三（26）')).toBe(26);
    expect(extractStudentNo('张三[18]')).toBe(18);
    expect(extractStudentNo('张三#21')).toBe(21);
    expect(extractStudentNo('张三-07')).toBe(7);
  });

  it('parses full-width digits in every position', () => {
    expect(extractStudentNo('０１ 张三')).toBe(1);
    expect(extractStudentNo('张三（２０２６００１）')).toBe(2026001);
    expect(extractStudentNo('２３')).toBe(23);
  });

  it('returns null when there is no student number', () => {
    expect(extractStudentNo('张三')).toBeNull();
    expect(extractStudentNo('Li Hua')).toBeNull();
    expect(extractStudentNo('')).toBeNull();
    expect(extractStudentNo('   ')).toBeNull();
    expect(extractStudentNo(undefined as unknown as string)).toBeNull();
  });
});

describe('sortNamesByStudentNo — mixed formats', () => {
  it('orders across leading, bracketed and full-width formats', () => {
    const out = sortNamesByStudentNo([
      '张三(2026001)',
      '１０ 孙七',
      '02、李四',
      '陈晨',
      '5.王五',
      '周舟',
      '张三-07',
    ]);
    expect(out).toEqual([
      '02、李四',
      '5.王五',
      '张三-07',
      '１０ 孙七',
      '张三(2026001)',
      '陈晨',
      '周舟',
    ]);
  });

  it('is stable for duplicate numbers and keeps unnumbered roster order', () => {
    expect(sortNamesByStudentNo(['3 C', '3 A', '甲', '1 B', '乙'])).toEqual([
      '1 B', '3 C', '3 A', '甲', '乙',
    ]);
  });

  it('returns an empty list unchanged', () => {
    expect(sortNamesByStudentNo([])).toEqual([]);
  });
});

describe('autoSeat studentNo mode — mixed roster', () => {
  it('seats numbered students first and unnumbered ones last', () => {
    const grid = autoSeat({
      names: ['王五', '０３ 丙', '1 甲', '张三(2)'],
      rows: 2, cols: 2, mode: 'studentNo',
      disabledSeats: new Set(), colOrder: [0, 1],
    });
    expect(grid.flat()).toEqual(['1 甲', '张三(2)', '０３ 丙', '王五']);
  });
});
