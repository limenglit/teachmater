import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PendingMembersPanelProps {
  title: string;
  hint: string;
  fillLabel: string;
  people: { id: string; name: string }[];
  onFill: () => void;
  onChipDragStart: (index: number, e: React.DragEvent) => void;
  onChipDragEnd?: () => void;
  onChipDoubleClick?: (index: number) => void;
  onDropBack?: (e: React.DragEvent) => void;
}

/**
 * Lists roster students that are not placed yet. Nothing is added
 * automatically: the teacher clicks the fill button or drags a chip.
 * Never part of exports (data-export-exclude).
 */
export default function PendingMembersPanel({
  title, hint, fillLabel, people, onFill, onChipDragStart, onChipDragEnd, onChipDoubleClick, onDropBack,
}: PendingMembersPanelProps) {
  if (people.length === 0) return null;
  return (
    <div
      data-export-exclude
      data-pending-panel
      className="mb-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5"
      onDragOver={onDropBack ? e => e.preventDefault() : undefined}
      onDrop={onDropBack}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <Button size="sm" onClick={onFill} className="gap-1.5 h-8">
          <UserPlus className="w-4 h-4" /> {fillLabel}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {people.map((p, i) => (
          <button
            key={`${p.id}-${i}`}
            type="button"
            draggable
            data-pending-chip={p.name}
            onDragStart={e => onChipDragStart(i, e)}
            onDragEnd={onChipDragEnd}
            onDoubleClick={onChipDoubleClick ? () => onChipDoubleClick(i) : undefined}
            className="px-2.5 py-1 rounded-md border border-primary/40 bg-background text-xs text-foreground shadow-xs cursor-grab active:cursor-grabbing hover:border-primary"
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
