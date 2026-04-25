import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, Shuffle, Dices,
  Eye, CheckCircle2, XCircle, RotateCcw, Settings2
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CardItem } from './types';
import { shuffle } from './types';

interface FlashSettings {
  cardWidth: number;       // 280 - 720 px
  cardHeight: number;      // 180 - 520 px
  fontScale: number;       // 0.7 - 2.2
  fontFamily: string;      // css font-family
  textColor: string;       // hex
  frontBg: string;         // hex
  backBg: string;          // hex
  borderColor: string;     // hex
  schemeId: string;        // preset id
  alignH: 'start' | 'center' | 'end';  // horizontal alignment
  alignV: 'start' | 'center' | 'end';  // vertical alignment
  padding: number;         // 8 - 64 px
  wordWrap: boolean;       // 是否自动换行
  lineHeight: number;      // 1.0 - 2.4 行高
  wordBreak: 'normal' | 'break-word' | 'break-all'; // 断词策略
}

const FONT_OPTIONS = [
  { id: 'sans', name: '无衬线', value: '"Noto Sans SC", system-ui, sans-serif' },
  { id: 'serif', name: '衬线', value: '"Noto Serif SC", Georgia, serif' },
  { id: 'mono', name: '等宽', value: '"JetBrains Mono", "Fira Code", monospace' },
  { id: 'kai', name: '楷体', value: '"KaiTi", "STKaiti", serif' },
  { id: 'rounded', name: '圆体', value: '"M PLUS Rounded 1c", "Hiragino Maru Gothic", sans-serif' },
];

const COLOR_SCHEMES: Array<{
  id: string; name: string; frontBg: string; backBg: string; textColor: string; borderColor: string;
}> = [
  { id: 'classic',  name: '经典白', frontBg: '#ffffff', backBg: '#fafafa', textColor: '#0f172a', borderColor: '#e2e8f0' },
  { id: 'cream',    name: '米黄',  frontBg: '#fdf6e3', backBg: '#f5e9c8', textColor: '#3b2e1a', borderColor: '#e8d9b0' },
  { id: 'mint',     name: '薄荷绿', frontBg: '#ecfdf5', backBg: '#d1fae5', textColor: '#064e3b', borderColor: '#a7f3d0' },
  { id: 'sky',      name: '天空蓝', frontBg: '#eff6ff', backBg: '#dbeafe', textColor: '#0c4a6e', borderColor: '#bfdbfe' },
  { id: 'rose',     name: '玫瑰粉', frontBg: '#fff1f2', backBg: '#ffe4e6', textColor: '#881337', borderColor: '#fecdd3' },
  { id: 'lavender', name: '薰衣草', frontBg: '#f5f3ff', backBg: '#ede9fe', textColor: '#4c1d95', borderColor: '#ddd6fe' },
  { id: 'dark',     name: '深夜',  frontBg: '#1e293b', backBg: '#0f172a', textColor: '#f1f5f9', borderColor: '#334155' },
  { id: 'paper',    name: '牛皮纸', frontBg: '#f4ecd8', backBg: '#e8dcc0', textColor: '#3d2f17', borderColor: '#c9b88a' },
];

const DEFAULT_SETTINGS: FlashSettings = {
  cardWidth: 480,
  cardHeight: 260,
  fontScale: 1,
  fontFamily: FONT_OPTIONS[0].value,
  textColor: COLOR_SCHEMES[0].textColor,
  frontBg: COLOR_SCHEMES[0].frontBg,
  backBg: COLOR_SCHEMES[0].backBg,
  borderColor: COLOR_SCHEMES[0].borderColor,
  schemeId: 'classic',
  alignH: 'center',
  alignV: 'center',
  padding: 16,
  wordWrap: true,
  lineHeight: 1.4,
  wordBreak: 'break-word',
};

const SETTINGS_KEY = 'memory-flashcard-settings-v1';

function loadSettings(): FlashSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function FlashCard({ cards: rawCards }: { cards: CardItem[] }) {
  const { t } = useLanguage();
  const [cards, setCards] = useState<CardItem[]>([...rawCards]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [settings, setSettings] = useState<FlashSettings>(loadSettings);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

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

  const markCorrect = () => { setCorrect(c => c + 1); go(1); };
  const markWrong = () => { setWrong(w => w + 1); };
  const resetCount = () => { setCorrect(0); setWrong(0); };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === ' ') { e.preventDefault(); setShowBack(s => !s); }
      else if (e.key === 'Escape') return;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [go]);

  const applyScheme = (id: string) => {
    const s = COLOR_SCHEMES.find(x => x.id === id);
    if (!s) return;
    setSettings(prev => ({
      ...prev,
      schemeId: s.id,
      frontBg: s.frontBg,
      backBg: s.backBg,
      textColor: s.textColor,
      borderColor: s.borderColor,
    }));
  };

  const resetSettings = () => setSettings(DEFAULT_SETTINGS);

  if (!card) return null;

  const hasFrontImage = !!card.wordImage;
  const hasBackImage = !!card.definitionImage;
  const fs = settings.fontScale;

  return (
    <div className="space-y-4">
      {/* Top bar with settings */}
      <div className="flex items-center justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <Settings2 className="w-3 h-3" /> {t('memory.settings') || '设置'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-4 z-[200] max-h-[80vh] overflow-y-auto">
            {/* Color scheme */}
            <div className="space-y-2">
              <Label className="text-xs">{t('memory.colorScheme') || '配色方案'}</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_SCHEMES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => applyScheme(s.id)}
                    className={`relative h-12 rounded-md border-2 overflow-hidden transition-all ${settings.schemeId === s.id ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
                    style={{ background: `linear-gradient(135deg, ${s.frontBg} 50%, ${s.backBg} 50%)` }}
                    title={s.name}
                  >
                    <span className="absolute bottom-0 inset-x-0 text-[9px] py-0.5 text-center bg-black/40 text-white">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('memory.cardWidth') || '卡片宽度'}</Label>
                <span className="text-xs text-muted-foreground">{settings.cardWidth}px</span>
              </div>
              <Slider min={280} max={720} step={10} value={[settings.cardWidth]}
                onValueChange={([v]) => setSettings(s => ({ ...s, cardWidth: v }))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('memory.cardHeight') || '卡片高度'}</Label>
                <span className="text-xs text-muted-foreground">{settings.cardHeight}px</span>
              </div>
              <Slider min={180} max={520} step={10} value={[settings.cardHeight]}
                onValueChange={([v]) => setSettings(s => ({ ...s, cardHeight: v }))} />
            </div>

            {/* Font family */}
            <div className="space-y-2">
              <Label className="text-xs">{t('memory.fontFamily') || '字体'}</Label>
              <Select value={settings.fontFamily} onValueChange={v => setSettings(s => ({ ...s, fontFamily: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f.id} value={f.value}>
                      <span style={{ fontFamily: f.value }}>{f.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Font scale */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('memory.fontSize') || '字号'}</Label>
                <span className="text-xs text-muted-foreground">{Math.round(settings.fontScale * 100)}%</span>
              </div>
              <Slider min={0.7} max={2.2} step={0.05} value={[settings.fontScale]}
                onValueChange={([v]) => setSettings(s => ({ ...s, fontScale: v }))} />
            </div>

            {/* Custom colors */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">{t('memory.textColor') || '文字颜色'}</Label>
                <input type="color" value={settings.textColor}
                  onChange={e => setSettings(s => ({ ...s, textColor: e.target.value, schemeId: 'custom' }))}
                  className="w-full h-8 rounded border border-border cursor-pointer" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">{t('memory.borderColor') || '边框颜色'}</Label>
                <input type="color" value={settings.borderColor}
                  onChange={e => setSettings(s => ({ ...s, borderColor: e.target.value, schemeId: 'custom' }))}
                  className="w-full h-8 rounded border border-border cursor-pointer" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">{t('memory.frontBg') || '正面颜色'}</Label>
                <input type="color" value={settings.frontBg}
                  onChange={e => setSettings(s => ({ ...s, frontBg: e.target.value, schemeId: 'custom' }))}
                  className="w-full h-8 rounded border border-border cursor-pointer" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">{t('memory.backBg') || '背面颜色'}</Label>
                <input type="color" value={settings.backBg}
                  onChange={e => setSettings(s => ({ ...s, backBg: e.target.value, schemeId: 'custom' }))}
                  className="w-full h-8 rounded border border-border cursor-pointer" />
              </div>
            </div>

            {/* Alignment */}
            <div className="space-y-2">
              <Label className="text-xs">{t('memory.alignH') || '水平对齐'}</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['start', 'center', 'end'] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => setSettings(s => ({ ...s, alignH: a }))}
                    className={`h-7 text-xs rounded border transition-all ${settings.alignH === a ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    {a === 'start' ? (t('memory.alignLeft') || '左') : a === 'center' ? (t('memory.alignCenter') || '中') : (t('memory.alignRight') || '右')}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t('memory.alignV') || '垂直对齐'}</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['start', 'center', 'end'] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => setSettings(s => ({ ...s, alignV: a }))}
                    className={`h-7 text-xs rounded border transition-all ${settings.alignV === a ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    {a === 'start' ? (t('memory.alignTop') || '上') : a === 'center' ? (t('memory.alignMiddle') || '中') : (t('memory.alignBottom') || '下')}
                  </button>
                ))}
              </div>
            </div>

            {/* Padding */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('memory.padding') || '内边距'}</Label>
                <span className="text-xs text-muted-foreground">{settings.padding}px</span>
              </div>
              <Slider min={8} max={64} step={2} value={[settings.padding]}
                onValueChange={([v]) => setSettings(s => ({ ...s, padding: v }))} />
            </div>

            {/* Word wrap toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('memory.wordWrap') || '自动换行'}</Label>
              <button
                onClick={() => setSettings(s => ({ ...s, wordWrap: !s.wordWrap }))}
                className={`relative h-5 w-9 rounded-full transition-colors ${settings.wordWrap ? 'bg-primary' : 'bg-muted'}`}
                aria-label="toggle word wrap"
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${settings.wordWrap ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Line height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('memory.lineHeight') || '行间距'}</Label>
                <span className="text-xs text-muted-foreground">{settings.lineHeight.toFixed(2)}</span>
              </div>
              <Slider min={1} max={2.4} step={0.05} value={[settings.lineHeight]}
                onValueChange={([v]) => setSettings(s => ({ ...s, lineHeight: v }))} />
            </div>

            {/* Word break strategy */}
            <div className="space-y-2">
              <Label className="text-xs">{t('memory.wordBreak') || '断词方式'}</Label>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { id: 'normal', label: t('memory.wbNormal') || '默认' },
                  { id: 'break-word', label: t('memory.wbBreakWord') || '按词' },
                  { id: 'break-all', label: t('memory.wbBreakAll') || '强制' },
                ] as const).map(o => (
                  <button
                    key={o.id}
                    onClick={() => setSettings(s => ({ ...s, wordBreak: o.id as FlashSettings['wordBreak'] }))}
                    className={`h-7 text-xs rounded border transition-all ${settings.wordBreak === o.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <Button size="sm" variant="ghost" onClick={resetSettings} className="w-full h-7 text-xs gap-1">
              <RotateCcw className="w-3 h-3" /> {t('memory.resetSettings') || '恢复默认'}
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Card */}
      <div
        className="relative cursor-pointer mx-auto"
        style={{ perspective: 800, width: '100%', maxWidth: settings.cardWidth }}
        onClick={() => setShowBack(s => !s)}
      >
        <motion.div
          className="relative w-full rounded-xl border-2 shadow-sm"
          style={{
            minHeight: settings.cardHeight,
            transformStyle: 'preserve-3d',
            borderColor: settings.borderColor,
            fontFamily: settings.fontFamily,
          }}
          animate={{ rotateY: showBack ? 180 : 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col rounded-xl overflow-y-auto"
            style={{
              backfaceVisibility: 'hidden',
              backgroundColor: settings.frontBg,
              color: settings.textColor,
              padding: settings.padding,
              alignItems: settings.alignH === 'start' ? 'flex-start' : settings.alignH === 'end' ? 'flex-end' : 'center',
              justifyContent: settings.alignV === 'start' ? 'flex-start' : settings.alignV === 'end' ? 'flex-end' : 'center',
              textAlign: settings.alignH === 'start' ? 'left' : settings.alignH === 'end' ? 'right' : 'center',
            }}
          >
            <span className="text-xs opacity-60 mb-1">{t('memory.front')}</span>
            {hasFrontImage && (
              <img src={card.wordImage} alt="" className="max-h-28 max-w-full object-contain rounded-lg mb-2" />
            )}
            {card.word && (
              <span
                className="font-bold max-w-full"
                style={{
                  fontSize: `${(hasFrontImage ? 18 : 28) * fs}px`,
                  color: settings.textColor,
                  lineHeight: settings.lineHeight,
                  whiteSpace: settings.wordWrap ? 'pre-wrap' : 'nowrap',
                  wordBreak: settings.wordBreak,
                  overflowWrap: settings.wordBreak === 'break-all' ? 'anywhere' : 'break-word',
                  overflow: settings.wordWrap ? 'visible' : 'hidden',
                  textOverflow: settings.wordWrap ? 'clip' : 'ellipsis',
                }}
              >
                {card.word}
              </span>
            )}
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col rounded-xl overflow-y-auto"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              backgroundColor: settings.backBg,
              color: settings.textColor,
              padding: settings.padding,
              alignItems: settings.alignH === 'start' ? 'flex-start' : settings.alignH === 'end' ? 'flex-end' : 'center',
              justifyContent: settings.alignV === 'start' ? 'flex-start' : settings.alignV === 'end' ? 'flex-end' : 'center',
              textAlign: settings.alignH === 'start' ? 'left' : settings.alignH === 'end' ? 'right' : 'center',
            }}
          >
            <span className="text-xs opacity-60 mb-1">{t('memory.back')}</span>
            {hasBackImage && (
              <img src={card.definitionImage} alt="" className="max-h-28 max-w-full object-contain rounded-lg mb-2" />
            )}
            {card.definition && (
              <span
                className="font-semibold max-w-full"
                style={{
                  fontSize: `${(hasBackImage ? 16 : 20) * fs}px`,
                  color: settings.textColor,
                  lineHeight: settings.lineHeight,
                  whiteSpace: settings.wordWrap ? 'pre-wrap' : 'nowrap',
                  wordBreak: settings.wordBreak,
                  overflowWrap: settings.wordBreak === 'break-all' ? 'anywhere' : 'break-word',
                  overflow: settings.wordWrap ? 'visible' : 'hidden',
                  textOverflow: settings.wordWrap ? 'clip' : 'ellipsis',
                }}
              >
                {card.definition}
              </span>
            )}
            {card.example && (
              <span
                className="opacity-70 mt-2 italic max-w-full"
                style={{
                  fontSize: `${12 * fs}px`,
                  lineHeight: settings.lineHeight,
                  whiteSpace: settings.wordWrap ? 'pre-wrap' : 'nowrap',
                  wordBreak: settings.wordBreak,
                  overflowWrap: settings.wordBreak === 'break-all' ? 'anywhere' : 'break-word',
                }}
              >
                "{card.example}"
              </span>
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
}
