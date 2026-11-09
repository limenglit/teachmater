/** Shared helpers: drag a student from the roster sidebar into a group / team. */
import { readDraggedStudentName } from './seat-name-drop';

export const STUDENT_ID_MIME = 'application/x-student-id';

export interface RosterStudent { id: string; name: string }

export function resolveRosterStudent(
  id: string | null | undefined,
  name: string | null | undefined,
  students: RosterStudent[],
): RosterStudent | null {
  if (id) {
    const s = students.find(x => x.id === id);
    if (s) return { id: s.id, name: s.name };
  }
  if (name) {
    const s = students.find(x => x.name === name);
    if (s) return { id: s.id, name: s.name };
  }
  return null;
}

export function readDraggedRosterStudent(e: React.DragEvent, students: RosterStudent[]): RosterStudent | null {
  let id: string | null = null;
  try { id = e.dataTransfer.getData(STUDENT_ID_MIME) || null; } catch {}
  return resolveRosterStudent(id, readDraggedStudentName(e), students);
}

interface Member { id: string; name: string }
interface Container<M extends Member> { id: string; members: M[] }

/**
 * Move/insert a roster student into target container at insertIdx.
 * Removes the student from any other container first (title cleared via makeMember).
 */
export function applyStudentToGroups<M extends Member, G extends Container<M>>(
  groups: G[],
  student: RosterStudent,
  targetId: string,
  insertIdx: number,
  makeMember: (s: RosterStudent) => M,
): G[] {
  if (!groups.some(g => g.id === targetId)) return groups;
  let existing: M | null = null;
  let srcIdx = -1;
  let srcGroup: string | null = null;
  const stripped = groups.map(g => {
    const i = g.members.findIndex(m => m.id === student.id);
    if (i < 0) return g;
    existing = g.members[i];
    srcIdx = i;
    srcGroup = g.id;
    return { ...g, members: g.members.filter((_, j) => j !== i) };
  });
  return stripped.map(g => {
    if (g.id !== targetId) return g;
    let idx = insertIdx;
    if (srcGroup === targetId && srcIdx >= 0 && srcIdx < insertIdx) idx -= 1;
    idx = Math.max(0, Math.min(idx, g.members.length));
    const member = srcGroup === targetId && existing ? existing : makeMember(student);
    const members = [...g.members];
    members.splice(idx, 0, member);
    return { ...g, members };
  });
}
