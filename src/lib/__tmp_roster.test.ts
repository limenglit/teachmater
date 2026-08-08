import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseStudentsFromText } from '@/hooks/useStudentStore';
import { decodeTextBytes } from '@/lib/text-file';
import { sortStudentsByStudentNo, describeStudentEntryOrder } from '@/lib/seat-student-no';
import { autoSeat } from '@/lib/seat-utils';

describe('uploaded roster with 学号', () => {
  const buf = readFileSync('/mnt/user-uploads/2026国培中职8.3.txt');
  const text = decodeTextBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const students = parseStudentsFromText(text);
  it('parses names and numbers', () => {
    console.log('count', students.length, students.slice(0,3), students.slice(-2));
    expect(students.length).toBeGreaterThan(5);
    expect(students.every(s => !!s.studentNumber)).toBe(true);
  });
  it('sorts ascending by 学号', () => {
    const sorted = sortStudentsByStudentNo([...students].reverse());
    const nums = sorted.map(s => Number(s.studentNumber));
    expect(nums).toEqual([...nums].sort((a,b)=>a-b));
    expect(describeStudentEntryOrder(students)[0].source).toBe('column');
  });
  it('seats front-to-back by number', () => {
    const sortedNames = sortStudentsByStudentNo(students).map(s=>s.name);
    const grid = autoSeat({ names: sortedNames, rows: 10, cols: 8, mode: 'studentNo', disabledSeats: new Set(), colOrder: Array.from({length:8},(_,i)=>i) });
    expect(grid.flat().filter(Boolean).slice(0,3)).toEqual(sortedNames.slice(0,3));
  });
});
