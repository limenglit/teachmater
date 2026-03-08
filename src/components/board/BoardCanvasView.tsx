import { useState, useRef } from 'react';
import { Heart, Pin, Trash2 } from 'lucide-react';
import type { BoardCard } from '@/components/BoardPanel';

interface Props {
  cards: BoardCard[];
  onManage: (id: string, action: 'pin' | 'unpin' | 'delete') => void;
  onLike: (id: string) => void;
  isCreator: boolean;
}

export default function BoardCanvasView({ cards, onManage, onLike, isCreator }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const dragOffset = useRef({ x: 0, y: 0 });

  const getPos = (card: BoardCard) => positions[card.id] || { x: card.position_x, y: card.position_y };

  const handleMouseDown = (e: React.MouseEvent, cardId: string) => {
    const pos = positions[cardId] || cards.find(c => c.id === cardId)!;
    const cardPos = getPos(cards.find(c => c.id === cardId)!);
    dragOffset.current = { x: e.clientX - cardPos.x, y: e.clientY - cardPos.y };
    setDragging(cardId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPositions(prev => ({
      ...prev,
      [dragging]: { x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y },
    }));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full min-h-[600px] bg-muted/20 rounded-xl border border-border overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {cards.map(card => {
        const pos = getPos(card);
        return (
          <div
            key={card.id}
            className="absolute w-52 rounded-xl border border-border shadow-sm p-3 cursor-move select-none transition-shadow hover:shadow-md"
            style={{
              left: pos.x,
              top: pos.y,
              backgroundColor: card.color || '#ffffff',
              zIndex: dragging === card.id ? 50 : card.is_pinned ? 10 : 1,
            }}
            onMouseDown={(e) => handleMouseDown(e, card.id)}
          >
            {card.is_pinned && <Pin className="w-3 h-3 text-primary absolute top-1 right-1 fill-current" />}
            <p className="text-xs text-foreground whitespace-pre-wrap break-words mb-1.5">{card.content}</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{card.author_nickname}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => onLike(card.id)} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5">
                  <Heart className="w-2.5 h-2.5" /> {card.likes_count > 0 && card.likes_count}
                </button>
                {isCreator && (
                  <button onClick={() => onManage(card.id, 'delete')} className="text-[10px] text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {cards.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          No cards yet
        </div>
      )}
    </div>
  );
}
