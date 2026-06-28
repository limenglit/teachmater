import { memo } from 'react';

export interface SeatCellProps {
  r: number;
  c: number;
  name: string | null;
  isDisabled: boolean;
  isDropTarget: boolean;
  color?: string;
  title: string;
  disabledLabel: string;
  onDragStart: (r: number, c: number) => void;
  onDragOver: (e: React.DragEvent, r: number, c: number) => void;
  onDrop: (e: React.DragEvent, r: number, c: number) => void;
  onDragEnd: () => void;
  onShiftClick: (r: number, c: number) => void;
}

/**
 * Memoized seat cell.
 *
 * Performance: in a wide layout (e.g. 1×40 to 30×100) the previous inline
 * render re-created every seat on every drag-over because `dropTarget`
 * changed at the parent. With `React.memo` only the two cells whose
 * `isDropTarget` actually flipped re-render per pointer move.
 */
function SeatCellInner({
  r, c, name, isDisabled, isDropTarget, color, title, disabledLabel,
  onDragStart, onDragOver, onDrop, onDragEnd, onShiftClick,
}: SeatCellProps) {
  return (
    <div
      draggable={!!name}
      onDragStart={() => onDragStart(r, c)}
      onDragOver={(e) => onDragOver(e, r, c)}
      onDrop={(e) => onDrop(e, r, c)}
      onDragEnd={onDragEnd}
      onClick={(e) => { if (e.shiftKey) onShiftClick(r, c); }}
      title={title}
      className={[
        'select-none cursor-pointer rounded-md border text-[11px] leading-tight px-1 py-1.5 flex items-center justify-center text-center min-h-[36px] w-[60px]',
        isDisabled
          ? 'bg-muted/40 border-dashed border-muted-foreground/40 text-muted-foreground'
          : name
            ? 'bg-card border-border hover:border-primary/60'
            : 'bg-muted/20 border-border/40 text-muted-foreground',
        isDropTarget ? 'ring-2 ring-primary' : '',
      ].join(' ')}
      style={name && color ? { color } : undefined}
    >
      {isDisabled ? '✕' : (name || `${r + 1}-${c + 1}`)}
    </div>
  );
}

export const SeatCell = memo(SeatCellInner);
SeatCell.displayName = 'SeatCell';
