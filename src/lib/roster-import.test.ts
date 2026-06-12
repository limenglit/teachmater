import { describe, it, expect } from 'vitest';
import { resolveRosterColumns, normalizeHeaderCell } from './roster-import';

describe('normalizeHeaderCell', () => {
  it('lowercases and strips whitespace/punctuation', () => {
    expect(normalizeHeaderCell('  Student Name ')).toBe('studentname');
    expect(normalizeHeaderCell('学号/工号')).toBe('学号工号');
    expect(normalizeHeaderCell('Full_Name')).toBe('fullname');
    expect(normalizeHeaderCell('班级（行政班）')).toBe('班级行政班');
  });
});

describe('resolveRosterColumns - alias tolerance', () => {
  it('maps Chinese canonical headers', () => {
    expect(resolveRosterColumns(['院系', '班级', '学号', '姓名'])).toEqual({
      collegeCol: 0, classCol: 1, numberCol: 2, nameCol: 3,
    });
  });

  it('maps English headers (Name/Class/Department/Student ID)', () => {
    expect(resolveRosterColumns(['Department', 'Class', 'Student ID', 'Name'])).toEqual({
      collegeCol: 0, classCol: 1, numberCol: 2, nameCol: 3,
    });
  });

  it('handles "学生姓名" without colliding with college/class', () => {
    const r = resolveRosterColumns(['学生姓名', '学院', '行政班', '工号']);
    expect(r.nameCol).toBe(0);
    expect(r.collegeCol).toBe(1);
    expect(r.classCol).toBe(2);
    expect(r.numberCol).toBe(3);
  });

  it('supports "full_name" / "Faculty" / "Grade" / "No."', () => {
    const r = resolveRosterColumns(['Faculty', 'Grade', 'No.', 'full_name']);
    expect(r).toEqual({ collegeCol: 0, classCol: 1, numberCol: 2, nameCol: 3 });
  });

  it('supports 单位 / 部门 alias for college', () => {
    const r = resolveRosterColumns(['姓名', '单位', '班级']);
    expect(r.nameCol).toBe(0);
    expect(r.collegeCol).toBe(1);
    expect(r.classCol).toBe(2);
  });

  it('reorders columns regardless of position', () => {
    const r = resolveRosterColumns(['姓名', '学号', '班级', '院系']);
    expect(r.nameCol).toBe(0);
    expect(r.numberCol).toBe(1);
    expect(r.classCol).toBe(2);
    expect(r.collegeCol).toBe(3);
  });

  it('handles 学号/工号 combined header', () => {
    const r = resolveRosterColumns(['学号/工号', '姓名', '性别', '单位/学院', '专业', '班级']);
    expect(r.numberCol).toBe(0);
    expect(r.nameCol).toBe(1);
    expect(r.collegeCol).toBe(3);
    expect(r.classCol).toBe(5);
  });

  it('falls back to legacy positional layout when headers are unknown', () => {
    const r = resolveRosterColumns(['A', 'B', 'C', 'D']);
    expect(r).toEqual({ collegeCol: 0, classCol: 1, numberCol: 2, nameCol: 3 });
  });

  it('name-only single column still resolves nameCol', () => {
    const r = resolveRosterColumns(['姓名']);
    expect(r.nameCol).toBe(0);
  });
});
