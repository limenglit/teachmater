import { describe, it, expect } from 'vitest';
import { parseStudentsFromText } from '@/hooks/useStudentStore';
import { sortStudentsByStudentNo, describeStudentEntryOrder } from '@/lib/seat-student-no';
import { autoSeat } from '@/lib/seat-utils';

// Mirrors the real uploaded roster: header 学院/班级/学号/姓名, tab separated.
const TSV = [
  '学院\t班级\t学号\t姓名',
  '河南水利与环境职业学院\t2026高职\t26030401\t何玉媛',
  '河南水利与环境职业学院\t2026高职\t26030410\t李政',
  '河南水利与环境职业学院\t2026高职\t260304100\t潘浩利',
  '河南水利与环境职业学院\t2026高职\t26030402\t陈建立',
].join('\r\n');

describe('roster 学号 import', () => {
  it('stores the 学号 column on every student', () => {
    const students = parseStudentsFromText(TSV);
    expect(students.map(s => s.name)).toEqual(['何玉媛', '李政', '潘浩利', '陈建立']);
    expect(students.map(s => s.studentNumber)).toEqual(['26030401', '26030410', '260304100', '26030402']);
  });

  it('sorts numerically by the 学号 column, not by name digits', () => {
    const students = parseStudentsFromText(TSV);
    expect(sortStudentsByStudentNo(students).map(s => s.name))
      .toEqual(['何玉媛', '陈建立', '李政', '潘浩利']);
    expect(describeStudentEntryOrder(students)[0]).toMatchObject({ no: 26030401, source: 'column', order: 1 });
  });

  it('seats front-to-back in ascending 学号 order', () => {
    const names = sortStudentsByStudentNo(parseStudentsFromText(TSV)).map(s => s.name);
    const grid = autoSeat({ names, rows: 2, cols: 2, mode: 'studentNo', disabledSeats: new Set(), colOrder: [0, 1] });
    expect(grid.flat()).toEqual(['何玉媛', '陈建立', '李政', '潘浩利']);
  });

  it('keeps a headerless "学号<TAB>姓名" list working', () => {
    const students = parseStudentsFromText('26030410\t李政\n26030401\t何玉媛');
    expect(students.map(s => s.name)).toEqual(['李政', '何玉媛']);
    expect(sortStudentsByStudentNo(students).map(s => s.name)).toEqual(['何玉媛', '李政']);
  });
});
