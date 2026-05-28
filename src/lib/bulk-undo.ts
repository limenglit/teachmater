/**
 * Pure helpers for the CustomLayout bulk row/column enable/disable
 * undo + redo stack. Snapshots persist exactly what is exported in the
 * seat-history snapshot (disabled set + seats grid) so undo/redo state
 * stays consistent with what `buildSnapshot` writes to history.
 */

export type BulkSnap = {
  disabled: string[];
  seats: (string | null)[][];
};

export const MAX_UNDO = 50;

export function snapState(disabled: Set<string> | string[], seats: (string | null)[][]): BulkSnap {
  return {
    disabled: Array.from(disabled),
    seats: seats.map(row => [...row]),
  };
}

/** Returns a new undo stack with `snap` appended, capped at `max`. */
export function pushUndo(stack: BulkSnap[], snap: BulkSnap, max = MAX_UNDO): BulkSnap[] {
  const next = [...stack, snap];
  while (next.length > max) next.shift();
  return next;
}

export interface PopResult {
  undoStack: BulkSnap[];
  redoStack: BulkSnap[];
  restored: BulkSnap;
}

/**
 * Pop the most recent undo entry. The caller passes the current state so it
 * can be moved onto the redo stack atomically.
 * Returns null if there is nothing to undo.
 */
export function popUndo(
  undoStack: BulkSnap[],
  redoStack: BulkSnap[],
  current: BulkSnap,
  max = MAX_UNDO
): PopResult | null {
  if (undoStack.length === 0) return null;
  const restored = undoStack[undoStack.length - 1];
  return {
    undoStack: undoStack.slice(0, -1),
    redoStack: pushUndo(redoStack, current, max),
    restored,
  };
}

/** Symmetric counterpart of `popUndo`. */
export function popRedo(
  undoStack: BulkSnap[],
  redoStack: BulkSnap[],
  current: BulkSnap,
  max = MAX_UNDO
): PopResult | null {
  if (redoStack.length === 0) return null;
  const restored = redoStack[redoStack.length - 1];
  return {
    redoStack: redoStack.slice(0, -1),
    undoStack: pushUndo(undoStack, current, max),
    restored,
  };
}

/** Deep-equality for snapshots — used by tests to assert round-trip parity. */
export function snapsEqual(a: BulkSnap, b: BulkSnap): boolean {
  if (a.disabled.length !== b.disabled.length) return false;
  const sa = [...a.disabled].sort();
  const sb = [...b.disabled].sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  if (a.seats.length !== b.seats.length) return false;
  for (let r = 0; r < a.seats.length; r++) {
    if (a.seats[r].length !== b.seats[r].length) return false;
    for (let c = 0; c < a.seats[r].length; c++) {
      if (a.seats[r][c] !== b.seats[r][c]) return false;
    }
  }
  return true;
}
