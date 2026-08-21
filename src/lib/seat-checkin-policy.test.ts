import { describe, expect, it } from 'vitest';
import { isSeatAssignmentComplete, evaluateSeatCheckinReadiness, analyzeSeatCheckinCoverage } from './seat-checkin-policy';

describe('evaluateSeatCheckinReadiness — boundary cases', () => {
  it('is not ready when seat data is empty / undefined / null', () => {
    for (const empty of [undefined, null, [], {}, [[]], [[null, null]]]) {
      const r = evaluateSeatCheckinReadiness(empty as unknown);
      expect(r.ready).toBe(false);
      expect(r.assignedCount).toBe(0);
      expect(r.reason).toContain('暂不可');
    }
  });

  it('ignores empty strings and pure whitespace (incl. full-width space)', () => {
    const r = evaluateSeatCheckinReadiness([['', '   ', '\u3000\u3000']]);
    expect(r.ready).toBe(false);
  });

  it('is ready as soon as one seat is occupied (classroom 2D grid)', () => {
    const r = evaluateSeatCheckinReadiness([[null, '张三'], [null, null]]);
    expect(r.ready).toBe(true);
    expect(r.assignedCount).toBe(1);
    expect(r.reason).toContain('已排座');
  });

  it('counts every occupied seat across a classroom grid', () => {
    const seats = [
      ['A', 'B', null],
      [null, 'C', 'D'],
      ['E', null, null],
    ];
    const r = evaluateSeatCheckinReadiness(seats);
    expect(r.ready).toBe(true);
    expect(r.assignedCount).toBe(5);
  });

  it('walks smart classroom shape (tables → seats)', () => {
    // SmartClassroom.assignment: Array<{ id, seats: Array<string|null> }>
    const assignment = [
      { id: 't1', seats: ['王一', null, '王二'] },
      { id: 't2', seats: [null, null] },
      { id: 't3', seats: ['王三'] },
    ];
    const r = evaluateSeatCheckinReadiness(assignment);
    expect(r.ready).toBe(true);
    expect(r.assignedCount).toBe(3);
  });

  it('walks banquet hall shape (round tables)', () => {
    const assignment = {
      tables: [
        { seats: ['甲', '乙', null, null] },
        { seats: [null, null] },
      ],
    };
    const r = evaluateSeatCheckinReadiness(assignment);
    expect(r.assignedCount).toBe(2);
    expect(r.ready).toBe(true);
  });

  it('walks art studio ring / concert hall arc arrays', () => {
    const ring = [
      ['a', null, 'b'],
      [null, 'c'],
    ];
    expect(evaluateSeatCheckinReadiness(ring).assignedCount).toBe(3);
  });

  it('walks custom layout deeply nested rows', () => {
    const custom = { rows: [{ cells: [{ name: '甲' }, { name: null }, { name: '乙' }] }] };
    expect(evaluateSeatCheckinReadiness(custom).assignedCount).toBe(2);
  });

  it('does not infinitely recurse on cyclic references', () => {
    const a: Record<string, unknown> = { seats: ['甲'] };
    a.self = a; // cycle
    // stack-based traversal visits values-of-values; ensure we still terminate.
    // If this hangs, the test runner will time out — that itself is the failure.
    const r = evaluateSeatCheckinReadiness(a);
    expect(r.ready).toBe(true);
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

  it('returns false when at least one student is unseated', () => {
    const seatData = [['张三', null], ['王五', '赵六']];
    expect(isSeatAssignmentComplete(seatData, ['张三', '李四', '王五', '赵六'])).toBe(false);
  });

  it('returns false with empty roster', () => {
    expect(isSeatAssignmentComplete([['张三']], [])).toBe(false);
  });

  it('supports nested ring / smart-classroom data', () => {
    const seatData = { tables: [{ seats: ['张三', '李四'] }, { seats: ['王五'] }] };
    expect(isSeatAssignmentComplete(seatData, ['张三', '李四', '王五'])).toBe(true);
  });
});

describe('analyzeSeatCheckinCoverage', () => {
  it('reports unseated students and duplicate names', () => {
    const seats = [['张三', null], ['李四', '王五']];
    const r = analyzeSeatCheckinCoverage(seats, ['张三', '李四', '王五', '赵六']);
    expect(r.assignedCount).toBe(3);
    expect(r.unseatedNames).toEqual(['赵六']);

    const dup = analyzeSeatCheckinCoverage(seats, ['张三', '张三', '李四', '王五']);
    expect(dup.rosterCount).toBe(4);
    expect(dup.uniqueCount).toBe(3);
    expect(dup.duplicateNames).toEqual(['张三']);
  });
});
