import { describe, expect, it } from 'vitest';
import { buildClassStudentInserts, chunkClassStudentInserts } from './class-roster-import';
import type { ClassRosterPreviewRow } from './roster-import';

describe('class roster backend insert helpers', () => {
  it('builds inserts for every preview row, preserving same-name students', () => {
    const names = [
      '学生01',
      '学生02', '学生02',
      '学生03', '学生03',
      ...Array.from({ length: 25 }, (_, i) => `学生${String(i + 4).padStart(2, '0')}`),
    ];
    const rows: ClassRosterPreviewRow[] = names.map((name, index) => ({
      college: '学院',
      className: '一班',
      studentNumber: String(index + 1),
      name,
    }));

    const inserts = buildClassStudentInserts(rows, 'class_1', 'user_1');

    expect(inserts).toHaveLength(30);
    expect(inserts.map(row => row.name)).toEqual(names);
    expect(inserts.filter(row => row.name === '学生02')).toHaveLength(2);
    expect(inserts.every(row => row.class_id === 'class_1' && row.user_id === 'user_1')).toBe(true);
  });

  it('chunks large registered-user class imports without dropping rows', () => {
    const inserts = Array.from({ length: 1001 }, (_, index) => ({
      class_id: 'class_1',
      user_id: 'user_1',
      name: `学生${index + 1}`,
      student_number: String(index + 1),
    }));

    const chunks = chunkClassStudentInserts(inserts, 500);

    expect(chunks.map(chunk => chunk.length)).toEqual([500, 500, 1]);
    expect(chunks.flat()).toEqual(inserts);
  });
});