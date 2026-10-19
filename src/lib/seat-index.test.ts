import { describe, it, expect } from 'vitest';
import { buildClassroomSeatIndex, sortSeatIndex } from './seat-index';

describe('seat index', () => {
  it('gives row/seat numbers with door side as seat 1', () => {
    const e = buildClassroomSeatIndex([[null, '李娜'], ['张伟', null]], [], false);
    expect(e).toEqual([{ name: '李娜', studentNumber: undefined, row: 1, col: 2 }, { name: '张伟', studentNumber: undefined, row: 2, col: 1 }]);
    expect(buildClassroomSeatIndex([[null, '李娜']], [], true)[0].col).toBe(1);
  });
  it('sorts by student number when all have one, else by pinyin', () => {
    const base = [{ name: '张伟', row: 1, col: 1 }, { name: '李娜', row: 1, col: 2 }, { name: '安琪', row: 2, col: 1 }];
    expect(sortSeatIndex(base).entries.map(e => e.name)).toEqual(['安琪', '李娜', '张伟']);
    const num = base.map((e, i) => ({ ...e, studentNumber: String([10, 2, 30][i]) }));
    const r = sortSeatIndex(num);
    expect(r.sortBy).toBe('number');
    expect(r.entries.map(e => e.name)).toEqual(['李娜', '张伟', '安琪']);
  });
});
