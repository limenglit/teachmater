/**
 * Shared helpers for "drag student name from roster sidebar → seat".
 *
 * The sidebar (see StudentSidebar.tsx) sets these DataTransfer payloads
 * when dragging a student row:
 *   - text/plain              -> "student:<name>"
 *   - application/x-student-name -> "<name>"
 *
 * Each seat scene can call these helpers from its seat's onDragOver / onDrop
 * without knowing the underlying grid shape.
 */

export const STUDENT_DRAG_MIME = 'application/x-student-name';
export const STUDENT_DRAG_PREFIX = 'student:';

/** True if the current drag event carries a student name payload from the sidebar. */
export function isStudentDrag(e: React.DragEvent): boolean {
  try {
    const types = e.dataTransfer.types;
    if (types && Array.from(types).includes(STUDENT_DRAG_MIME)) return true;
    const raw = e.dataTransfer.getData('text/plain');
    return typeof raw === 'string' && raw.startsWith(STUDENT_DRAG_PREFIX);
  } catch {
    return false;
  }
}

/** Read the dragged student name from the event, or return null. */
export function readDraggedStudentName(e: React.DragEvent): string | null {
  try {
    const direct = e.dataTransfer.getData(STUDENT_DRAG_MIME);
    if (direct) return direct;
    const raw = e.dataTransfer.getData('text/plain');
    if (raw && raw.startsWith(STUDENT_DRAG_PREFIX)) {
      return raw.slice(STUDENT_DRAG_PREFIX.length);
    }
  } catch {}
  return null;
}

/** Standard onDragOver handler: allow drop when the payload is a student name. */
export function acceptStudentDragOver(
  e: React.DragEvent,
  opts: { disabled?: boolean } = {},
): boolean {
  if (opts.disabled) return false;
  if (!isStudentDrag(e)) return false;
  e.preventDefault();
  e.stopPropagation();
  try { e.dataTransfer.dropEffect = 'move'; } catch {}
  return true;
}

/**
 * Place `name` at (targetR, targetC) inside a 2D `string[][]` seat grid.
 * If the student already exists elsewhere, swap with the target;
 * if the target seat holds someone else, that person is evicted (returned to roster).
 *
 * Empty cells are represented by "" (compatible with round-table scenes) or null.
 */
export function applyStudentDropToGrid<T extends (string | null)[][]>(
  grid: T,
  name: string,
  targetR: number,
  targetC: number,
): T {
  if (!grid[targetR]) return grid;
  const next = grid.map(row => [...row]) as T;
  // Find any existing occurrence of the student.
  let existingR = -1;
  let existingC = -1;
  for (let r = 0; r < next.length; r++) {
    const row = next[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === name) { existingR = r; existingC = c; break; }
    }
    if (existingR >= 0) break;
  }
  const empty = typeof next[targetR][targetC] === 'string' ? '' : null;
  const targetPrev = next[targetR][targetC];
  next[targetR][targetC] = name as any;
  if (existingR >= 0 && !(existingR === targetR && existingC === targetC)) {
    // Swap: move whatever was in the target seat back to the student's old seat.
    next[existingR][existingC] = (targetPrev ?? empty) as any;
  }
  return next;
}
