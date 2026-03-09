import { useState, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dices, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LotteryDrawer() {
  const { t } = useLanguage();
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [result, setResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [customItems, setCustomItems] = useState('');
  const [drawnItem, setDrawnItem] = useState<string | null>(null);
  const [mode, setMode] = useState<'number' | 'lottery'>('number');
  const rollTimer = useRef<ReturnType<typeof setInterval>>();

  const rollNumber = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    setResult(null);
    let count = 0;
    rollTimer.current = setInterval(() => {
      setResult(Math.floor(Math.random() * (max - min + 1)) + min);
      count++;
      if (count > 15) {
        clearInterval(rollTimer.current);
        const final = Math.floor(Math.random() * (max - min + 1)) + min;
        setResult(final);
        setHistory(prev => [final, ...prev].slice(0, 20));
        setRolling(false);
      }
    }, 80);
  }, [min, max, rolling]);

  const drawLottery = useCallback(() => {
    const items = customItems.split('\n').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return;
    setRolling(true);
    setDrawnItem(null);
    let count = 0;
    rollTimer.current = setInterval(() => {
      setDrawnItem(items[Math.floor(Math.random() * items.length)]);
      count++;
      if (count > 15) {
        clearInterval(rollTimer.current);
        const final = items[Math.floor(Math.random() * items.length)];
        setDrawnItem(final);
        setRolling(false);
      }
    }, 80);
  }, [customItems, rolling]);

  const reset = () => {
    setResult(null);
    setDrawnItem(null);
    setHistory([]);
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Dices className="w-4 h-4" /> {t('lottery.title')}
      </h3>

      {/* Mode switcher */}
      <div className="flex gap-1 mb-4">
        {(['number', 'lottery'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); reset(); }}
            className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
              mode === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}
          >
            {m === 'number' ? t('lottery.modeNumber') : t('lottery.modeLottery')}
          </button>
        ))}
      </div>

      {mode === 'number' ? (
        <>
          {/* Range inputs */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">{t('lottery.min')}</label>
              <Input
                type="number"
                value={min}
                onChange={e => setMin(Number(e.target.value))}
                className="text-sm mt-0.5"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">{t('lottery.max')}</label>
              <Input
                type="number"
                value={max}
                onChange={e => setMax(Number(e.target.value))}
                className="text-sm mt-0.5"
              />
            </div>
          </div>

          {/* Result display */}
          <div className="text-center py-4 mb-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={result ?? 'empty'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', duration: 0.3 }}
                className={`text-5xl font-bold font-mono ${rolling ? 'text-muted-foreground' : 'text-primary'}`}
              >
                {result ?? '?'}
              </motion.div>
            </AnimatePresence>
          </div>

          <Button onClick={rollNumber} disabled={rolling || min >= max} className="w-full gap-1 mb-2">
            <Dices className="w-4 h-4" />
            {rolling ? t('lottery.rolling') : t('lottery.roll')}
          </Button>

          {/* History */}
          {history.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {history.map((n, i) => (
                <span key={i} className="bg-muted text-foreground text-xs font-mono px-2 py-0.5 rounded-full">{n}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Lottery items */}
          <textarea
            value={customItems}
            onChange={e => setCustomItems(e.target.value)}
            placeholder={t('lottery.itemsPlaceholder')}
            className="w-full h-24 text-sm bg-muted border border-border rounded-lg p-2 resize-none mb-3 focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {/* Result display */}
          <div className="text-center py-4 mb-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={drawnItem ?? 'empty'}
                initial={{ scale: 0.5, opacity: 0, rotateX: 90 }}
                animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotateX: -90 }}
                transition={{ type: 'spring', duration: 0.3 }}
                className={`text-3xl font-bold ${rolling ? 'text-muted-foreground' : 'text-primary'}`}
              >
                {drawnItem ?? '🎫'}
              </motion.div>
            </AnimatePresence>
          </div>

          <Button
            onClick={drawLottery}
            disabled={rolling || customItems.split('\n').filter(s => s.trim()).length === 0}
            className="w-full gap-1"
          >
            <Dices className="w-4 h-4" />
            {rolling ? t('lottery.drawing') : t('lottery.draw')}
          </Button>
        </>
      )}

      {(history.length > 0 || drawnItem) && (
        <Button variant="ghost" size="sm" onClick={reset} className="w-full mt-2 gap-1 text-xs text-muted-foreground">
          <RotateCcw className="w-3 h-3" /> {t('lottery.reset')}
        </Button>
      )}
    </div>
  );
}
