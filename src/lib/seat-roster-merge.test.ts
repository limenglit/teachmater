import { describe, it, expect } from 'vitest';
import {
  buildStudentsFromClasses,
  combinedClassLabel,
  missingFromRoster,
  allowedSeatNames,
  toSnapshotRoster,
} from './seat-roster-merge';
import type { Student } from '@/hooks/useStudentStore';

const s = (name: string, extra: Partial<Student> = {}): Student => ({ id: name, name, ...extra });

describe('buildStudentsFromClasses', () => {
  const selections = [
    { collegeName: 'A大学', className: '一班', students: [{ name: '张三', studentNumber: '01' }, { name: '李四' }] },
    { collegeName: 'B学院', className: '二班', students: [{ name: '张三', studentNumber: '99' }, { name: '王五' }] },
  ];

  it('merges multiple classes and tags their origin', () => {
    const out = buildStudentsFromClasses(selections);
    expect(out).toHaveLength(4);
    expect(out[0].organization).toBe('A大学·一班');
    expect(out[2].organization).toBe('B学院·二班');
  });

  it('keeps same-name students from different classes even when de-duping', () => {
    const out = buildStudentsFromClasses(selections, { dedupe: true });
    expect(out.map(x => x.name)).toEqual(['张三', '李四', '张三', '王五']);
  });

  it('drops exact name+number duplicates when de-duping', () => {
    const out = buildStudentsFromClasses(
      [
        { collegeName: 'A', className: '1', students: [{ name: '张三', studentNumber: '01' }] },
        { collegeName: 'A', className: '1', students: [{ name: '张三', studentNumber: '01' }] },
      ],
      { dedupe: true },
    );
    expect(out).toHaveLength(1);
  });

  it('builds a combined label', () => {
    expect(combinedClassLabel(selections)).toBe('一班+二班');
  });
});

describe('snapshot roster restore', () => {
  it('finds students missing from the live roster', () => {
    const snapshot = toSnapshotRoster([s('张三', { studentNumber: '01' }), s('李四')]);
    const missing = missingFromRoster(snapshot, [s('李四')]);
    expect(missing.map(m => m.name)).toEqual(['张三']);
  });

  it('keeps seats valid for snapshot-only students', () => {
    const snapshot = toSnapshotRoster([s('张三'), s('李四')]);
    const names = allowedSeatNames([s('王五')], snapshot);
    expect(names.has('张三')).toBe(true);
    expect(names.has('王五')).toBe(true);
  });

  it('returns nothing when snapshot has no roster (legacy records)', () => {
    expect(missingFromRoster(undefined, [s('张三')])).toEqual([]);
    expect(allowedSeatNames([s('张三')])).toEqual(new Set(['张三']));
  });
});
