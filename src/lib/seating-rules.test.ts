import { describe, it, expect } from 'vitest';
import {
  arrangeSmartCluster,
  arrangeGenderAlternateRows,
  arrangeUnitCluster,
  arrangeGenderInterleave,
  validateSmartCluster,
  validateGenderAlternateRows,
  validateUnitCluster,
  validateGenderInterleave,
  runAllRules,
} from './seating-rules';
import type { Student } from '@/hooks/useStudentStore';

const mk = (n: number, opts: Partial<Student> = {}): Student[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `学${i}`, ...opts }));

const alternating = (n: number): Student[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`, name: `学${i}`, gender: i % 2 === 0 ? 'male' : 'female',
  }));

describe('seating-rules', () => {
  it('smartCluster places students into expected blocks', () => {
    const grid = arrangeSmartCluster(mk(24), { rows: 6, cols: 6 }, 4);
    const result = validateSmartCluster(grid, 4);
    expect(result.pass).toBe(true);
  });

  it('genderAlternateRows yields alternating dominant gender per row', () => {
    const students = [...mk(20, { gender: 'male' }), ...mk(20, { gender: 'female' })]
      .map((s, i) => ({ ...s, id: `s${i}` }));
    const grid = arrangeGenderAlternateRows(students, { rows: 8, cols: 5 });
    const result = validateGenderAlternateRows(grid);
    expect(result.pass).toBe(true);
    expect(result.stats?.性别交替次数).toBeGreaterThan(0);
  });

  it('unitCluster keeps each org within a contiguous row span', () => {
    const a = mk(6, { organization: '一班' });
    const b = mk(6, { organization: '二班' }).map((s, i) => ({ ...s, id: `b${i}` }));
    const grid = arrangeUnitCluster([...a, ...b], { rows: 4, cols: 4 });
    const result = validateUnitCluster(grid);
    expect(result.pass).toBe(true);
  });

  it('genderInterleave reduces adjacent same-gender pairs', () => {
    const grid = arrangeGenderInterleave(alternating(24), { rows: 4, cols: 6 });
    const result = validateGenderInterleave(grid);
    expect(result.pass).toBe(true);
    const ratio = parseFloat(String(result.stats?.同性别比例 ?? '0').replace('%', ''));
    expect(ratio).toBeLessThanOrEqual(30);
  });

  it('runAllRules flags missing required fields', () => {
    const reports = runAllRules(mk(12));
    const genderRule = reports.find(r => r.ruleId === 'genderAlternateRows');
    expect(genderRule?.pass).toBe(false);
    expect(genderRule?.issues[0]).toMatch(/性别/);
  });

  it('genderAlternateRows fails when input is all one gender', () => {
    const grid = arrangeGenderAlternateRows(mk(12, { gender: 'male' }), { rows: 3, cols: 4 });
    const result = validateGenderAlternateRows(grid);
    expect(result.pass).toBe(false);
  });
});
