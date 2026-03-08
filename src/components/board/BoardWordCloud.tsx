import { useState, useMemo, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { X, Download, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { countFrequencies, layoutWordCloud, type PositionedWord } from '@/lib/word-cloud';
import type { BoardCard } from '@/components/BoardPanel';

interface Props {
  cards: BoardCard[];
  onClose: () => void;
}

export default function BoardWordCloud({ cards, onClose }: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState(0); // force re-layout

  const texts = useMemo(() => cards.map(c => c.content).filter(Boolean), [cards]);
  const words = useMemo(() => countFrequencies(texts), [texts]);

  const WIDTH = 900;
  const HEIGHT = 560;

  const positioned = useMemo(
    () => layoutWordCloud(words, WIDTH, HEIGHT),
    [words, key] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const exportPNG = useCallback(async () => {
    const el = containerRef.current?.querySelector('.word-cloud-canvas') as HTMLElement;
    if (!el) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'word-cloud.png';
    a.click();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
    >
      {/* Header */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setKey(k => k + 1)}>
          <RefreshCw className="w-3.5 h-3.5" /> {t('board.wordCloudRefresh')}
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={exportPNG}>
          <Download className="w-3.5 h-3.5" /> {t('board.exportPNG')}
        </Button>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-foreground/10 transition-colors">
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <h2 className="text-xl font-bold text-foreground mb-4">{t('board.wordCloud')}</h2>

      {words.length === 0 ? (
        <p className="text-muted-foreground">{t('board.wordCloudEmpty')}</p>
      ) : (
        <div ref={containerRef} className="relative">
          <div
            className="word-cloud-canvas relative bg-card rounded-2xl border border-border shadow-lg overflow-hidden"
            style={{ width: WIDTH, height: HEIGHT, maxWidth: '95vw', maxHeight: '70vh' }}
          >
            <svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="select-none">
              <AnimatePresence>
                {positioned.map((w, i) => (
                  <motion.text
                    key={`${w.word}-${key}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02, duration: 0.4, type: 'spring' }}
                    x={w.x}
                    y={w.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={w.color}
                    fontSize={w.fontSize}
                    fontWeight={w.fontSize > 40 ? 'bold' : w.fontSize > 25 ? '600' : 'normal'}
                    transform={w.rotation !== 0 ? `rotate(${w.rotation}, ${w.x}, ${w.y})` : undefined}
                    className="cursor-default"
                  >
                    {w.word}
                  </motion.text>
                ))}
              </AnimatePresence>
            </svg>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
            {words.slice(0, 10).map(w => (
              <span key={w.word} className="bg-muted px-2 py-0.5 rounded-full">
                {w.word} <span className="font-semibold text-foreground">×{w.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
