import { describe, expect, it } from 'vitest';
import { isSeatAssignmentComplete, evaluateSeatCheckinReadiness } from './seat-checkin-policy';

describe('evaluateSeatCheckinReadiness', () => {
  it('reports not ready with a reason when no seat is occupied', () => {
    const r = evaluateSeatCheckinReadiness([[null, null], [null, '']]);
    expect(r.ready).toBe(false);
    expect(r.assignedCount).toBe(0);
    expect(r.reason).toContain('暂不可');
  });

  it('reports ready with the assigned count as soon as one seat is filled', () => {
    const r = evaluateSeatCheckinReadiness([[null, '张三'], [null, null]]);
    expect(r.ready).toBe(true);
    expect(r.assignedCount).toBe(1);
    expect(r.reason).toContain('1');
  });

  it('walks nested arrays and objects (art studio / ring layouts)', () => {
    const r = evaluateSeatCheckinReadiness({ ring: [['a', null], { extra: ['b', '  '] }] });
    expect(r.ready).toBe(true);
    expect(r.assignedCount).toBe(2);
  });
});


describe('isSeatAssignmentComplete', () => {
  it('treats full-width and repeated whitespace as the same student name', () => {
    const seatData = [
      [' 张三　', '李四'],
      ['王五', '赵六'],
    ];

    expect(isSeatAssignmentComplete(seatData, ['张三', '李四', '王五', '赵六'])).toBe(true);
  });

  it('supports art studio ring data', () => {
    const seatData = [
      ['张三', '李四'],
      ['王五', '赵六', '孙七'],
    ];

    expect(isSeatAssignmentComplete(seatData, ['张三', '李四', '王五', '赵六', '孙七'])).toBe(true);
  });
});
