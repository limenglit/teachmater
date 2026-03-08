import type { BoardCard } from '@/components/BoardPanel';
import BoardCardItem from './BoardCardItem';

interface Props {
  cards: BoardCard[];
  onManage: (id: string, action: 'pin' | 'unpin' | 'delete') => void;
  onLike: (id: string) => void;
  isCreator: boolean;
}

export default function BoardWallView({ cards, onManage, onLike, isCreator }: Props) {
  if (cards.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-12">No cards yet</div>;
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
      {cards.map(card => (
        <div key={card.id} className="break-inside-avoid">
          <BoardCardItem card={card} onManage={onManage} onLike={onLike} isCreator={isCreator} />
        </div>
      ))}
    </div>
  );
}
