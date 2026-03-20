import { describe, expect, it } from 'vitest';
import { buildTeamBuckets } from './team-assignment';
import type { Student } from '@/hooks/useStudentStore';

const createStudents = (): Student[] => [
  { id: '1', name: 'A1', gender: 'male', organization: '单位A', title: '处长' },
  { id: '2', name: 'A2', gender: 'female', organization: '单位A', title: '副处长' },
  { id: '3', name: 'B1', gender: 'male', organization: '单位B', title: '主任' },
  { id: '4', name: 'B2', gender: 'female', organization: '单位B', title: '科员' },
  { id: '5', name: 'C1', gender: 'male', organization: '单位C', title: '讲师' },
  { id: '6', name: 'C2', gender: 'female', organization: '单位C', title: '助教' },
];

describe('buildTeamBuckets', () => {
  it('keeps all students with no duplicates for random strategy', () => {
    const students = createStudents();
    const buckets = buildTeamBuckets(students, { strategy: 'random', bucketCount: 3 });
    const ids = buckets.flat().map(s => s.id);
    expect(ids).toHaveLength(students.length);
    expect(new Set(ids).size).toBe(students.length);
  });

  it('groups same organization together when sameOrganization is used', () => {
    const students = createStudents();
    const buckets = buildTeamBuckets(students, { strategy: 'sameOrganization', bucketCount: 3 });
    buckets.forEach(bucket => {
      const orgs = new Set(bucket.map(s => s.organization));
      expect(orgs.size).toBeLessThanOrEqual(1);
    });
  });

  it('balances gender across buckets when balancedGender is used', () => {
    const students = createStudents();
    const buckets = buildTeamBuckets(students, { strategy: 'balancedGender', bucketCount: 3 });
    const maleCounts = buckets.map(bucket => bucket.filter(s => s.gender === 'male').length);
    const femaleCounts = buckets.map(bucket => bucket.filter(s => s.gender === 'female').length);
    expect(Math.max(...maleCounts) - Math.min(...maleCounts)).toBeLessThanOrEqual(1);
    expect(Math.max(...femaleCounts) - Math.min(...femaleCounts)).toBeLessThanOrEqual(1);
  });
});
