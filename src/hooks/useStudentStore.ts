import { useState, useCallback, useEffect } from 'react';

export type StudentGender = 'male' | 'female' | 'unknown';

export interface Student {
  id: string;
  name: string;
  gender?: StudentGender;
}

const STORAGE_KEY_PREFIX = 'teachmate_students';

const getStorageKey = (userId?: string | null) => {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
};

const loadStudents = (storageKey: string): Student[] => {
  try {
    const data = localStorage.getItem(storageKey);
    const parsed = data ? JSON.parse(data) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Student => {
      const genderValid = item?.gender === undefined || item?.gender === 'male' || item?.gender === 'female' || item?.gender === 'unknown';
      return !!item && typeof item.id === 'string' && typeof item.name === 'string' && genderValid;
    });
  } catch {
    return [];
  }
};

const saveStudents = (storageKey: string, students: Student[]) => {
  localStorage.setItem(storageKey, JSON.stringify(students));
};

// Default demo students
const DEFAULT_STUDENTS: Student[] = [
  '张思睿', '李雨桐', '王知行', '陈小星', '赵一一', '刘夏天',
  '周恬恬', '吴子涵', '郑子琪', '孙悦然', '黄晓明', '林可欣',
  '杨思远', '胡晨曦', '朱明远', '马天宇', '罗嘉怡', '谢雨霏',
  '韩冬阳', '唐一宸', '沈清秋', '许诺言', '冯晚晴', '曹书语'
].map((name, i) => ({ id: `s_${i}`, name }));

const EMPTY_STUDENTS: Student[] = [];

const normalizeGender = (raw?: string): StudentGender => {
  if (!raw) return 'unknown';
  const value = raw.trim().toLowerCase();
  if (['男', '男生', 'm', 'male'].includes(value)) return 'male';
  if (['女', '女生', 'f', 'female'].includes(value)) return 'female';
  return 'unknown';
};

const parseStudentsFromText = (text: string): Student[] => {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const hasHeader = /姓名|name/i.test(lines[0]) && /性别|gender|sex/i.test(lines[0]);
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .map((line, i) => {
      const parts = line
        .split(/[\t,，]/)
        .map(part => part.trim())
        .filter(Boolean);

      const name = parts[0] ?? '';
      if (!name) return null;

      const gender = normalizeGender(parts[1]);
      return {
        id: `s_${Date.now()}_${i}`,
        name,
        gender,
      } as Student;
    })
    .filter((student): student is Student => !!student);
};

export function useStudentStore(userId?: string | null) {
  const storageKey = getStorageKey(userId);
  const fallbackStudents = userId ? EMPTY_STUDENTS : DEFAULT_STUDENTS;

  const [students, setStudents] = useState<Student[]>(() => {
    const loaded = loadStudents(storageKey);

    // Migrate legacy key to the first authenticated key when possible.
    if (loaded.length === 0 && userId) {
      const legacyLoaded = loadStudents(STORAGE_KEY_PREFIX);
      if (legacyLoaded.length > 0) {
        saveStudents(storageKey, legacyLoaded);
        return legacyLoaded;
      }
    }

    if (loaded.length === 0) {
      saveStudents(storageKey, fallbackStudents);
      return fallbackStudents;
    }
    return loaded;
  });

  useEffect(() => {
    const loaded = loadStudents(storageKey);
    if (loaded.length === 0) {
      if (userId) {
        const legacyLoaded = loadStudents(STORAGE_KEY_PREFIX);
        if (legacyLoaded.length > 0) {
          setStudents(legacyLoaded);
          return;
        }
      }
      setStudents(fallbackStudents);
      return;
    }
    setStudents(loaded);
  }, [storageKey, userId, fallbackStudents]);

  useEffect(() => {
    saveStudents(storageKey, students);
  }, [storageKey, students]);

  const addStudent = useCallback((name: string, gender: StudentGender = 'unknown') => {
    if (!name.trim()) return;
    setStudents(prev => [...prev, { id: `s_${Date.now()}`, name: name.trim(), gender }]);
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
    const newStudents = parseStudentsFromText(text);
    setStudents(newStudents);
  }, []);

  return { students, addStudent, removeStudent, updateStudent, clearAll, importFromText };
}
