import { describe, it, expect } from 'vitest';
import {
  snapSeatState,
  snapsEqual,
  pushSeatUndo,
  popSeatUndo,
  popSeatRedo,
  MAX_UNDO,
  type SeatSnap,
} from './seat-undo';

const grid = (rows: number, cols: number, fill: (r: number, c: number) => string | null) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => fill(r, c)));

describe('seat-undo: snapSeatState', () => {
  it('deep-copies seats and locks/disabled', () => {
    const seats = grid(2, 2, (r, c) => `${r},${c}`);
    const disabled = new Set(['0-0']);
    const locked = new Set(['1-1']);
    const snap = snapSeatState(seats, disabled, locked);
    seats[0][0] = 'MUTATED';
    disabled.add('9-9');
    locked.add('8-8');
    expect(snap.seats[0][0]).toBe('0,0');
    expect(snap.disabled).toEqual(['0-0']);
    expect(snap.locked).toEqual(['1-1']);
  });
});

describe('seat-undo: push/pop round-trip', () => {
  it('undo restores prior state and moves current to redo', () => {
    const before = snapSeatState(grid(2, 2, () => 'a'), [], []);
    const after = snapSeatState(grid(2, 2, () => 'b'), ['0-0'], ['1-1']);

    const undoStack = pushSeatUndo([], before);
    const res = popSeatUndo(undoStack, [], after);
    expect(res).not.toBeNull();
    expect(snapsEqual(res!.restored, before)).toBe(true);
    expect(res!.undoStack.length).toBe(0);
    expect(res!.redoStack.length).toBe(1);
    expect(snapsEqual(res!.redoStack[0], after)).toBe(true);

    const redo = popSeatRedo(res!.undoStack, res!.redoStack, res!.restored);
    expect(redo).not.toBeNull();
    expect(snapsEqual(redo!.restored, after)).toBe(true);
    expect(redo!.undoStack.length).toBe(1);
    expect(redo!.redoStack.length).toBe(0);
  });

  it('returns null on empty stacks', () => {
    const cur = snapSeatState(grid(1, 1, () => null), [], []);
    expect(popSeatUndo([], [], cur)).toBeNull();
    expect(popSeatRedo([], [], cur)).toBeNull();
  });
});

describe('seat-undo: cap and dedupe', () => {
  it('drops oldest when exceeding MAX_UNDO', () => {
    let stack: SeatSnap[] = [];
    for (let i = 0; i < MAX_UNDO + 3; i++) {
      stack = pushSeatUndo(stack, snapSeatState(grid(1, 1, () => `v${i}`), [], []));
    }
    expect(stack.length).toBe(MAX_UNDO);
    expect(stack[0].seats[0][0]).toBe('v3');
    expect(stack[stack.length - 1].seats[0][0]).toBe(`v${MAX_UNDO + 2}`);
  });

  it('skips pushing a duplicate of the top', () => {
    const s = snapSeatState(grid(1, 1, () => 'x'), ['0-0'], []);
    let stack = pushSeatUndo([], s);
    stack = pushSeatUndo(stack, snapSeatState(grid(1, 1, () => 'x'), ['0-0'], []));
    expect(stack.length).toBe(1);
  });
});

describe('seat-undo: 3-step backward chain', () => {
  it('supports successive undos restoring older states in order', () => {
    const s1 = snapSeatState(grid(1, 1, () => '1'), [], []);
    const s2 = snapSeatState(grid(1, 1, () => '2'), [], []);
    const s3 = snapSeatState(grid(1, 1, () => '3'), [], []);
    const current = snapSeatState(grid(1, 1, () => '4'), [], []);

    let undo = [s1, s2, s3];
    let redo: SeatSnap[] = [];
    let cur = current;

    const r1 = popSeatUndo(undo, redo, cur)!;
    expect(r1.restored.seats[0][0]).toBe('3');
    undo = r1.undoStack;
    redo = r1.redoStack;
    cur = r1.restored;

    const r2 = popSeatUndo(undo, redo, cur)!;
    expect(r2.restored.seats[0][0]).toBe('2');
    undo = r2.undoStack;
    redo = r2.redoStack;
    cur = r2.restored;

    const r3 = popSeatUndo(undo, redo, cur)!;
    expect(r3.restored.seats[0][0]).toBe('1');
    expect(r3.undoStack.length).toBe(0);
    expect(r3.redoStack.length).toBe(3);
  });
});
