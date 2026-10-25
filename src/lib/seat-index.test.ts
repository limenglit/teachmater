import { describe, it, expect } from 'vitest';
import { buildClassroomSeatIndex, sortSeatIndex, planSeatIndexLayout, fitIndexName, buildTableSeatIndex, buildLabSeatIndex, seatIndexLabel } from './seat-index';

describe('seat index', () => {
  it('gives row/seat numbers with door side as seat 1', () => {
    const e = buildClassroomSeatIndex([[null, '李娜'], ['张伟', null]], [], false);
    expect(e).toEqual([
      { name: '李娜', studentNumber: undefined, row: 1, col: 2, label: '第1行第2列' },
      { name: '张伟', studentNumber: undefined, row: 2, col: 1, label: '第2行第1列' },
    ]);
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
    expect(planSeatIndexLayout(plain)).toMatchObject({ columns: 3, numberWidth: 0, perPage: 96 });
    expect(planSeatIndexLayout([{ ...plain[0], studentNumber: '2301' }]).columns).toBe(3);
    const long = planSeatIndexLayout([{ ...plain[0], studentNumber: '202301040123' }]);
    expect(long.columns).toBe(2);
    expect(long.perPage).toBe(64);
    // the name slot always holds at least a 4-character name
    expect(long.nameChars).toBeGreaterThanOrEqual(4);
  });
  it('truncates names that exceed the name slot instead of overflowing', () => {
    expect(fitIndexName('诸葛孔明', 4)).toBe('诸葛孔明');
    expect(fitIndexName('阿卜杜热合曼', 4)).toBe('阿卜杜…');
  });
  it('points table rooms to the table name printed on the chart, skipping closed seats', () => {
    const e = buildTableSeatIndex([['张伟', '李娜'], ['', '安琪']], ['0-1'], i => `T${i + 1}桌`);
    expect(e.map(x => [x.name, seatIndexLabel(x)])).toEqual([['张伟', 'T1桌'], ['安琪', 'T2桌']]);
  });
  it('labels computer lab seats by row, side and left-to-right number', () => {
    const groups = [
      { rowIndex: 0, side: 'top' as const, students: ['张伟', '李娜', '王五'] },
      { rowIndex: 1, side: 'bottom' as const, students: ['安琪', ''] },
    ];
    const both = buildLabSeatIndex(groups, ['0-top-1'], { seatsPerRow: 2, showTop: true, showBottom: true });
    // 王五 sits beyond the visible seats; 李娜's seat is closed
    expect(both.map(seatIndexLabel)).toEqual(['第1排上1号', '第2排下1号']);
    const topOnly = buildLabSeatIndex(groups, [], { seatsPerRow: 3, showTop: true, showBottom: false });
    expect(topOnly.map(seatIndexLabel)).toEqual(['第1排1号', '第1排2号', '第1排3号']);
  });
  it('defaults classroom labels to 第X行第Y列 counted from the front door', () => {
    const e = buildClassroomSeatIndex([['张伟', '李娜', '王五']], [], true);
    expect(e.map(seatIndexLabel)).toEqual(['第1行第3列', '第1行第2列', '第1行第1列']);
  });
  it('can label classroom seats 第X排第Y号 like the check-in page (centre = 1号, left even, right odd)', () => {
    const e = buildClassroomSeatIndex([['张伟', '李娜', '王五']], [], false, undefined, 'rowno');
    expect(e.map(seatIndexLabel)).toEqual(['第1排第2号', '第1排第1号', '第1排第3号']);
  });
  it('keeps the default 第N排M座 label for ordinary classrooms', () => {
    expect(seatIndexLabel({ name: '张伟', row: 3, col: 4 })).toBe('第3排4座');
  });
});
