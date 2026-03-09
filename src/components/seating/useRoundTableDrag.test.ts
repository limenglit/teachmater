import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useRoundTableDrag } from './useRoundTableDrag';

// Helper: wrap hook with external state
function setup(initial: string[][]) {
  let outerSet: React.Dispatch<React.SetStateAction<string[][]>>;
  const result = renderHook(() => {
    const [assignment, setAssignment] = useState(initial);
    outerSet = setAssignment;
    const drag = useRoundTableDrag(assignment, setAssignment);
    return { assignment, ...drag };
  });
  return { ...result, setAssignment: (v: string[][]) => act(() => outerSet(v)) };
}

describe('useRoundTableDrag', () => {
  // ── Basic same-table swap ───────────────────────────────
  it('swaps two seats within the same table', () => {
    const { result } = setup([['Alice', 'Bob', 'Carol']]);

    act(() => result.current.handleDragStart(0, 0)); // pick Alice
    act(() => result.current.handleDragOver(0, 2));
    act(() => result.current.handleDrop(0, 2));       // drop on Carol

    expect(result.current.assignment[0]).toEqual(['Carol', 'Bob', 'Alice']);
  });

  // ── Cross-table swap ───────────────────────────────────
  it('swaps seats across different tables', () => {
    const { result } = setup([['Alice', 'Bob'], ['Carol', 'Dave']]);

    act(() => result.current.handleDragStart(0, 0)); // pick Alice (table 0)
    act(() => result.current.handleDrop(1, 1));       // drop on Dave (table 1)

    expect(result.current.assignment[0][0]).toBe('Dave');
    expect(result.current.assignment[1][1]).toBe('Alice');
  });

  // ── Swap with empty seat ───────────────────────────────
  it('moves student to an empty seat (swap with empty string)', () => {
    const { result } = setup([['Alice', '', 'Carol']]);

    act(() => result.current.handleDragStart(0, 0));
    act(() => result.current.handleDrop(0, 1));

    expect(result.current.assignment[0]).toEqual(['', 'Alice', 'Carol']);
  });

  // ── Cross-table swap with empty seat ────────────────────
  it('moves student to empty seat on another table', () => {
    const { result } = setup([['Alice', 'Bob'], ['', 'Dave']]);

    act(() => result.current.handleDragStart(0, 0));
    act(() => result.current.handleDrop(1, 0));

    expect(result.current.assignment[0][0]).toBe('');
    expect(result.current.assignment[1][0]).toBe('Alice');
  });

  // ── No-op when no dragFrom ─────────────────────────────
  it('does nothing when handleDrop is called without prior dragStart', () => {
    const { result } = setup([['Alice', 'Bob']]);

    act(() => result.current.handleDrop(0, 1));

    expect(result.current.assignment[0]).toEqual(['Alice', 'Bob']);
  });

  // ── handleDragEnd resets state ──────────────────────────
  it('resets dragFrom and dropTarget on dragEnd', () => {
    const { result } = setup([['Alice', 'Bob']]);

    act(() => result.current.handleDragStart(0, 0));
    act(() => result.current.handleDragOver(0, 1));
    expect(result.current.dragFrom).toEqual({ table: 0, seat: 0 });
    expect(result.current.dropTarget).toEqual({ table: 0, seat: 1 });

    act(() => result.current.handleDragEnd());
    expect(result.current.dragFrom).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  // ── Drop resets drag state ──────────────────────────────
  it('clears dragFrom and dropTarget after a successful drop', () => {
    const { result } = setup([['Alice', 'Bob']]);

    act(() => result.current.handleDragStart(0, 0));
    act(() => result.current.handleDrop(0, 1));

    expect(result.current.dragFrom).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  // ── Swap is symmetric ──────────────────────────────────
  it('produces symmetric results regardless of drag direction', () => {
    // A→B
    const { result: r1 } = setup([['Alice', 'Bob']]);
    act(() => r1.current.handleDragStart(0, 0));
    act(() => r1.current.handleDrop(0, 1));

    // B→A
    const { result: r2 } = setup([['Alice', 'Bob']]);
    act(() => r2.current.handleDragStart(0, 1));
    act(() => r2.current.handleDrop(0, 0));

    // Both should result in the same final state (just swapped)
    expect(r1.current.assignment[0]).toEqual(['Bob', 'Alice']);
    expect(r2.current.assignment[0]).toEqual(['Bob', 'Alice']);
  });

  // ── Multiple sequential swaps ──────────────────────────
  it('supports multiple sequential drag-and-drop operations', () => {
    const { result } = setup([['A', 'B', 'C']]);

    // Swap A↔C
    act(() => result.current.handleDragStart(0, 0));
    act(() => result.current.handleDrop(0, 2));
    expect(result.current.assignment[0]).toEqual(['C', 'B', 'A']);

    // Swap C↔B (now at positions 0 and 1)
    act(() => result.current.handleDragStart(0, 0));
    act(() => result.current.handleDrop(0, 1));
    expect(result.current.assignment[0]).toEqual(['B', 'C', 'A']);
  });

  // ── Self-drop (same seat) ──────────────────────────────
  it('handles drop on the same seat (no change)', () => {
    const { result } = setup([['Alice', 'Bob']]);

    act(() => result.current.handleDragStart(0, 0));
    act(() => result.current.handleDrop(0, 0));

    expect(result.current.assignment[0]).toEqual(['Alice', 'Bob']);
  });

  // ── Array extension for out-of-bounds seat index ────────
  it('extends array when dropping to an index beyond current length', () => {
    const { result } = setup([['Alice']]);

    act(() => result.current.handleDragStart(0, 0));
    act(() => result.current.handleDrop(0, 3));

    expect(result.current.assignment[0][0]).toBe('');
    expect(result.current.assignment[0][3]).toBe('Alice');
  });

  // ── Preserves other tables during cross-table swap ──────
  it('does not modify unrelated tables during a swap', () => {
    const { result } = setup([['A', 'B'], ['C', 'D'], ['E', 'F']]);

    act(() => result.current.handleDragStart(0, 0));
    act(() => result.current.handleDrop(2, 1));

    expect(result.current.assignment[0]).toEqual(['F', 'B']);
    expect(result.current.assignment[1]).toEqual(['C', 'D']); // untouched
    expect(result.current.assignment[2]).toEqual(['E', 'A']);
  });

  // ── handleDragOver tracks target ────────────────────────
  it('tracks the current drop target via handleDragOver', () => {
    const { result } = setup([['A', 'B'], ['C', 'D']]);

    act(() => result.current.handleDragStart(0, 0));

    act(() => result.current.handleDragOver(0, 1));
    expect(result.current.dropTarget).toEqual({ table: 0, seat: 1 });

    act(() => result.current.handleDragOver(1, 0));
    expect(result.current.dropTarget).toEqual({ table: 1, seat: 0 });
  });
});
