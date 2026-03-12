import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { tFormat } from '@/contexts/LanguageContext';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PPTOutline, PPT_COLOR_SCHEMES } from './pptTypes';

interface Props {
  outline: PPTOutline;
  colorSchemeId: string;
  startIndex?: number;
  onExit: () => void;
}

export default function PPTPresenter({ outline, colorSchemeId, startIndex = 0, onExit }: Props) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(startIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const colors = PPT_COLOR_SCHEMES.find(c => c.id === colorSchemeId) || PPT_COLOR_SCHEMES[0];
  const slide = outline.slides[index];
  const total = outline.slides.length;

  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIndex(i => Math.min(total - 1, i + 1)), [total]);

  const exitFullscreenAndClose = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().then(onExit).catch(onExit);
    } else {
      onExit();
    }
  }, [onExit]);

  // Enter fullscreen
  useEffect(() => {
    const el = containerRef.current;
    if (el && !document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // Exit when fullscreen ends (e.g. native Escape)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) onExit();
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [onExit]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        prev();
      }
      if (e.key === 'Escape') {
        exitFullscreenAndClose();
      }
      if (e.key === 'Home') setIndex(0);
      if (e.key === 'End') setIndex(total - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, exitFullscreenAndClose, total]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    // Only trigger if horizontal swipe is dominant and > 50px
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) next();
      else prev();
    }
  };

  // Auto-hide cursor
  const [cursorHidden, setCursorHidden] = useState(false);
  const cursorTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleMouseMove = () => {
    setCursorHidden(false);
    clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursorHidden(true), 3000);
  };
  useEffect(() => () => clearTimeout(cursorTimer.current), []);

  const titleStyle = slide?.titleStyle || {};
  const bodyStyle = slide?.bodyStyle || {};

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] flex flex-col select-none"
      style={{
        backgroundColor: colors.background,
        cursor: cursorHidden ? 'none' : 'default',
      }}
      tabIndex={0}
      autoFocus
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseMove={handleMouseMove}
    >
      {/* Close button */}
      <button
        onClick={exitFullscreenAndClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-foreground/10 transition-colors z-10"
        style={{ color: colors.text }}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Slide counter */}
      <div
        className="absolute top-4 left-4 text-sm font-medium z-10"
        style={{ color: colors.text, opacity: 0.5 }}
      >
        {index + 1} / {total}
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-16">
        {slide && (
          <div className="max-w-5xl w-full text-center space-y-8">
            {/* Image */}
            {slide.imageUrl && (
              <img
                src={slide.imageUrl}
                alt=""
                className="rounded-2xl max-h-[35vh] mx-auto object-contain"
              />
            )}

            {/* Title */}
            <h1
              className="leading-tight whitespace-pre-wrap"
              style={{
                color: titleStyle.color || colors.primary,
                fontFamily: titleStyle.fontFamily || 'inherit',
                fontSize: `${(titleStyle.fontSize || 48) * 1.2}px`,
                fontWeight: titleStyle.bold !== false ? 'bold' : 'normal',
                fontStyle: titleStyle.italic ? 'italic' : 'normal',
              }}
            >
              {slide.title}
            </h1>

            {/* Subtitle */}
            {slide.subtitle && (
              <p
                className="text-xl sm:text-2xl"
                style={{ color: colors.text, opacity: 0.7 }}
              >
                {slide.subtitle}
              </p>
            )}

            {/* Bullets */}
            {slide.bullets && slide.bullets.length > 0 && (
              <div className="text-left max-w-3xl mx-auto space-y-3">
                {slide.bullets.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3"
                    style={{
                      color: bodyStyle.color || colors.text,
                      fontFamily: bodyStyle.fontFamily || 'inherit',
                      fontSize: `${(bodyStyle.fontSize || 20) * 1.2}px`,
                      fontWeight: bodyStyle.bold ? 'bold' : 'normal',
                      fontStyle: bodyStyle.italic ? 'italic' : 'normal',
                    }}
                  >
                    <span
                      className="mt-2 w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: colors.accent }}
                    />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Quote */}
            {slide.quoteText && (
              <div className="max-w-3xl mx-auto">
                <blockquote
                  className="text-2xl sm:text-3xl italic"
                  style={{ color: colors.text }}
                >
                  "{slide.quoteText}"
                </blockquote>
                {slide.quoteAuthor && (
                  <p className="mt-4 text-lg" style={{ color: colors.secondary }}>
                    — {slide.quoteAuthor}
                  </p>
                )}
              </div>
            )}

            {/* Timeline */}
            {slide.timelineItems && slide.timelineItems.length > 0 && (
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {slide.timelineItems.map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    />
                    <span className="text-sm font-bold" style={{ color: colors.primary }}>
                      {item.year}
                    </span>
                    <span className="text-xs" style={{ color: colors.text }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation area - click left/right halves */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div
          className="w-1/3 h-full pointer-events-auto cursor-pointer"
          onClick={prev}
        />
        <div className="w-1/3 h-full" />
        <div
          className="w-1/3 h-full pointer-events-auto cursor-pointer"
          onClick={next}
        />
      </div>

      {/* Bottom navigation pills */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{ opacity: cursorHidden ? 0 : undefined }}
      >
        <button
          onClick={prev}
          disabled={index === 0}
          className="p-2 rounded-full bg-foreground/10 hover:bg-foreground/20 disabled:opacity-30 transition-colors"
          style={{ color: colors.text }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {outline.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="rounded-full transition-all"
              style={{
                width: i === index ? 24 : 8,
                height: 8,
                backgroundColor: i === index ? colors.primary : colors.accent,
                opacity: i === index ? 1 : 0.4,
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={index === total - 1}
          className="p-2 rounded-full bg-foreground/10 hover:bg-foreground/20 disabled:opacity-30 transition-colors"
          style={{ color: colors.text }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
