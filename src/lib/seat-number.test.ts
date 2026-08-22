import { describe, it, expect } from 'vitest';
import { classroomSeatNumber } from './seat-number';

describe('classroomSeatNumber', () => {
  it('makes the middle seat No.1 with even left / odd right', () => {
    const opts = { rowWidth: 41 };
    expect(classroomSeatNumber(0, 20, opts)).toBe(1); // 21st column
    expect(classroomSeatNumber(0, 19, opts)).toBe(2);
    expect(classroomSeatNumber(0, 18, opts)).toBe(4);
    expect(classroomSeatNumber(0, 21, opts)).toBe(3);
    expect(classroomSeatNumber(0, 22, opts)).toBe(5);
  });

  it('skips closed seats when numbering', () => {
    const opts = { rowWidth: 5, disabledSeats: ['0-1'] };
    // open cols: 0,2,3,4 -> center index 1 (col 2) = 1
    expect(classroomSeatNumber(0, 2, opts)).toBe(1);
    expect(classroomSeatNumber(0, 0, opts)).toBe(2);
    expect(classroomSeatNumber(0, 3, opts)).toBe(3);
    expect(classroomSeatNumber(0, 4, opts)).toBe(5);
    expect(classroomSeatNumber(0, 1, opts)).toBeNull();
  });

  it('numbers each row independently', () => {
    const opts = { rowWidth: 3, disabledSeats: ['1-0'] };
    expect(classroomSeatNumber(0, 1, opts)).toBe(1);
    // row 1 open cols: 1,2 -> center index 0 (col 1)
    expect(classroomSeatNumber(1, 1, opts)).toBe(1);
    expect(classroomSeatNumber(1, 2, opts)).toBe(3);
  });
});
