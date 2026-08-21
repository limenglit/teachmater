/**
 * Helpers for cross-class (and cross-school) seating rosters.
 *
 * The classroom seat scene used to depend entirely on the live student list:
 * a snapshot only stored bare names, so restoring a history record after the
 * roster changed silently dropped seats. These helpers let a seat snapshot
 * carry its own full roster (name + gender + org/class + student number) and
 * merge it back into the workspace roster on restore.
 */

import type { Student, StudentGender } from '@/hooks/useStudentStore';

export interface SnapshotStudent {
  name: string;
  gender?: StudentGender;
  organization?: string;
  title?: string;
  studentNumber?: string;
}

/** Identity used for cross-batch duplicate detection: name + student number. */
export function studentKey(student: { name: string; studentNumber?: string }): string {
  return `${student.name.trim()}#${(student.studentNumber || '').trim()}`;
}

export function toSnapshotRoster(students: Student[]): SnapshotStudent[] {
  return students.map(s => ({
    name: s.name,
    gender: s.gender,
    organization: s.organization,
    title: s.title,
    studentNumber: s.studentNumber,
  }));
}

/**
 * Students present in the snapshot roster but missing from the live roster.
 * Restoring a history record appends these so that cross-class seat charts
 * survive even when the workspace list was replaced in the meantime.
 */
export function missingFromRoster(
  snapshotRoster: SnapshotStudent[] | undefined,
  current: Student[],
): SnapshotStudent[] {
  if (!snapshotRoster?.length) return [];
  const existing = new Set(current.map(studentKey));
  const seen = new Set<string>();
  const missing: SnapshotStudent[] = [];
  for (const entry of snapshotRoster) {
    const name = (entry?.name || '').trim();
    if (!name) continue;
    const key = studentKey({ name, studentNumber: entry.studentNumber });
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    missing.push({ ...entry, name });
  }
  return missing;
}

/** Names allowed to stay seated after a restore: live roster + snapshot roster. */
export function allowedSeatNames(
  current: Student[],
  snapshotRoster?: SnapshotStudent[],
): Set<string> {
  const names = new Set(current.map(s => s.name));
  (snapshotRoster || []).forEach(s => {
    const name = (s?.name || '').trim();
    if (name) names.add(name);
  });
  return names;
}

export interface ClassRosterSelection {
  collegeName: string;
  className: string;
  students: Array<{ name: string; studentNumber?: string | null }>;
}

/**
 * Flatten several selected classes into workspace students. The origin class
 * is kept in `organization` so seat colouring / grouping can tell the
 * different schools and classes apart in one scene.
 */
export function buildStudentsFromClasses(
  selections: ClassRosterSelection[],
  options: { dedupe?: boolean } = {},
): Student[] {
  const out: Student[] = [];
  const seen = new Set<string>();
  selections.forEach(selection => {
    const origin = [selection.collegeName, selection.className].filter(Boolean).join('·');
    selection.students.forEach(student => {
      const name = (student.name || '').trim();
      if (!name) return;
      const studentNumber = (student.studentNumber || '').trim() || undefined;
      const key = studentKey({ name, studentNumber });
      if (options.dedupe) {
        if (seen.has(key)) return;
        seen.add(key);
      }
      out.push({
        id: '',
        name,
        gender: 'unknown',
        organization: origin || undefined,
        studentNumber,
      });
    });
  });
  return out;
}

/** Combined label used for exports / watermark when several classes are loaded. */
export function combinedClassLabel(selections: ClassRosterSelection[]): string {
  const labels = selections
    .map(s => s.className || s.collegeName)
    .filter(Boolean);
  if (labels.length === 0) return '';
  if (labels.length <= 3) return labels.join('+');
  return `${labels.slice(0, 3).join('+')}等${labels.length}个班`;
}
