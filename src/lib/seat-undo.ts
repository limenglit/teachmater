/**
 * Multi-step undo/redo stack for the classroom SeatChart.
 *
 * A snapshot captures the three pieces of state that any user-visible
 * mutation in the seat grid can change:
 *   - seats      (the 2D name grid)
 *   - disabled   (seats marked as "no chair here")
 *   - locked     (seats whose student must not be moved by auto-seat)
 *
 * The stack is plain data, deep-copied on push, capped at MAX_UNDO.
 * Pure functions — easy to unit-test, no React/DOM dependency.
 */

export type SeatGrid = (string | null)[][];

export interface SeatSnap {
  seats: SeatGrid;
  disabled: string[];
  locked: string[];
}

export const MAX_UNDO = 50;

const cloneGrid = (g: SeatGrid): SeatGrid => g.map(row => [...row]);

export function snapSeatState(
  seats: SeatGrid,
  disabled: Set<string> | string[],
  locked: Set<string> | string[]
): SeatSnap {
  return {
    seats: cloneGrid(seats),
    disabled: Array.from(disabled),
    locked: Array.from(locked),
  };
}

export function snapsEqual(a: SeatSnap, b: SeatSnap): boolean {
  if (a.seats.length !== b.seats.length) return false;
  for (let r = 0; r < a.seats.length; r++) {
    if (a.seats[r].length !== b.seats[r].length) return false;
    for (let c = 0; c < a.seats[r].length; c++) {
      if (a.seats[r][c] !== b.seats[r][c]) return false;
    }
  }
  const eqSet = (x: string[], y: string[]) => {
    if (x.length !== y.length) return false;
    const sx = [...x].sort();
    const sy = [...y].sort();
    for (let i = 0; i < sx.length; i++) if (sx[i] !== sy[i]) return false;
    return true;
  };
  return eqSet(a.disabled, b.disabled) && eqSet(a.locked, b.locked);
}

export function pushSeatUndo(stack: SeatSnap[], snap: SeatSnap, max = MAX_UNDO): SeatSnap[] {
  // Don't push duplicates of the top of the stack.
  if (stack.length > 0 && snapsEqual(stack[stack.length - 1], snap)) return stack;
  const next = [...stack, snap];
  while (next.length > max) next.shift();
  return next;
}

export interface SeatPopResult {
  undoStack: SeatSnap[];
  redoStack: SeatSnap[];
  restored: SeatSnap;
}

export function popSeatUndo(
  undoStack: SeatSnap[],
  redoStack: SeatSnap[],
  current: SeatSnap,
  max = MAX_UNDO
): SeatPopResult | null {
  if (undoStack.length === 0) return null;
  const restored = undoStack[undoStack.length - 1];
  return {
    undoStack: undoStack.slice(0, -1),
    redoStack: pushSeatUndo(redoStack, current, max),
    restored,
  };
}

export function popSeatRedo(
  undoStack: SeatSnap[],
  redoStack: SeatSnap[],
  current: SeatSnap,
  max = MAX_UNDO
): SeatPopResult | null {
  if (redoStack.length === 0) return null;
  const restored = redoStack[redoStack.length - 1];
  return {
    redoStack: redoStack.slice(0, -1),
    undoStack: pushSeatUndo(undoStack, current, max),
    restored,
  };
}
