import { useState, useCallback, useEffect, useRef } from 'react';

export type StudentGender = 'male' | 'female' | 'unknown';

export interface Student {
  id: string;
  name: string;
  gender?: StudentGender;
  organization?: string;
  title?: string;
  /** Student number from the roster's 学号/编号 column, kept verbatim. */
  studentNumber?: string;
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
      const numberValid = item?.studentNumber === undefined || typeof item.studentNumber === 'string';
      return !!item && typeof item.id === 'string' && typeof item.name === 'string' && genderValid && organizationValid && titleValid && numberValid;
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

const looksLikeStandaloneName = (raw: string) => {
  const value = raw.trim();
  if (!value || normalizeGender(value) !== 'unknown') return false;
  if (!/^[\p{Script=Han}·•]{2,4}$/u.test(value)) return false;
  // Common organization / role endings. These make whitespace CSV rows such as
  // "张三 物理学院 组长" stay as one structured student row, while copied
  // multi-column name lists like "张三 李四 王五" expand to three students.
  return !/(学院|学校|中心|公司|部门|教研室|实验室|办公室|处|局|部|科|系|班|组|队|主任|老师|教师|教授|讲师|组长|副组长|班长|委员)$/.test(value);
};

const makeId = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `s_${crypto.randomUUID()}`;
      }
    } catch {
      /* ignore */
    }
    return `s_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 8)}`;
  };
})();

const buildImportStudents = (incoming: Student[]) => {
  const students: Student[] = [];
  let skipped = 0;

  incoming.forEach((student) => {
    const name = student.name.trim();
    if (!name) {
      skipped++;
      return;
    }
    // Never deduplicate by name here. In real classes multiple students can
    // share a name, and teachers may paste the missing same-name rows later;
    // name-based duplicate skipping was the root cause of fixed count losses
    // such as 30→27 and 59→49.
    students.push({ ...student, id: makeId(), name });
  });

  return { students, skipped };
};

export const parseStudentsFromText = (text: string): Student[] => {
  const normalizedText = text
    .replace(/^\uFEFF/, '')
    .replace(/\u0000/g, '');


  const lines = normalizedText
    .split(/\r\n|[\n\r\u2028\u2029]/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const splitParts = (line: string) => {
    // Keep empty cells so column indices stay aligned (e.g., empty 性别 column in CSV).
    if (/[\t,，]/.test(line)) {
      return line.split(/[\t,，]/).map(part => part.trim());
    }
    // Fallback: support "姓名 空格 性别 单位 职务" style lines.
    return line.split(/\s+/).map(part => part.trim()).filter(Boolean);
  };

  const headerParts = splitParts(lines[0]).map(part => part.toLowerCase());
  const hasHeader = headerParts.some(part => /姓名|name/.test(part));

  const getHeaderIndex = (matcher: RegExp) => headerParts.findIndex(part => matcher.test(part));
  const nameIdx = hasHeader ? getHeaderIndex(/姓名|name/) : -1;
  const genderIdx = hasHeader ? getHeaderIndex(/性别|gender|sex/) : -1;
  const orgIdx = hasHeader ? getHeaderIndex(/单位|组织|部门|company|org|organization|unit/) : -1;
  const titleIdx = hasHeader ? getHeaderIndex(/职务|职位|title|position|role/) : -1;
  const numberIdx = hasHeader
    ? headerParts.findIndex(part => /学号|学籍号|考号|工号|编号|studentid|student_no|studentno|sid|number|^no$/.test(part))
    : -1;

  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .flatMap((line, i): Student[] => {
      const parts = splitParts(line);

      if (!hasHeader && parts.length > 1 && parts.every(looksLikeStandaloneName)) {
        return parts.map(name => ({
          id: makeId(),
          name,
          gender: 'unknown' as StudentGender,
          organization: undefined,
          title: undefined,
        }));
      }

      // Headerless rows may still carry a standalone student-number column
      // ("2026001<TAB>张三" / "01 张三" / 全角 "０３ 赵六"). Pull it out so it never becomes the name.
      let numberFromParts: string | undefined;
      let valueParts = parts;
      if (!hasHeader) {
        const toHalfWidthDigits = (value: string) =>
          value.replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
        const numericAt = parts.findIndex(part => /^\d{1,12}$/.test(toHalfWidthDigits(part)));
        if (numericAt >= 0 && parts.length > 1) {
          numberFromParts = toHalfWidthDigits(parts[numericAt]);
          valueParts = parts.filter((_, idx) => idx !== numericAt);
        }
      }


      const name = (hasHeader && nameIdx >= 0 ? parts[nameIdx] : valueParts[0]) ?? '';
      if (!name) return [];

      let genderRaw: string | undefined;
      let organizationRaw: string | undefined;
      let titleRaw: string | undefined;

      if (hasHeader) {
        genderRaw = genderIdx >= 0 ? parts[genderIdx] : undefined;
        organizationRaw = orgIdx >= 0 ? parts[orgIdx] : undefined;
        titleRaw = titleIdx >= 0 ? parts[titleIdx] : undefined;
      } else {
        // No-header mode inference:
        // - 4+ columns: 姓名, 性别, 单位, 职务
        // - 3 columns: 姓名, 单位, 职务 (unless second column is clearly a gender)
        // - 2 columns: 姓名 + 性别 or 姓名 + 单位
        if (valueParts.length >= 4) {
          genderRaw = valueParts[1];
          organizationRaw = valueParts[2];
          titleRaw = valueParts[3];
        } else if (valueParts.length === 3) {
          const secondAsGender = normalizeGender(valueParts[1]);
          if (secondAsGender !== 'unknown') {
            genderRaw = valueParts[1];
            organizationRaw = valueParts[2];
          } else {
            organizationRaw = valueParts[1];
            titleRaw = valueParts[2];
          }
        } else if (valueParts.length === 2) {
          const secondAsGender = normalizeGender(valueParts[1]);
          if (secondAsGender !== 'unknown') {
            genderRaw = valueParts[1];
          } else {
            organizationRaw = valueParts[1];
          }
        }
      }

      const gender = normalizeGender(genderRaw);
      const organization = organizationRaw?.trim() || undefined;
      const title = titleRaw?.trim() || undefined;

      const studentNumber = (hasHeader && numberIdx >= 0 ? parts[numberIdx] : numberFromParts)?.trim() || undefined;

      return [{
        id: makeId(),
        name,
        gender,
        organization,
        title,
        studentNumber,
      } as Student];

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

  // Keep a live ref of `students` so imperative helpers can compute diffs
  // synchronously without waiting for React's functional updater.
  const studentsRef = useRef<Student[]>(students);
  useEffect(() => { studentsRef.current = students; }, [students]);

  useEffect(() => {
    saveStudents(storageKey, students);
  }, [storageKey, students]);

  const addStudent = useCallback((name: string, gender: StudentGender = 'unknown') => {
    if (!name.trim()) return;
    setStudents(prev => {
      const next = [...prev, { id: makeId(), name: name.trim(), gender }];
      studentsRef.current = next;
      return next;
    });
  }, []);

  const removeStudent = useCallback((id: string) => {
    setStudents(prev => {
      const next = prev.filter(s => s.id !== id);
      studentsRef.current = next;
      return next;
    });
  }, []);

  const updateStudent = useCallback((id: string, name: string) => {
    setStudents(prev => {
      const next = prev.map(s => s.id === id ? { ...s, name } : s);
      studentsRef.current = next;
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    studentsRef.current = [];
    setStudents([]);
  }, []);

  const importFromText = useCallback((text: string) => {
    const parsed = parseStudentsFromText(text);
    const { students: newStudents, skipped } = buildImportStudents(parsed);
    studentsRef.current = newStudents;
    setStudents(newStudents);
    return { added: newStudents.length, skipped, total: newStudents.length };
  }, []);

  const replaceStudents = useCallback((incoming: Student[]) => {
    const { students: next, skipped } = buildImportStudents(incoming);
    studentsRef.current = next;
    setStudents(next);
    return { added: next.length, skipped, total: next.length };
  }, []);

  // Append parsed Student objects directly. Computes counts synchronously
  // using studentsRef so callers get accurate {added, skipped}.
  const appendStudents = useCallback((incoming: Student[]) => {
    const prev = studentsRef.current;
    const { students: toAdd, skipped } = buildImportStudents(incoming);
    const added = toAdd.length;
    const next = [...prev, ...toAdd];
    studentsRef.current = next;
    setStudents(next);
    return { added, skipped, total: next.length };
  }, []);



  // Append a batch parsed from raw text.
  const appendFromText = useCallback((text: string) => {
    const parsed = parseStudentsFromText(text);
    return appendStudents(parsed);
  }, [appendStudents]);

  return { students, addStudent, removeStudent, updateStudent, clearAll, importFromText, appendFromText, appendStudents, replaceStudents };
}

