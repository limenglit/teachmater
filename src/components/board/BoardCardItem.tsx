import { useLanguage } from '@/contexts/LanguageContext';
import { Heart, Pin, Trash2, ExternalLink } from 'lucide-react';
import type { BoardCard } from '@/components/BoardPanel';

interface Props {
  card: BoardCard;
  onManage: (id: string, action: 'pin' | 'unpin' | 'delete') => void;
  onLike: (id: string) => void;
  isCreator: boolean;
}

export default function BoardCardItem({ card, onManage, onLike, isCreator }: Props) {
  const { t } = useLanguage();

  return (
    <div
      className="rounded-xl border border-border shadow-sm p-4 transition-all hover:shadow-md group relative"
      style={{ backgroundColor: card.color || '#ffffff' }}
    >
      {card.is_pinned && (
        <div className="absolute top-2 right-2 text-primary">
          <Pin className="w-3.5 h-3.5 fill-current" />
        </div>
      )}

      <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-2">{card.content}</p>

      {card.url && (
        <a href={card.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mb-2">
          <ExternalLink className="w-3 h-3" /> {card.url}
        </a>
      )}

      {card.media_url && (
        <img src={card.media_url} alt="" className="rounded-lg w-full max-h-40 object-cover mb-2" />
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{card.author_nickname}</span>
          <span className="mx-1">·</span>
          <span>{new Date(card.created_at).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onLike(card.id)}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded hover:bg-destructive/5"
          >
            <Heart className="w-3 h-3" /> {card.likes_count > 0 && card.likes_count}
          </button>
          {isCreator && (
            <>
              <button
                onClick={() => onManage(card.id, card.is_pinned ? 'unpin' : 'pin')}
                className="text-xs text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/5 opacity-0 group-hover:opacity-100"
              >
                <Pin className="w-3 h-3" />
              </button>
              <button
                onClick={() => onManage(card.id, 'delete')}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded hover:bg-destructive/5 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
