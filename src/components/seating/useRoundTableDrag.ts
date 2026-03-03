import { useState, useCallback } from 'react';

export type DragSeat = { table: number; seat: number } | null;

export function useRoundTableDrag(
  assignment: string[][],
  setAssignment: React.Dispatch<React.SetStateAction<string[][]>>
) {
  const [dragFrom, setDragFrom] = useState<DragSeat>(null);
  const [dropTarget, setDropTarget] = useState<DragSeat>(null);

  const handleDragStart = useCallback((table: number, seat: number) => {
    setDragFrom({ table, seat });
  }, []);

  const handleDragOver = useCallback((table: number, seat: number) => {
    setDropTarget({ table, seat });
  }, []);

  const handleDrop = useCallback((table: number, seat: number) => {
    if (!dragFrom) return;
    setAssignment(prev => {
      const next = prev.map(t => [...t]);
      // Swap: support cross-table swap
      const fromName = next[dragFrom.table]?.[dragFrom.seat] ?? '';
      const toName = next[table]?.[seat] ?? '';
      // Ensure arrays are long enough
      while (next[dragFrom.table].length <= dragFrom.seat) next[dragFrom.table].push('');
      while (next[table].length <= seat) next[table].push('');
      next[dragFrom.table][dragFrom.seat] = toName;
      next[table][seat] = fromName;
      return next;
    });
    setDragFrom(null);
    setDropTarget(null);
  }, [dragFrom, setAssignment]);

  const handleDragEnd = useCallback(() => {
    setDragFrom(null);
    setDropTarget(null);
  }, []);

  return { dragFrom, dropTarget, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}
