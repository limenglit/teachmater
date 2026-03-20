import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStudentStore } from './useStudentStore';

const STORAGE_KEY = 'teachmate_students';
const USER_KEY = (userId: string) => `teachmate_students:${userId}`;

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

  // Case 6.0: 支持仅 CR 和 Unicode 换行分隔，避免整文件被当成一行
  it('importFromText supports CR-only and Unicode line separators', () => {
    const { result } = renderHook(() => useStudentStore());

    act(() => result.current.importFromText('韩新月\r王梦茹\r王晨甜'));
    expect(result.current.students.map(s => s.name)).toEqual(['韩新月', '王梦茹', '王晨甜']);

    act(() => result.current.importFromText('甲\u2028乙\u2029丙'));
    expect(result.current.students.map(s => s.name)).toEqual(['甲', '乙', '丙']);
  });

  // Case 6.1: 无表头三列数据按 姓名/单位/职务 解析
  it('importFromText infers name, organization and title for 3-column rows without header', () => {
    const { result } = renderHook(() => useStudentStore());

    act(() => result.current.importFromText('张三,教务处,处长\n李四,信息中心,科长'));

    expect(result.current.students.length).toBe(2);
    expect(result.current.students[0].name).toBe('张三');
    expect(result.current.students[0].organization).toBe('教务处');
    expect(result.current.students[0].title).toBe('处长');
    expect(result.current.students[0].gender).toBe('unknown');
  });

  // Case 6.2: 带表头时按列名解析 姓名/单位/职务
  it('importFromText maps fields by header names for name, organization and title', () => {
    const { result } = renderHook(() => useStudentStore());

    act(() => result.current.importFromText('姓名,单位,职务\n王五,后勤处,主任'));

    expect(result.current.students.length).toBe(1);
    expect(result.current.students[0].name).toBe('王五');
    expect(result.current.students[0].organization).toBe('后勤处');
    expect(result.current.students[0].title).toBe('主任');
    expect(result.current.students[0].gender).toBe('unknown');
  });

  // Case 7: 注册用户优先使用其专属最近名单
  it('loads user-specific recent students after login', () => {
    localStorage.setItem(USER_KEY('u_1'), JSON.stringify([{ id: 's_u1', name: '用户A名单' }]));

    const { result } = renderHook(() => useStudentStore('u_1'));
    expect(result.current.students).toEqual([{ id: 's_u1', name: '用户A名单' }]);
  });

  // Case 8: 登录切换用户后自动切到该用户最近名单
  it('switches list automatically when user id changes', () => {
    localStorage.setItem(USER_KEY('u_1'), JSON.stringify([{ id: 'u1_1', name: '名单1' }]));
    localStorage.setItem(USER_KEY('u_2'), JSON.stringify([{ id: 'u2_1', name: '名单2' }]));

    const { result, rerender } = renderHook(({ userId }) => useStudentStore(userId), {
      initialProps: { userId: 'u_1' as string | null },
    });

    expect(result.current.students[0].name).toBe('名单1');

    rerender({ userId: 'u_2' });
    expect(result.current.students[0].name).toBe('名单2');
  });

  // Case 9: 首次登录无专属名单时，迁移旧通用名单到用户空间
  it('migrates legacy shared list to authenticated user key on first login', () => {
    const legacy = [{ id: 'legacy_1', name: '旧名单' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const { result } = renderHook(() => useStudentStore('u_3'));
    expect(result.current.students).toEqual(legacy);

    const userStored = JSON.parse(localStorage.getItem(USER_KEY('u_3')) || '[]');
    expect(userStored).toEqual(legacy);
  });

  // Case 10: 登录用户无历史时，不回退测试24人名单
  it('uses empty list for authenticated users without history', () => {
    const { result } = renderHook(() => useStudentStore('u_4'));
    expect(result.current.students).toEqual([]);
    const stored = JSON.parse(localStorage.getItem(USER_KEY('u_4')) || '[]');
    expect(stored).toEqual([]);
  });
});
