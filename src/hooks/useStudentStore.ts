import { useState, useCallback, useEffect } from 'react';

export type StudentGender = 'male' | 'female' | 'unknown';

export interface Student {
  id: string;
  name: string;
  gender?: StudentGender;
  organization?: string;
  title?: string;
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
      const organizationValid = item?.organization === undefined || typeof item.organization === 'string';
      const titleValid = item?.title === undefined || typeof item.title === 'string';
      return !!item && typeof item.id === 'string' && typeof item.name === 'string' && genderValid && organizationValid && titleValid;
    });
  } catch {
    return [];
  }
};

const saveStudents = (storageKey: string, students: Student[]) => {
  localStorage.setItem(storageKey, JSON.stringify(students));
};

// Default demo students (24 total, gender-tagged for seating policy verification)
const DEFAULT_STUDENT_SEEDS: Array<{ name: string; gender: StudentGender }> = [
  { name: '张思睿', gender: 'male' },
  { name: '李雨桐', gender: 'female' },
  { name: '王知行', gender: 'male' },
  { name: '陈小星', gender: 'female' },
  { name: '赵一一', gender: 'male' },
  { name: '刘夏天', gender: 'female' },
  { name: '周恬恬', gender: 'female' },
  { name: '吴子涵', gender: 'male' },
  { name: '郑子琪', gender: 'female' },
  { name: '孙悦然', gender: 'female' },
  { name: '黄晓明', gender: 'male' },
  { name: '林可欣', gender: 'female' },
  { name: '杨思远', gender: 'male' },
  { name: '胡晨曦', gender: 'female' },
  { name: '朱明远', gender: 'male' },
  { name: '马天宇', gender: 'male' },
  { name: '罗嘉怡', gender: 'female' },
  { name: '谢雨霏', gender: 'female' },
  { name: '韩冬阳', gender: 'male' },
  { name: '唐一宸', gender: 'male' },
  { name: '沈清秋', gender: 'female' },
  { name: '许诺言', gender: 'male' },
  { name: '冯晚晴', gender: 'female' },
  { name: '曹书语', gender: 'female' },
];

const DEFAULT_STUDENTS: Student[] = DEFAULT_STUDENT_SEEDS.map((student, i) => ({ id: `s_${i}`, ...student }));

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

  const splitParts = (line: string) => {
    const byDelimiter = line
      .split(/[\t,，]/)
      .map(part => part.trim())
      .filter(Boolean);

    // Fallback: support "姓名 空格 性别 单位 职务" style lines.
    if (byDelimiter.length <= 1) {
      return line.split(/\s+/).map(part => part.trim()).filter(Boolean);
    }
    return byDelimiter;
  };

  const headerParts = splitParts(lines[0]).map(part => part.toLowerCase());
  const hasHeader = headerParts.some(part => /姓名|name/.test(part));

  const getHeaderIndex = (matcher: RegExp) => headerParts.findIndex(part => matcher.test(part));
  const nameIdx = hasHeader ? getHeaderIndex(/姓名|name/) : -1;
  const genderIdx = hasHeader ? getHeaderIndex(/性别|gender|sex/) : -1;
  const orgIdx = hasHeader ? getHeaderIndex(/单位|组织|部门|company|org|organization|unit/) : -1;
  const titleIdx = hasHeader ? getHeaderIndex(/职务|职位|title|position|role/) : -1;

  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .map((line, i) => {
      const parts = splitParts(line);

      const name = (hasHeader && nameIdx >= 0 ? parts[nameIdx] : parts[0]) ?? '';
      if (!name) return null;

      const genderRaw = hasHeader && genderIdx >= 0 ? parts[genderIdx] : parts[1];
      const organizationRaw = hasHeader && orgIdx >= 0 ? parts[orgIdx] : parts[2];
      const titleRaw = hasHeader && titleIdx >= 0 ? parts[titleIdx] : parts[3];

      const gender = normalizeGender(genderRaw);
      const organization = organizationRaw?.trim() || undefined;
      const title = titleRaw?.trim() || undefined;

      return {
        id: `s_${Date.now()}_${i}`,
        name,
        gender,
        organization,
        title,
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
