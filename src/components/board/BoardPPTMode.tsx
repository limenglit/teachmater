import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { tFormat } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Heart, ExternalLink, Download, Maximize2 } from 'lucide-react';
import type { BoardCard } from '@/components/BoardPanel';
import { getFileCategoryFromUrl, getFileNameFromUrl, getFileExtFromUrl, getDocIcon } from '@/lib/board-file-utils';
import CodeHighlight from '@/components/board/CodeHighlight';
import { fetchCodePreviewText } from '@/lib/code-preview';

interface Props {
  cards: BoardCard[];
  onExit: () => void;
}

export default function BoardPPTMode({ cards, onExit }: Props) {
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [codeText, setCodeText] = useState('');
  const [codeExt, setCodeExt] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [showImagePreview, setShowImagePreview] = useState(false);
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

  useEffect(() => {
    setShowImagePreview(false);
  }, [index]);

  // 代码全屏预览弹窗
  const handleShowCodePreview = async () => {
    if (!card.media_url) return;
    setCodeLoading(true);
    setShowCodePreview(true);
    setCodeExt(getFileExtFromUrl(card.media_url));
    try {
      const text = await fetchCodePreviewText(card.media_url);
      setCodeText(text);
    } catch {
      setCodeText('加载失败');
    }
    setCodeLoading(false);
  };

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
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={handleShowCodePreview}>
                    <Maximize2 className="w-4 h-4 mr-1" /> 全屏预览
                  </Button>
                  <Button variant="outline" size="sm" className="ml-2" onClick={() => triggerDownload(card.media_url, getFileNameFromUrl(card.media_url))}>
                    <Download className="w-4 h-4 mr-1" /> 下载
                  </Button>
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto', borderRadius: 8, border: '1px solid #eee', background: '#18181b', padding: 8 }}>
                  <CodeHighlight code={codeText} ext={getFileExtFromUrl(card.media_url)} initialMaxHeight={400} />
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

      {/* 代码全屏预览弹窗 */}
      {showCodePreview && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col items-center justify-center p-4" style={{overflowY:'auto'}}>
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-md bg-black/40 text-white hover:bg-black/60 transition-colors"
            onClick={() => setShowCodePreview(false)}
            aria-label="关闭"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="w-full max-w-6xl mx-auto" style={{height:'80vh',overflowY:'auto',background:'#18181b',borderRadius:12,padding:16}}>
            {codeLoading ? (
              <div className="text-white text-center py-12 text-lg">代码加载中...</div>
            ) : (
              <pre style={{margin:0,overflow:'visible',width:'100%'}}>
                <CodeHighlight code={codeText} ext={codeExt} initialMaxHeight={600} />
              </pre>
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

      {/* Navigation */}
      <div className="absolute bottom-8 flex items-center gap-4">
        <Button variant="outline" size="lg" onClick={prev} disabled={index === 0} className="gap-2">
          <ChevronLeft className="w-5 h-5" /> {t('board.pptPrev')}
        </Button>
        <Button variant="outline" size="lg" onClick={next} disabled={index === cards.length - 1} className="gap-2">
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
