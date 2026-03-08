import type { BoardCard } from '@/components/BoardPanel';
import BoardCardItem from './BoardCardItem';

interface Props {
  cards: BoardCard[];
  onManage: (id: string, action: 'pin' | 'unpin' | 'delete') => void;
  onLike: (id: string) => void;
  isCreator: boolean;
  isCloud?: boolean;
}

export default function BoardTimelineView({ cards, onManage, onLike, isCreator, isCloud }: Props) {
  const sorted = [...cards].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (sorted.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-12">No cards yet</div>;
  }

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-6">
        {sorted.map(card => (
          <div key={card.id} className="relative flex gap-4 pl-12">
            <div className="absolute left-3.5 top-4 w-3 h-3 rounded-full bg-primary border-2 border-background" />
            <div className="flex-shrink-0 text-xs text-muted-foreground pt-3 w-20">
              {new Date(card.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="flex-1">
              <BoardCardItem card={card} onManage={onManage} onLike={onLike} isCreator={isCreator} isCloud={isCloud} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
