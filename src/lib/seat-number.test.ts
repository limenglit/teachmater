import { describe, it, expect } from 'vitest';
import { classroomSeatNumber, openColumnNumber, openRowNumber, formatClassroomSeatLabel } from './seat-number';

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

describe('open column/row numbering skips closed seats', () => {
  it('counts columns without closed seats', () => {
    const opts = { rowWidth: 8, disabledSeats: ['0-1', '0-4'] };
    expect(openColumnNumber(0, 0, opts)).toBe(1);
    expect(openColumnNumber(0, 1, opts)).toBeNull(); // closed seat gets no column number
    expect(openColumnNumber(0, 2, opts)).toBe(2);
    expect(openColumnNumber(0, 3, opts)).toBe(3);
    expect(openColumnNumber(0, 5, opts)).toBe(4);
    expect(openColumnNumber(0, 7, opts)).toBe(6);
  });

  it('skips fully closed rows when rowWidths is provided', () => {
    const opts = {
      rowWidth: 4,
      rowWidths: [4, 4, 4, 4],
      disabledSeats: ['1-0', '1-1', '1-2', '1-3'], // row 1 fully closed
    };
    expect(openRowNumber(0, opts)).toBe(1);
    expect(openRowNumber(2, opts)).toBe(2);
    expect(openRowNumber(3, opts)).toBe(3);
  });

  it('falls back to raw row index without rowWidths', () => {
    expect(openRowNumber(2, { rowWidth: 4 })).toBe(3);
  });

  it('formats 第X排第Y列 skipping closed seats and rows', () => {
    const opts = {
      rowWidth: 4,
      rowWidths: [4, 4, 4],
      disabledSeats: ['0-0', '0-1', '0-2', '0-3', '2-0'], // row 0 fully closed
    };
    expect(formatClassroomSeatLabel(2, 1, opts, 'col')).toBe('第2排第1列');
    expect(formatClassroomSeatLabel(2, 3, opts, 'col')).toBe('第2排第3列');
  });

  it('keeps 第X排第N号 in no/both modes with closed-aware col in both mode', () => {
    const opts = { rowWidth: 5, disabledSeats: ['0-1'] };
    expect(formatClassroomSeatLabel(0, 2, opts, 'no')).toBe('第1排第1号');
    expect(formatClassroomSeatLabel(0, 3, opts, 'both')).toBe('第1排第3号（第3列）');
  });
});
