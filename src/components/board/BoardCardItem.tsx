import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Pin, Trash2, ExternalLink, MessageCircle, Send, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { BoardCard } from '@/components/BoardPanel';
import { getFileCategoryFromUrl, getFileNameFromUrl, getFileExtFromUrl, getDocIcon, getCodeIcon, getCodeLanguage } from '@/lib/board-file-utils';

interface Comment {
  id: string;
  card_id: string;
  content: string;
  author_nickname: string;
  created_at: string;
}

interface Props {
  card: BoardCard;
  onManage: (id: string, action: 'pin' | 'unpin' | 'delete') => void;
  onLike: (id: string) => void;
  isCreator: boolean;
  isCloud?: boolean;
}

export default function BoardCardItem({ card, onManage, onLike, isCreator, isCloud }: Props) {
  const { t } = useLanguage();
  const [showComments, setShowComments] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const triggerDownload = (url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || '';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadComments = async () => {
    if (!isCloud) return;
    setLoadingComments(true);
    const { data } = await supabase
      .from('board_comments')
      .select('*')
      .eq('card_id', card.id)
      .order('created_at', { ascending: true });
    if (data) setComments(data as Comment[]);
    setLoadingComments(false);
  };

  useEffect(() => {
    if (!showComments || !isCloud) return;
    loadComments();

    const channel = supabase
      .channel(`comments-${card.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'board_comments',
        filter: `card_id=eq.${card.id}`,
      }, (payload) => {
        setComments(prev => {
          if (prev.find(c => c.id === (payload.new as any).id)) return prev;
          return [...prev, payload.new as Comment];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [showComments, card.id, isCloud]);

  const submitComment = async () => {
    if (!newComment.trim() || !isCloud) return;
    const nickname = localStorage.getItem(`board-nick-${card.board_id}`) || t('board.anonymous');
    await supabase.from('board_comments').insert({
      card_id: card.id,
      content: newComment.trim(),
      author_nickname: nickname,
    });
    setNewComment('');
  };

  // Determine media type from card_type or URL
  const mediaCategory = card.media_url
    ? (card.card_type === 'video' || card.card_type === 'document' || card.card_type === 'image' || card.card_type === 'audio')
      ? card.card_type as 'image' | 'video' | 'audio' | 'document'
      : getFileCategoryFromUrl(card.media_url)
    : null;

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

      {/* Media rendering based on type */}
      {card.media_url && mediaCategory === 'image' && (
        <div className="relative mb-2">
          <img
            src={card.media_url}
            alt=""
            className="rounded-lg w-full max-h-40 object-cover cursor-zoom-in"
            onClick={() => setShowImagePreview(true)}
          />
          <button
            type="button"
            className="absolute right-2 bottom-2 p-1.5 rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              triggerDownload(card.media_url, getFileNameFromUrl(card.media_url));
            }}
            title={t('board.downloadFile')}
            aria-label={t('board.downloadFile')}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {card.media_url && mediaCategory === 'video' && (
        <video
          src={card.media_url}
          controls
          className="rounded-lg w-full max-h-48 mb-2"
          preload="metadata"
        />
      )}

      {card.media_url && mediaCategory === 'audio' && (
        <audio
          src={card.media_url}
          controls
          className="w-full mb-2"
          preload="metadata"
        />
      )}

      {card.media_url && mediaCategory === 'document' && (
        <a
          href={card.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 rounded-lg bg-muted/60 border border-border/50 mb-2 hover:bg-muted transition-colors group/doc"
        >
          <span className="text-xl">{getDocIcon(getFileExtFromUrl(card.media_url))}</span>
          <span className="flex-1 text-xs text-foreground truncate">{getFileNameFromUrl(card.media_url)}</span>
          <Download className="w-3.5 h-3.5 text-muted-foreground group-hover/doc:text-primary transition-colors" />
        </a>
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
          {isCloud && (
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/5"
            >
              <MessageCircle className="w-3 h-3" />
            </button>
          )}
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

      {/* Comments section */}
      {showComments && isCloud && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
          {loadingComments && <p className="text-xs text-muted-foreground">...</p>}
          {!loadingComments && comments.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('board.noComments')}</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="text-xs">
              <span className="font-medium text-foreground">{c.author_nickname}</span>
              <span className="text-muted-foreground mx-1">·</span>
              <span className="text-muted-foreground">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <p className="text-foreground mt-0.5">{c.content}</p>
            </div>
          ))}
          <div className="flex gap-1.5">
            <Input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder={t('board.addComment')}
              className="h-7 text-xs"
              onKeyDown={e => e.key === 'Enter' && submitComment()}
            />
            <button
              onClick={submitComment}
              disabled={!newComment.trim()}
              className="text-primary hover:text-primary/80 disabled:text-muted-foreground"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {showImagePreview && card.media_url && mediaCategory === 'image' && (
        <div
          className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowImagePreview(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-md bg-black/40 text-white hover:bg-black/60 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowImagePreview(false);
            }}
            aria-label="Close"
          >
            ✕
          </button>
          <button
            type="button"
            className="absolute top-4 left-4 p-2 rounded-md bg-black/40 text-white hover:bg-black/60 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              triggerDownload(card.media_url, getFileNameFromUrl(card.media_url));
            }}
            title={t('board.downloadFile')}
            aria-label={t('board.downloadFile')}
          >
            <Download className="w-4 h-4" />
          </button>
          <img
            src={card.media_url}
            alt=""
            className="max-w-[96vw] max-h-[92vh] object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
