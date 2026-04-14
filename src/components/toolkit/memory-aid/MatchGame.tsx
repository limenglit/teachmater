import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import type { CardItem } from './types';
import { shuffle } from './types';

interface Tile {
  id: string;
  cardId: string;
  text: string;
  type: 'word' | 'definition';
}

export default function MatchGame({ cards }: { cards: CardItem[] }) {
  const { t } = useLanguage();
  const [pairCount, setPairCount] = useState<number>(Math.min(6, cards.length));
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const lockRef = useRef(false);

  const effectivePairCount = Math.min(pairCount, cards.length);

  const buildTiles = (count: number) => {
    const subset = shuffle([...cards]).slice(0, count);
    const t: Tile[] = [];
    subset.forEach(c => {
      t.push({ id: `w-${c.id}`, cardId: c.id, text: c.word, type: 'word' });
      t.push({ id: `d-${c.id}`, cardId: c.id, text: c.definition, type: 'definition' });
    });
    return shuffle(t);
  };

  const restart = () => {
    setTiles(buildTiles(effectivePairCount));
    setFlipped(new Set());
    setMatched(new Set());
    setSelected([]);
    setAttempts(0);
    setStartTime(Date.now());
    lockRef.current = false;
  };

  useEffect(() => { restart(); }, [cards, pairCount]);

  const handleClick = (tileId: string) => {
    if (lockRef.current) return;
    if (flipped.has(tileId) || matched.has(tileId)) return;
    if (selected.length === 1 && selected[0] === tileId) return;

    const next = [...selected, tileId];
    setFlipped(prev => new Set([...prev, tileId]));

    if (next.length === 2) {
      lockRef.current = true;
      setAttempts(a => a + 1);
      const t1 = tiles.find(t => t.id === next[0])!;
      const t2 = tiles.find(t => t.id === next[1])!;

      if (t1.cardId === t2.cardId && t1.type !== t2.type) {
        setTimeout(() => {
          setMatched(prev => new Set([...prev, next[0], next[1]]));
          setSelected([]);
          lockRef.current = false;

          const matchedCount = (matched.size + 2) / 2;
          if (matchedCount >= effectivePairCount) {
            const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
            toast.success(t('memory.matchWin').replace('{0}', String(attempts + 1)).replace('{1}', String(elapsed)));
          }
        }, 400);
      } else {
        setTimeout(() => {
          setFlipped(prev => {
            const n = new Set(prev);
            n.delete(next[0]);
            n.delete(next[1]);
            return n;
          });
          setSelected([]);
          lockRef.current = false;
        }, 900);
      }
      setSelected(next);
    } else {
      setSelected(next);
    }
  };

  const totalTiles = tiles.length;
  const cols = totalTiles <= 8 ? 4 : totalTiles <= 12 ? 4 : 6;

  // Generate pair count options
  const maxPairs = cards.length;
  const pairOptions: number[] = [];
  for (let i = 2; i <= Math.min(maxPairs, 20); i++) {
    pairOptions.push(i);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-muted-foreground">
          {t('memory.attempts')}: {attempts} | {t('memory.matched')}: {matched.size / 2}/{effectivePairCount}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t('memory.pairCount')}:</span>
            <Select value={String(pairCount)} onValueChange={v => setPairCount(Number(v))}>
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pairOptions.map(n => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={restart} className="h-7 text-xs gap-1">
            <RotateCcw className="w-3 h-3" /> {t('memory.restart')}
          </Button>
        </div>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {tiles.map(tile => {
          const isFlipped = flipped.has(tile.id) || matched.has(tile.id);
          const isMatched = matched.has(tile.id);

          return (
            <motion.button
              key={tile.id}
              onClick={() => handleClick(tile.id)}
              className={`relative aspect-square rounded-xl border-2 text-xs font-medium p-1.5 transition-all duration-200 flex items-center justify-center text-center leading-tight overflow-hidden
                ${isMatched
                  ? 'border-primary/30 bg-primary/10 text-primary opacity-60 cursor-default'
                  : isFlipped
                    ? tile.type === 'word'
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-accent-foreground/30 bg-accent text-foreground'
                    : 'border-border bg-muted hover:border-primary/40 cursor-pointer hover:bg-accent/50'
                }`}
              whileTap={!isFlipped && !isMatched ? { scale: 0.95 } : {}}
              animate={isMatched ? { scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              {isFlipped ? (
                <span className="break-words">{tile.text}</span>
              ) : (
                <span className="text-lg">❓</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
