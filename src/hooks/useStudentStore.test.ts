import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStudentStore } from './useStudentStore';

const STORAGE_KEY = 'teachmate_students';

beforeEach(() => {
  localStorage.clear();
});

describe('useStudentStore', () => {
  // Case 1: localStorage 为空时加载默认学生并写回存储
  it('loads default students and writes to storage when localStorage is empty', () => {
    const { result } = renderHook(() => useStudentStore());
    expect(result.current.students.length).toBe(24);
    expect(result.current.students[0].name).toBe('张思睿');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.length).toBe(24);
  });

  // Case 2: localStorage 非法 JSON 时回退到空数组，不抛异常
  it('falls back to empty array on invalid JSON without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{corrupted');
    // loadStudents returns [] on parse error, then defaults kick in
    const { result } = renderHook(() => useStudentStore());
    // Since loaded.length === 0, defaults are used
    expect(result.current.students.length).toBe(24);
  });

  // Case 3: addStudent 自动 trim，空字符串不新增
  it('addStudent trims input and ignores empty strings', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 's_0', name: '测试' }]));
    const { result } = renderHook(() => useStudentStore());
    
    act(() => result.current.addStudent('   '));
    expect(result.current.students.length).toBe(1);

    act(() => result.current.addStudent(''));
    expect(result.current.students.length).toBe(1);

    act(() => result.current.addStudent('  新同学  '));
    expect(result.current.students.length).toBe(2);
    expect(result.current.students[1].name).toBe('新同学');
  });

  // Case 4: removeStudent 删除指定 id
  it('removeStudent removes the student with given id', () => {
    const initial = [{ id: 's_1', name: 'A' }, { id: 's_2', name: 'B' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    const { result } = renderHook(() => useStudentStore());

    act(() => result.current.removeStudent('s_1'));
    expect(result.current.students).toEqual([{ id: 's_2', name: 'B' }]);
  });

  // Case 5: updateStudent 正确更新指定学生姓名
  it('updateStudent changes the name of specified student', () => {
    const initial = [{ id: 's_1', name: 'Old' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    const { result } = renderHook(() => useStudentStore());

    act(() => result.current.updateStudent('s_1', 'New'));
    expect(result.current.students[0].name).toBe('New');
  });

  // Case 6: importFromText 按行导入并过滤空行
  it('importFromText splits by newline and filters empty lines', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 's_0', name: 'X' }]));
    const { result } = renderHook(() => useStudentStore());

    act(() => result.current.importFromText('甲\n\n乙\n  \n丙'));
    expect(result.current.students.length).toBe(3);
    expect(result.current.students.map(s => s.name)).toEqual(['甲', '乙', '丙']);
  });
});
