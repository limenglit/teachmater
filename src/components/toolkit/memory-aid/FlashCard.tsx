import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, ChevronRight, Shuffle, Dices,
  Eye, CheckCircle2, XCircle, RotateCcw, Maximize2
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CardItem } from './types';
import { shuffle } from './types';

export default function FlashCard({ cards: rawCards }: { cards: CardItem[] }) {
  const { t } = useLanguage();
  const [cards, setCards] = useState<CardItem[]>([...rawCards]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setCards([...rawCards]);
    setIdx(0);
    setShowBack(false);
    setCorrect(0);
    setWrong(0);
  }, [rawCards]);

  const card = cards[idx];

  const go = useCallback((dir: number) => {
    setIdx(i => {
      const n = i + dir;
      if (n < 0) return cards.length - 1;
      if (n >= cards.length) return 0;
      return n;
    });
    setShowBack(false);
  }, [cards.length]);

  const shuffleCards = () => {
    setCards(shuffle([...cards]));
    setIdx(0);
    setShowBack(false);
  };

  const randomPick = () => {
    const r = Math.floor(Math.random() * cards.length);
    setIdx(r);
    setShowBack(false);
  };

  const markCorrect = () => {
    setCorrect(c => c + 1);
    go(1);
  };

  const markWrong = () => {
    setWrong(w => w + 1);
  };

  const resetCount = () => {
    setCorrect(0);
    setWrong(0);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === ' ') { e.preventDefault(); setShowBack(s => !s); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [go]);

  if (!card) return null;

  const content = (
    <div className={`space-y-3 ${fullscreen ? 'flex flex-col items-center justify-center h-full p-8' : ''}`}>
      {/* Card */}
      <div
        className="relative cursor-pointer mx-auto"
        style={{ perspective: 800, width: fullscreen ? 480 : '100%', maxWidth: '100%' }}
        onClick={() => setShowBack(s => !s)}
      >
        <motion.div
          className="relative w-full rounded-xl border-2 border-border bg-card shadow-sm"
          style={{ minHeight: fullscreen ? 280 : 160, transformStyle: 'preserve-3d' }}
          animate={{ rotateY: showBack ? 180 : 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-4 backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="text-xs text-muted-foreground mb-1">{t('memory.front')}</span>
            <span className={`font-bold text-foreground text-center ${fullscreen ? 'text-3xl' : 'text-xl'}`}>{card.word}</span>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-4"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <span className="text-xs text-muted-foreground mb-1">{t('memory.back')}</span>
            <span className={`font-semibold text-foreground text-center ${fullscreen ? 'text-2xl' : 'text-base'}`}>{card.definition}</span>
            {card.example && (
              <span className="text-xs text-muted-foreground mt-2 italic text-center">"{card.example}"</span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Progress */}
      <div className="text-center text-xs text-muted-foreground">
        {idx + 1} / {cards.length}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => go(-1)} className="h-7 text-xs gap-1"><ChevronLeft className="w-3 h-3" /> {t('memory.prev')}</Button>
        <Button size="sm" variant="outline" onClick={() => go(1)} className="h-7 text-xs gap-1">{t('memory.next')} <ChevronRight className="w-3 h-3" /></Button>
        <Button size="sm" variant="outline" onClick={randomPick} className="h-7 text-xs gap-1"><Dices className="w-3 h-3" /> {t('memory.randomPick')}</Button>
        <Button size="sm" variant="outline" onClick={shuffleCards} className="h-7 text-xs gap-1"><Shuffle className="w-3 h-3" /> {t('memory.shuffle')}</Button>
      </div>

      {/* Classroom toolbar */}
      <div className="bg-muted/50 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={randomPick} className="h-7 text-xs gap-1">
            <Dices className="w-3 h-3" /> {t('memory.randomAsk')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowBack(true)} className="h-7 text-xs gap-1">
            <Eye className="w-3 h-3" /> {t('memory.showAnswer')}
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button size="sm" onClick={markCorrect} className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground">
            <CheckCircle2 className="w-3 h-3" /> {t('memory.correct')} ({correct})
          </Button>
          <Button size="sm" onClick={markWrong} className="h-7 text-xs gap-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            <XCircle className="w-3 h-3" /> {t('memory.wrong')} ({wrong})
          </Button>
          <Button size="sm" variant="ghost" onClick={resetCount} className="h-7 text-xs gap-1">
            <RotateCcw className="w-3 h-3" /> {t('memory.resetCount')}
          </Button>
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) setFullscreen(false); }}>
        <div className="flex justify-end p-3">
          <Button size="sm" variant="ghost" onClick={() => setFullscreen(false)} className="h-7 text-xs">ESC {t('memory.exitFullscreen')}</Button>
        </div>
        <div className="flex-1 flex items-center justify-center overflow-auto">
          <div className="w-full max-w-lg">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {content}
      <div className="flex justify-end mt-2">
        <Button size="sm" variant="ghost" onClick={() => setFullscreen(true)} className="h-7 text-xs gap-1">
          <Maximize2 className="w-3 h-3" /> {t('memory.fullscreen')}
        </Button>
      </div>
    </div>
  );
}
