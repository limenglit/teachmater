import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { tFormat } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Heart, ExternalLink, Download, Maximize2 } from 'lucide-react';
import type { BoardCard } from '@/components/BoardPanel';
import { getFileCategoryFromUrl, getFileNameFromUrl, getFileExtFromUrl, getDocIcon } from '@/lib/board-file-utils';
import { fetchCodePreviewText } from '@/lib/code-preview';
import { lazyRetry } from '@/lib/lazy-retry';

interface Props {
  cards: BoardCard[];
  onExit: () => void;
}

const CodeHighlight = lazyRetry(() => import('@/components/board/CodeHighlight'));

export default function BoardPPTMode({ cards, onExit }: Props) {
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [codeText, setCodeText] = useState('');
  const [codeExt, setCodeExt] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [codeFontSize, setCodeFontSize] = useState(16);
  const [previewFontSize, setPreviewFontSize] = useState(18);
  const containerRef = useRef<HTMLDivElement>(null);

  const triggerDownload = useCallback((url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || '';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') prev();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'Escape') exitFullscreenAndClose();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [exitFullscreenAndClose, next, prev]);

  const safeIndex = cards.length === 0 ? 0 : Math.min(index, cards.length - 1);
  const card = cards[safeIndex];
  const mediaCategory = card?.media_url
    ? (card.card_type === 'video' || card.card_type === 'document' || card.card_type === 'image' || card.card_type === 'audio' || card.card_type === 'code')
      ? card.card_type
      : getFileCategoryFromUrl(card.media_url)
    : null;

  useEffect(() => {
    setShowImagePreview(false);
    setShowCodePreview(false);
  }, [safeIndex]);

  useEffect(() => {
    if (!card?.media_url || mediaCategory !== 'code') {
      setCodeText('');
      setCodeExt('');
      setCodeLoading(false);
      return;
    }

    let cancelled = false;
    const nextExt = getFileExtFromUrl(card.media_url);

    setCodeExt(nextExt);
    setCodeLoading(true);

    fetchCodePreviewText(card.media_url)
      .then((text) => {
        if (!cancelled) setCodeText(text);
      })
      .catch(() => {
        if (!cancelled) setCodeText('// Failed to load file');
      })
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [card?.media_url, mediaCategory]);

  if (cards.length === 0) {
    return (
      <div ref={containerRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">No cards to display</p>
          <Button onClick={exitFullscreenAndClose}>{t('board.pptExit')}</Button>
        </div>
      </div>
    );
  }

  const prev = () => setIndex(i => Math.max(0, i - 1));
  const next = () => setIndex(i => Math.min(cards.length - 1, i + 1));

  const handleShowCodePreview = () => {
    if (!card?.media_url || mediaCategory !== 'code') return;
    setShowCodePreview(true);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8"
      style={{ backgroundColor: card.color || 'hsl(var(--background))' }}
      tabIndex={0}
    >
      <button onClick={exitFullscreenAndClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-foreground/10 transition-colors">
        <X className="w-6 h-6 text-foreground" />
      </button>

      <div className="absolute top-4 left-4 text-sm text-muted-foreground font-medium">
        {tFormat(t('board.pptSlide'), safeIndex + 1, cards.length)}
      </div>

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
          const cat = (card.card_type === 'video' || card.card_type === 'document' || card.card_type === 'image' || card.card_type === 'audio' || card.card_type === 'code')
            ? card.card_type as string : getFileCategoryFromUrl(card.media_url);
          if (cat === 'image') {
            return (
              <div className="relative max-w-6xl mx-auto">
                <img
                  src={card.media_url}
                  alt=""
                  className="rounded-2xl max-h-[78vh] max-w-[90vw] mx-auto object-contain cursor-zoom-in"
                  onClick={() => setShowImagePreview(true)}
                />
                <button
                  type="button"
                  className="absolute right-2 bottom-2 p-2 rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors"
                  onClick={() => triggerDownload(card.media_url, getFileNameFromUrl(card.media_url))}
                  title={t('board.downloadFile')}
                  aria-label={t('board.downloadFile')}
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            );
          }
          if (cat === 'video') return <video src={card.media_url} controls className="rounded-2xl max-h-[40vh] mx-auto" />;
          if (cat === 'audio') return <audio src={card.media_url} controls className="w-full max-w-xl mx-auto" preload="metadata" />;
          if (cat === 'code') {
            return (
              <div className="relative max-w-4xl mx-auto">
                <div className="flex justify-between mb-2">
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" size="icon" onClick={() => setCodeFontSize(f => Math.max(12, f - 2))} title="减小字号">-</Button>
                    <span className="px-2 text-base select-none">{codeFontSize}px</span>
                    <Button variant="outline" size="icon" onClick={() => setCodeFontSize(f => Math.min(32, f + 2))} title="增大字号">+</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleShowCodePreview}>
                      <Maximize2 className="w-4 h-4 mr-1" /> 全屏预览
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => triggerDownload(card.media_url, getFileNameFromUrl(card.media_url))}>
                      <Download className="w-4 h-4 mr-1" /> 下载
                    </Button>
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card p-2 text-left">
                  {codeLoading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">代码加载中...</div>
                  ) : (
                    <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">代码高亮加载中...</div>}>
                      <CodeHighlight code={codeText} ext={getFileExtFromUrl(card.media_url)} initialMaxHeight={400} fontSize={codeFontSize} onFontSizeChange={setCodeFontSize} />
                    </Suspense>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div className="inline-flex items-center gap-2">
              <a href={card.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors">
                <span className="text-3xl">{getDocIcon(getFileExtFromUrl(card.media_url))}</span>
                <span className="text-lg text-foreground">{getFileNameFromUrl(card.media_url)}</span>
              </a>
              <Button
                type="button"
                variant="outline"
                className="h-12 px-4 gap-2"
                onClick={() => triggerDownload(card.media_url, getFileNameFromUrl(card.media_url))}
              >
                <Download className="w-4 h-4" />
                {t('board.downloadFile')}
              </Button>
            </div>
          );
        })()}

      {showCodePreview && (
        <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-background/95 p-4 backdrop-blur-sm" style={{ overflowY: 'auto' }}>
          <button
            type="button"
            className="absolute top-4 right-4 rounded-md bg-muted/80 p-2 text-foreground transition-colors hover:bg-muted"
            onClick={() => setShowCodePreview(false)}
            aria-label="关闭"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="mx-auto h-[80vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-border bg-card p-4 text-left shadow-lg">
            <div className="flex gap-2 items-center mb-2">
              <Button variant="outline" size="icon" onClick={() => setPreviewFontSize(f => Math.max(12, f - 2))} title="减小字号">-</Button>
              <span className="px-2 text-base select-none">{previewFontSize}px</span>
              <Button variant="outline" size="icon" onClick={() => setPreviewFontSize(f => Math.min(32, f + 2))} title="增大字号">+</Button>
            </div>
            {codeLoading ? (
              <div className="py-12 text-center text-lg text-muted-foreground">代码加载中...</div>
            ) : (
              <Suspense fallback={<div className="py-12 text-center text-lg text-muted-foreground">代码高亮加载中...</div>}>
                <CodeHighlight code={codeText} ext={codeExt} initialMaxHeight={600} fontSize={previewFontSize} onFontSizeChange={setPreviewFontSize} />
              </Suspense>
            )}
          </div>
        </div>
      )}

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

      <div className="absolute bottom-8 flex items-center gap-4">
        <Button variant="outline" size="lg" onClick={prev} disabled={safeIndex === 0} className="gap-2">
          <ChevronLeft className="w-5 h-5" /> {t('board.pptPrev')}
        </Button>
        <Button variant="outline" size="lg" onClick={next} disabled={safeIndex === cards.length - 1} className="gap-2">
          {t('board.pptNext')} <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {showImagePreview && card.media_url && (
        <div
          className="fixed inset-0 z-[130] bg-black/95 flex items-center justify-center p-4"
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
            <X className="w-5 h-5" />
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
            <Download className="w-5 h-5" />
          </button>
          <img
            src={card.media_url}
            alt=""
            className="max-w-[97vw] max-h-[94vh] object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
