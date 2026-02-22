import { useState, useCallback, useEffect } from 'react';

export interface Student {
  id: string;
  name: string;
}

const STORAGE_KEY = 'teachmate_students';

const loadStudents = (): Student[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveStudents = (students: Student[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
};

// Default demo students
const DEFAULT_STUDENTS: Student[] = [
  '张思睿', '李雨桐', '王知行', '陈小星', '赵一一', '刘夏天',
  '周恬恬', '吴子涵', '郑子琪', '孙悦然', '黄晓明', '林可欣',
  '杨思远', '胡晨曦', '朱明远', '马天宇', '罗嘉怡', '谢雨霏',
  '韩冬阳', '唐一宸', '沈清秋', '许诺言', '冯晚晴', '曹书语'
].map((name, i) => ({ id: `s_${i}`, name }));

export function useStudentStore() {
  const [students, setStudents] = useState<Student[]>(() => {
    const loaded = loadStudents();
    if (loaded.length === 0) {
      saveStudents(DEFAULT_STUDENTS);
      return DEFAULT_STUDENTS;
    }
    return loaded;
  });

  useEffect(() => {
    saveStudents(students);
  }, [students]);

  const addStudent = useCallback((name: string) => {
    if (!name.trim()) return;
    setStudents(prev => [...prev, { id: `s_${Date.now()}`, name: name.trim() }]);
  }, []);

  const removeStudent = useCallback((id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateStudent = useCallback((id: string, name: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }, []);

  const clearAll = useCallback(() => {
    setStudents([]);
  }, []);

  const importFromText = useCallback((text: string) => {
    const names = text.split('\n').map(n => n.trim()).filter(Boolean);
    const newStudents = names.map((name, i) => ({ id: `s_${Date.now()}_${i}`, name }));
    setStudents(newStudents);
  }, []);

  return { students, addStudent, removeStudent, updateStudent, clearAll, importFromText };
}
