import { describe, it, expect } from 'vitest';
import { snapState, pushUndo, popUndo, popRedo, snapsEqual, MAX_UNDO, type BulkSnap } from './bulk-undo';

/**
 * These tests cover the pure undo/redo state machine used by CustomLayout's
 * bulk row/column enable/disable. They verify that:
 *   - disabled + seats survive a full undo/redo cycle (export-shape parity)
 *   - the cap is enforced
 *   - popping does not mutate the inputs
 *   - the redo stack receives the prior "current" state, not the restored one
 */

const grid = (rows: number, cols: number, fill: (r: number, c: number) => string | null): (string | null)[][] =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => fill(r, c)));

describe('bulk-undo: snapState', () => {
  it('captures disabled keys and seats as a deep copy', () => {
    const disabled = new Set(['0-0', '1-2']);
    const seats = grid(2, 3, (r, c) => `${r},${c}`);
    const snap = snapState(disabled, seats);

    // mutate sources after snapshotting
    disabled.add('9-9');
    seats[0][0] = 'MUTATED';

    expect(snap.disabled.sort()).toEqual(['0-0', '1-2']);
    expect(snap.seats[0][0]).toBe('0,0');
  });
});

describe('bulk-undo: push + pop round trip', () => {
  it('undo restores a previous bulk-disable, redo re-applies it', () => {
    // Initial: full grid, no disabled
    const beforeSeats = grid(3, 4, (r, c) => `s${r}${c}`);
    const beforeDisabled = new Set<string>();
    const before: BulkSnap = snapState(beforeDisabled, beforeSeats);

    // User clicks Shift+row 1 (disable row 1): seats in row 1 cleared + row keys disabled
    const afterSeats = beforeSeats.map((row, r) => row.map((v, c) => (r === 1 ? null : v)));
    const afterDisabled = new Set(['1-0', '1-1', '1-2', '1-3']);
    const after: BulkSnap = snapState(afterDisabled, afterSeats);

    // push undo snapshot of "before" right before mutating
    let undoStack: BulkSnap[] = [];
    let redoStack: BulkSnap[] = [];
    undoStack = pushUndo(undoStack, before);

    // Undo: should restore `before` and push `after` onto redo
    const undoRes = popUndo(undoStack, redoStack, after);
    expect(undoRes).not.toBeNull();
    expect(snapsEqual(undoRes!.restored, before)).toBe(true);
    expect(undoRes!.undoStack.length).toBe(0);
    expect(undoRes!.redoStack.length).toBe(1);
    expect(snapsEqual(undoRes!.redoStack[0], after)).toBe(true);

    // Redo: should restore `after` again and push `before` onto undo
    const redoRes = popRedo(undoRes!.undoStack, undoRes!.redoStack, undoRes!.restored);
    expect(redoRes).not.toBeNull();
    expect(snapsEqual(redoRes!.restored, after)).toBe(true);
    expect(redoRes!.undoStack.length).toBe(1);
    expect(snapsEqual(redoRes!.undoStack[0], before)).toBe(true);
    expect(redoRes!.redoStack.length).toBe(0);
  });

  it('returns null when stacks are empty', () => {
    const current = snapState(new Set(), grid(1, 1, () => null));
    expect(popUndo([], [], current)).toBeNull();
    expect(popRedo([], [], current)).toBeNull();
  });
});

describe('bulk-undo: cap enforcement', () => {
  it('drops the oldest entry when MAX_UNDO is exceeded', () => {
    let stack: BulkSnap[] = [];
    for (let i = 0; i < MAX_UNDO + 5; i++) {
      stack = pushUndo(stack, snapState(new Set([`${i}-0`]), grid(1, 1, () => `v${i}`)));
    }
    expect(stack.length).toBe(MAX_UNDO);
    // oldest 5 dropped → first entry should now be index 5
    expect(stack[0].disabled).toEqual(['5-0']);
    expect(stack[stack.length - 1].disabled).toEqual([`${MAX_UNDO + 4}-0`]);
  });

  it('respects a custom max', () => {
    let stack: BulkSnap[] = [];
    for (let i = 0; i < 10; i++) {
      stack = pushUndo(stack, snapState(new Set(), grid(1, 1, () => `v${i}`)), 3);
    }
    expect(stack.length).toBe(3);
    expect(stack.map(s => s.seats[0][0])).toEqual(['v7', 'v8', 'v9']);
  });
});

describe('bulk-undo: immutability', () => {
  it('popUndo does not mutate the input stacks', () => {
    const s1 = snapState(new Set(['0-0']), grid(1, 2, () => 'x'));
    const s2 = snapState(new Set(['1-1']), grid(1, 2, () => 'y'));
    const undoStack = [s1, s2];
    const redoStack: BulkSnap[] = [];
    const current = snapState(new Set(), grid(1, 2, () => 'z'));

    const before = JSON.stringify({ undoStack, redoStack });
    popUndo(undoStack, redoStack, current);
    expect(JSON.stringify({ undoStack, redoStack })).toBe(before);
  });
});

describe('bulk-undo: export-shape parity', () => {
  /** The snapshot fields persisted by buildSnapshot() that participate in
   *  bulk row/col disable are `disabledSeats` (= disabled set) and `seats`.
   *  An undo/redo round-trip must preserve both byte-for-byte so that what
   *  the user sees after undo matches what would be exported. */
  it('round-trip preserves disabledSeats + seats exactly', () => {
    const disabled = new Set(['0-0', '0-1', '2-3']);
    const seats = grid(3, 4, (r, c) => (disabled.has(`${r}-${c}`) ? null : `${r}.${c}`));
    const original = snapState(disabled, seats);

    // simulate: push -> mutate state -> undo -> redo
    const mutatedSeats = grid(3, 4, () => null);
    const mutatedDisabled = new Set(['0-0', '0-1', '0-2', '0-3']);
    const mutated = snapState(mutatedDisabled, mutatedSeats);

    let u: BulkSnap[] = pushUndo([], original);
    let r: BulkSnap[] = [];

    const undone = popUndo(u, r, mutated)!;
    expect(snapsEqual(undone.restored, original)).toBe(true);

    const redone = popRedo(undone.undoStack, undone.redoStack, undone.restored)!;
    expect(snapsEqual(redone.restored, mutated)).toBe(true);

    // The shape matches the CustomLayoutSnapshot fields used in export.
    const exportSubset = {
      disabledSeats: [...undone.restored.disabled].sort(),
      seats: undone.restored.seats,
    };
    expect(exportSubset.disabledSeats).toEqual([...disabled].sort());
    expect(exportSubset.seats).toEqual(seats);
  });
});
