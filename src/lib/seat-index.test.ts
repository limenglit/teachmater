import { describe, it, expect } from 'vitest';
import { buildClassroomSeatIndex, sortSeatIndex, planSeatIndexLayout, fitIndexName } from './seat-index';

describe('seat index', () => {
  it('gives row/seat numbers with door side as seat 1', () => {
    const e = buildClassroomSeatIndex([[null, '李娜'], ['张伟', null]], [], false);
    expect(e).toEqual([{ name: '李娜', studentNumber: undefined, row: 1, col: 2 }, { name: '张伟', studentNumber: undefined, row: 2, col: 1 }]);
    expect(buildClassroomSeatIndex([[null, '李娜']], [], true)[0].col).toBe(1);
  });
  it('matches the chart labels when a column or row is closed', () => {
    // door on the right, right-most column closed: chart still labels it 第1列
    const e = buildClassroomSeatIndex([['张伟', '李娜', null]], ['0-2'], true);
    expect(e.map(x => x.col)).toEqual([3, 2]);
    // first row fully closed: chart still labels the next row 第2排
    const r = buildClassroomSeatIndex([[null, null], ['安琪', null]], ['0-0', '0-1'], false);
    expect(r[0]).toMatchObject({ row: 2, col: 1 });
  });
  it('sorts by student number when all have one, else by pinyin', () => {
    const base = [{ name: '张伟', row: 1, col: 1 }, { name: '李娜', row: 1, col: 2 }, { name: '安琪', row: 2, col: 1 }];
    expect(sortSeatIndex(base).entries.map(e => e.name)).toEqual(['安琪', '李娜', '张伟']);
    const num = base.map((e, i) => ({ ...e, studentNumber: String([10, 2, 30][i]) }));
    const r = sortSeatIndex(num);
    expect(r.sortBy).toBe('number');
    expect(r.entries.map(e => e.name)).toEqual(['李娜', '张伟', '安琪']);
  });
  it('uses 3 columns for short or no student numbers and 2 columns for long ones', () => {
    const plain = [{ name: '张伟', row: 1, col: 1 }];
    expect(planSeatIndexLayout(plain)).toMatchObject({ columns: 3, numberWidth: 0, perPage: 114 });
    expect(planSeatIndexLayout([{ ...plain[0], studentNumber: '2301' }]).columns).toBe(3);
    const long = planSeatIndexLayout([{ ...plain[0], studentNumber: '202301040123' }]);
    expect(long.columns).toBe(2);
    expect(long.perPage).toBe(76);
    // the name slot always holds at least a 4-character name
    expect(long.nameChars).toBeGreaterThanOrEqual(4);
  });
  it('truncates names that exceed the name slot instead of overflowing', () => {
    expect(fitIndexName('诸葛孔明', 4)).toBe('诸葛孔明');
    expect(fitIndexName('阿卜杜热合曼', 4)).toBe('阿卜杜…');
  });
});
