import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { tFormat } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Heart, ExternalLink, Download } from 'lucide-react';
import type { BoardCard } from '@/components/BoardPanel';
import { getFileCategoryFromUrl, getFileNameFromUrl, getFileExtFromUrl, getDocIcon } from '@/lib/board-file-utils';

interface Props {
  cards: BoardCard[];
  onExit: () => void;
}

export default function BoardPPTMode({ cards, onExit }: Props) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const exitFullscreenAndClose = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().then(onExit).catch(onExit);
    } else {
      onExit();
    }
  }, [onExit]);

  // Enter fullscreen on mount
  useEffect(() => {
    const el = containerRef.current;
    if (el && !document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // Listen for fullscreen exit (e.g. pressing Escape natively)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) onExit();
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [onExit]);

  if (cards.length === 0) {
    return (
      <div ref={containerRef} className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No cards to display</p>
          <Button onClick={exitFullscreenAndClose}>{t('board.pptExit')}</Button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const prev = () => setIndex(i => Math.max(0, i - 1));
  const next = () => setIndex(i => Math.min(cards.length - 1, i + 1));

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8"
      style={{ backgroundColor: card.color || 'hsl(var(--background))' }}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
        if (e.key === 'Escape') exitFullscreenAndClose();
      }}
      tabIndex={0}
      autoFocus
    >
      {/* Close button */}
      <button onClick={exitFullscreenAndClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-foreground/10 transition-colors">
        <X className="w-6 h-6 text-foreground" />
      </button>

      {/* Slide counter */}
      <div className="absolute top-4 left-4 text-sm text-muted-foreground font-medium">
        {tFormat(t('board.pptSlide'), index + 1, cards.length)}
      </div>

      {/* Card content */}
      <div className="max-w-3xl w-full text-center space-y-6">
        <p className="text-3xl sm:text-5xl font-bold text-foreground leading-tight whitespace-pre-wrap">
          {card.content}
        </p>

        {card.url && (
          <a href={card.url} target="_blank" rel="noopener noreferrer" className="text-lg text-primary hover:underline inline-flex items-center gap-2">
            <ExternalLink className="w-5 h-5" /> {card.url}
          </a>
        )}

        {card.media_url && (() => {
          const cat = (card.card_type === 'video' || card.card_type === 'document' || card.card_type === 'image' || card.card_type === 'audio')
            ? card.card_type as string : getFileCategoryFromUrl(card.media_url);
          if (cat === 'image') return <img src={card.media_url} alt="" className="rounded-2xl max-h-[40vh] mx-auto object-contain" />;
          if (cat === 'video') return <video src={card.media_url} controls className="rounded-2xl max-h-[40vh] mx-auto" />;
          if (cat === 'audio') return <audio src={card.media_url} controls className="w-full max-w-xl mx-auto" preload="metadata" />;
          return (
            <a href={card.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors">
              <span className="text-3xl">{getDocIcon(getFileExtFromUrl(card.media_url))}</span>
              <span className="text-lg text-foreground">{getFileNameFromUrl(card.media_url)}</span>
              <Download className="w-5 h-5 text-muted-foreground" />
            </a>
          );
        })()}

        <div className="flex items-center justify-center gap-4 text-muted-foreground text-sm">
          <span className="font-medium">{card.author_nickname}</span>
          <span>·</span>
          <span>{new Date(card.created_at).toLocaleString()}</span>
          {card.likes_count > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {card.likes_count}</span>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="absolute bottom-8 flex items-center gap-4">
        <Button variant="outline" size="lg" onClick={prev} disabled={index === 0} className="gap-2">
          <ChevronLeft className="w-5 h-5" /> {t('board.pptPrev')}
        </Button>
        <Button variant="outline" size="lg" onClick={next} disabled={index === cards.length - 1} className="gap-2">
          {t('board.pptNext')} <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
