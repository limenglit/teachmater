import type { BoardCard } from '@/components/BoardPanel';
import BoardCardItem from './BoardCardItem';

interface Props {
  cards: BoardCard[];
  columns: string[];
  onManage: (id: string, action: 'pin' | 'unpin' | 'delete') => void;
  onLike: (id: string) => void;
  isCreator: boolean;
  isCloud?: boolean;
}

export default function BoardKanbanView({ cards, columns, onManage, onLike, isCreator, isCloud }: Props) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {columns.map(col => {
        const colCards = cards.filter(c => c.column_id === col);
        return (
          <div key={col} className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border p-3 max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground">{col}</h4>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{colCards.length}</span>
            </div>
            <div className="space-y-3 overflow-y-auto pr-1">
              {colCards.map(card => (
                <BoardCardItem key={card.id} card={card} onManage={onManage} onLike={onLike} isCreator={isCreator} isCloud={isCloud} />
              ))}
            </div>
          </div>
        );
      })}
      {cards.filter(c => !columns.includes(c.column_id)).length > 0 && (
        <div className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border p-3 max-h-[75vh] flex flex-col">
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">—</h4>
          <div className="space-y-3 overflow-y-auto pr-1">
            {cards.filter(c => !columns.includes(c.column_id)).map(card => (
              <BoardCardItem key={card.id} card={card} onManage={onManage} onLike={onLike} isCreator={isCreator} isCloud={isCloud} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
