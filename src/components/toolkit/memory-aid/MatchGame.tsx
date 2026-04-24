import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RotateCcw, Settings2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import type { CardItem } from './types';
import { shuffle } from './types';

interface Tile {
  id: string;
  cardId: string;
  text: string;
  image?: string;
  type: 'word' | 'definition';
}

// Distinct, accessible colors for matched-pair badges (work in light/dark)
const PAIR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#a855f7',
  '#f59e0b', '#10b981', '#6366f1', '#d946ef', '#84cc16',
  '#0ea5e9', '#f43f5e', '#64748b', '#dc2626', '#7c3aed',
];

interface Settings {
  fontScale: number;       // 0.7 – 2.0
  matchedColor: string;    // hex or 'auto' (use pair color)
  showPairBadge: boolean;  // show numeric/color badge to indicate the matched pair
  showConnections: boolean; // draw SVG line between matched pair centers
  animateNewOnly: boolean; // animate only the newly matched pair; older pairs render static
  stablePairing: boolean; // keep word/definition pair indexes stable across reshuffles
  curveStrength: number; // 0 – 3, multiplier on bezier perpendicular offset
  parallelSpacing: number; // 4 – 40 px, base spacing between parallel curves
}

const DEFAULT_SETTINGS: Settings = {
  fontScale: 1,
  matchedColor: 'auto',
  showPairBadge: true,
  showConnections: true,
  animateNewOnly: true,
  stablePairing: true,
  curveStrength: 1,
  parallelSpacing: 18,
};

const SETTINGS_KEY = 'memory-match-settings-v1';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
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
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const lockRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [lines, setLines] = useState<Array<{ cardId: string; pairKey: string; x1: number; y1: number; x2: number; y2: number; cx: number; cy: number; color: string; curved: boolean }>>([]);
  const [gridSize, setGridSize] = useState({ w: 0, h: 0 });
  const [lastMatchedCardId, setLastMatchedCardId] = useState<string | null>(null);

  const effectivePairCount = Math.min(pairCount, cards.length);

  // Persist settings
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* noop */ }
  }, [settings]);

  // Map cardId -> pair index (deterministic per round, used for badge color/number)
  const pairIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    tiles.forEach(t => {
      if (!map.has(t.cardId)) {
        map.set(t.cardId, i++);
      }
    });
    return map;
  }, [tiles]);

  // Compute connection lines: pair tiles by position-order per cardId so the
  // same card appearing multiple times produces independent lines. When two
  // lines share both endpoints (parallel/overlapping), curve them outward by
  // an alternating offset so they stay visually distinct.
  const computeLines = (): typeof lines => {
    const grid = gridRef.current;
    if (!grid) return [];
    const gridRect = grid.getBoundingClientRect();
    setGridSize({ w: gridRect.width, h: gridRect.height });

    const wordsByCard = new Map<string, string[]>();
    const defsByCard = new Map<string, string[]>();
    tiles.forEach(tile => {
      if (!matched.has(tile.id)) return;
      const bucket = tile.type === 'word' ? wordsByCard : defsByCard;
      const arr = bucket.get(tile.cardId) ?? [];
      arr.push(tile.id);
      bucket.set(tile.cardId, arr);
    });

    // Stable pairing: sort each bucket by tile.id so the i-th word always pairs
    // with the i-th definition for a given cardId regardless of shuffle order.
    if (settings.stablePairing) {
      wordsByCard.forEach((arr) => arr.sort());
      defsByCard.forEach((arr) => arr.sort());
    }

    type Raw = { cardId: string; pairKey: string; ax: number; ay: number; bx: number; by: number; color: string };
    const raw: Raw[] = [];

    wordsByCard.forEach((words, cardId) => {
      const defs = defsByCard.get(cardId) ?? [];
      const n = Math.min(words.length, defs.length);
      const pairIdx = pairIndexMap.get(cardId) ?? 0;
      const color = PAIR_COLORS[pairIdx % PAIR_COLORS.length];
      for (let i = 0; i < n; i++) {
        const a = tileRefs.current.get(words[i]);
        const b = tileRefs.current.get(defs[i]);
        if (!a || !b) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        raw.push({
          cardId,
          pairKey: `${cardId}#${i}`,
          ax: ra.left + ra.width / 2 - gridRect.left,
          ay: ra.top + ra.height / 2 - gridRect.top,
          bx: rb.left + rb.width / 2 - gridRect.left,
          by: rb.top + rb.height / 2 - gridRect.top,
          color,
        });
      }
    });

    // Bucket parallel/overlapping pairs (order-independent endpoint signature)
    // and assign each a centered perpendicular offset slot.
    const sigOf = (r: Raw) => {
      const q = (n: number) => Math.round(n / 8) * 8;
      const a = `${q(r.ax)},${q(r.ay)}`;
      const b = `${q(r.bx)},${q(r.by)}`;
      return a < b ? `${a}|${b}` : `${b}|${a}`;
    };
    const sigCounts = new Map<string, number>();
    const sigSlot = new Map<string, number>();
    raw.forEach(r => sigCounts.set(sigOf(r), (sigCounts.get(sigOf(r)) ?? 0) + 1));

    return raw.map(r => {
      const sig = sigOf(r);
      const total = sigCounts.get(sig) ?? 1;
      const slot = sigSlot.get(sig) ?? 0;
      sigSlot.set(sig, slot + 1);

      const offsetIdx = slot - (total - 1) / 2; // centered: 1->[0]; 2->[-.5,.5]; 3->[-1,0,1]
      const dx = r.bx - r.ax;
      const dy = r.by - r.ay;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      const STEP = 18; // px between parallel curves
      const off = offsetIdx * STEP;
      const cx = (r.ax + r.bx) / 2 + px * off * 2;
      const cy = (r.ay + r.by) / 2 + py * off * 2;

      return {
        cardId: r.cardId,
        pairKey: r.pairKey,
        x1: r.ax, y1: r.ay,
        x2: r.bx, y2: r.by,
        cx, cy,
        color: r.color,
        curved: total > 1,
      };
    });
  };

  useLayoutEffect(() => {
    if (!settings.showConnections) { setLines([]); return; }
    setLines(computeLines());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, tiles, pairIndexMap, settings.showConnections, settings.fontScale, settings.stablePairing]);

  useEffect(() => {
    if (!settings.showConnections) return;
    const handler = () => setLines(computeLines());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, tiles, pairIndexMap, settings.showConnections, settings.stablePairing]);


  const buildTiles = (count: number) => {
    const subset = shuffle([...cards]).slice(0, count);
    const t: Tile[] = [];
    subset.forEach(c => {
      t.push({ id: `w-${c.id}`, cardId: c.id, text: c.word, image: c.wordImage, type: 'word' });
      t.push({ id: `d-${c.id}`, cardId: c.id, text: c.definition, image: c.definitionImage, type: 'definition' });
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
    setLastMatchedCardId(null);
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
          setLastMatchedCardId(t1.cardId);
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

  const pairOptions: number[] = [];
  for (let i = 2; i <= Math.min(cards.length, 20); i++) {
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

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <Settings2 className="w-3 h-3" /> 设置
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">字号缩放</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(settings.fontScale * 100)}%
                  </span>
                </div>
                <Slider
                  min={0.7}
                  max={2}
                  step={0.05}
                  value={[settings.fontScale]}
                  onValueChange={v => setSettings(s => ({ ...s, fontScale: v[0] }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">配对成功后字色</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, matchedColor: 'auto' }))}
                    className={`px-2 py-1 rounded text-xs border ${
                      settings.matchedColor === 'auto'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    跟随配对色
                  </button>
                  <input
                    type="color"
                    value={settings.matchedColor === 'auto' ? '#16a34a' : settings.matchedColor}
                    onChange={e => setSettings(s => ({ ...s, matchedColor: e.target.value }))}
                    className="h-7 w-10 rounded cursor-pointer border border-border bg-transparent"
                    aria-label="自定义颜色"
                  />
                  <span className="text-xs text-muted-foreground">自定义</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs cursor-pointer" htmlFor="show-pair-badge">
                  显示配对编号徽标
                </Label>
                <input
                  id="show-pair-badge"
                  type="checkbox"
                  checked={settings.showPairBadge}
                  onChange={e => setSettings(s => ({ ...s, showPairBadge: e.target.checked }))}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs cursor-pointer" htmlFor="show-connections">
                  显示配对连线
                </Label>
                <input
                  id="show-connections"
                  type="checkbox"
                  checked={settings.showConnections}
                  onChange={e => setSettings(s => ({ ...s, showConnections: e.target.checked }))}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </div>

              <div className={`flex items-center justify-between ${!settings.showConnections ? 'opacity-50 pointer-events-none' : ''}`}>
                <Label className="text-xs cursor-pointer" htmlFor="animate-new-only">
                  仅动画新匹配的连线
                </Label>
                <input
                  id="animate-new-only"
                  type="checkbox"
                  checked={settings.animateNewOnly}
                  onChange={e => setSettings(s => ({ ...s, animateNewOnly: e.target.checked }))}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </div>

              <div className={`flex items-center justify-between ${!settings.showConnections ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex flex-col">
                  <Label className="text-xs cursor-pointer" htmlFor="stable-pairing">
                    稳定配对模式
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    重新洗牌时连线对应关系保持不变
                  </span>
                </div>
                <input
                  id="stable-pairing"
                  type="checkbox"
                  checked={settings.stablePairing}
                  onChange={e => setSettings(s => ({ ...s, stablePairing: e.target.checked }))}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSettings(DEFAULT_SETTINGS)}
                className="w-full h-7 text-xs"
              >
                恢复默认
              </Button>
            </PopoverContent>
          </Popover>

          <Button size="sm" variant="outline" onClick={restart} className="h-7 text-xs gap-1">
            <RotateCcw className="w-3 h-3" /> {t('memory.restart')}
          </Button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={gridRef}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {tiles.map(tile => {
          const isFlipped = flipped.has(tile.id) || matched.has(tile.id);
          const isMatched = matched.has(tile.id);
          const hasImage = !!tile.image;
          const pairIdx = pairIndexMap.get(tile.cardId) ?? 0;
          const pairColor = PAIR_COLORS[pairIdx % PAIR_COLORS.length];
          const matchedTextColor =
            settings.matchedColor === 'auto' ? pairColor : settings.matchedColor;

          // Auto-fit: scale by base font (text-xs ~12px) * user scale; shrink slightly when image present
          const baseFontPx = (hasImage ? 11 : 13) * settings.fontScale;

          const showBadge = settings.showPairBadge && isMatched;

          return (
            <motion.button
              key={tile.id}
              ref={(el) => {
                if (el) tileRefs.current.set(tile.id, el);
                else tileRefs.current.delete(tile.id);
              }}
              onClick={() => handleClick(tile.id)}
              className={`relative aspect-square rounded-xl border-2 font-medium p-1 transition-all duration-200 flex items-center justify-center text-center leading-tight overflow-hidden
                ${isMatched
                  ? 'cursor-default'
                  : isFlipped
                    ? tile.type === 'word'
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-accent-foreground/30 bg-accent text-foreground'
                    : 'border-border bg-muted hover:border-primary/40 cursor-pointer hover:bg-accent/50 text-foreground'
                }`}
              style={
                isMatched
                  ? {
                      borderColor: pairColor,
                      backgroundColor: `${pairColor}1a`, // ~10% opacity
                      boxShadow: `0 0 0 2px ${pairColor}33, 0 4px 14px -4px ${pairColor}66`,
                      color: matchedTextColor,
                    }
                  : undefined
              }
              whileTap={!isFlipped && !isMatched ? { scale: 0.95 } : {}}
              animate={isMatched ? { scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              {/* Pair-relationship badge */}
              {showBadge && (
                <span
                  className="absolute top-1 left-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow"
                  style={{ backgroundColor: pairColor }}
                  aria-label={`配对 #${pairIdx + 1}`}
                >
                  {pairIdx + 1}
                </span>
              )}

              {/* Type indicator (word/definition) on matched tiles */}
              {isMatched && (
                <span
                  className="absolute top-1 right-1 text-[9px] font-semibold px-1 rounded"
                  style={{ color: pairColor, backgroundColor: 'hsl(var(--background) / 0.85)' }}
                >
                  {tile.type === 'word' ? 'A' : 'B'}
                </span>
              )}

              {isFlipped ? (
                <div className="flex flex-col items-center gap-0.5 w-full h-full justify-center px-1">
                  {hasImage && (
                    <img src={tile.image} alt="" className="max-h-[55%] max-w-[90%] object-contain rounded" />
                  )}
                  {tile.text && (
                    <span
                      className="break-words w-full"
                      style={{
                        fontSize: `${baseFontPx}px`,
                        lineHeight: 1.15,
                        // Auto-fit hint: long text shrinks a touch
                        ...(tile.text.length > 14 ? { fontSize: `${baseFontPx * 0.85}px` } : null),
                        ...(tile.text.length > 24 ? { fontSize: `${baseFontPx * 0.7}px` } : null),
                      }}
                    >
                      {tile.text}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-lg">❓</span>
              )}
            </motion.button>
          );
        })}
        </div>

        {/* Connection lines overlay between matched pair centers */}
        {settings.showConnections && lines.length > 0 && gridSize.w > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={gridSize.w}
            height={gridSize.h}
            style={{ overflow: 'visible' }}
            aria-hidden
          >
            <defs>
              {lines.map((_, i) => (
                <filter key={`f-${i}`} id={`glow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
            </defs>
            {lines.map((ln, i) => {
              const isNew = ln.cardId === lastMatchedCardId;
              const animate = settings.animateNewOnly ? isNew : true;
              const d = ln.curved
                ? `M ${ln.x1} ${ln.y1} Q ${ln.cx} ${ln.cy} ${ln.x2} ${ln.y2}`
                : `M ${ln.x1} ${ln.y1} L ${ln.x2} ${ln.y2}`;
              return (
                <g key={ln.pairKey ?? `${ln.cardId}-${i}`}>
                  <path
                    d={d} fill="none"
                    stroke={ln.color} strokeWidth={8} strokeLinecap="round"
                    opacity={animate ? 0.18 : 0.12}
                  />
                  <path
                    d={d} fill="none"
                    stroke={ln.color} strokeWidth={2.5} strokeLinecap="round"
                    strokeDasharray={animate ? '6 4' : undefined}
                    filter={animate ? `url(#glow-${i})` : undefined}
                    opacity={animate ? 1 : 0.7}
                    style={animate ? { animation: 'matchDash 1.2s linear infinite' } : undefined}
                  />
                  <circle cx={ln.x1} cy={ln.y1} r={4} fill={ln.color} opacity={animate ? 0.9 : 0.7} />
                  <circle cx={ln.x2} cy={ln.y2} r={4} fill={ln.color} opacity={animate ? 0.9 : 0.7} />
                </g>
              );
            })}
            <style>{`
              @keyframes matchDash {
                from { stroke-dashoffset: 0; }
                to { stroke-dashoffset: -20; }
              }
            `}</style>
          </svg>
        )}
      </div>
    </div>
  );
}
