import { describe, it, expect } from 'vitest';
import { classroomSeatNumber } from './seat-number';

describe('classroomSeatNumber', () => {
  it('makes the fixed middle column No.1 with even left / odd right', () => {
    const opts = { rowWidth: 41 };
    expect(classroomSeatNumber(0, 20, opts)).toBe(1); // 21st column
    expect(classroomSeatNumber(0, 19, opts)).toBe(2);
    expect(classroomSeatNumber(0, 18, opts)).toBe(4);
    expect(classroomSeatNumber(0, 21, opts)).toBe(3);
    expect(classroomSeatNumber(0, 22, opts)).toBe(5);
  });

  it('keeps the centre fixed when seats are closed, skipping closed seats', () => {
    const opts = { rowWidth: 41, disabledSeats: ['0-19', '0-21'] };
    expect(classroomSeatNumber(0, 20, opts)).toBe(1);
    expect(classroomSeatNumber(0, 19, opts)).toBeNull();
    expect(classroomSeatNumber(0, 18, opts)).toBe(2);
    expect(classroomSeatNumber(0, 17, opts)).toBe(4);
    expect(classroomSeatNumber(0, 21, opts)).toBeNull();
    expect(classroomSeatNumber(0, 22, opts)).toBe(3);
  });

  it('does not shift the centre when a whole side is closed', () => {
    const opts = { rowWidth: 5, disabledSeats: ['0-1'] };
    expect(classroomSeatNumber(0, 2, opts)).toBe(1);
    expect(classroomSeatNumber(0, 0, opts)).toBe(2);
    expect(classroomSeatNumber(0, 3, opts)).toBe(3);
    expect(classroomSeatNumber(0, 4, opts)).toBe(5);
    expect(classroomSeatNumber(0, 1, opts)).toBeNull();
  });

  it('supports an explicit anchor column shared by all rows', () => {
    const opts = { rowWidth: 41, anchorCol: 20, disabledSeats: ['1-20'] };
    expect(classroomSeatNumber(1, 20, opts)).toBeNull();
    expect(classroomSeatNumber(1, 19, opts)).toBe(2);
    expect(classroomSeatNumber(1, 21, opts)).toBe(3);
  });
});
