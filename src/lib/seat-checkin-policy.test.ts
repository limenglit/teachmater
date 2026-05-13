import { describe, expect, it } from 'vitest';
import { isSeatAssignmentComplete } from './seat-checkin-policy';

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
