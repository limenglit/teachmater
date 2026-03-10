import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Maximize2, Minus, Palette, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TextMagnifier() {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(2.5); // rem
  const [textColor, setTextColor] = useState('#111827');
  const [bgColor, setBgColor] = useState('#ffffff');

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === '+' || e.key === '=') setFontSize(s => Math.min(s + 0.25, 10));
      if (e.key === '-') setFontSize(s => Math.max(s - 0.25, 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col p-4 sm:p-6"
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex items-center justify-end gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={() => setFontSize(s => Math.max(s - 0.25, 1))}>
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-sm" style={{ color: textColor }}>{fontSize.toFixed(2)}rem</span>
          <Button size="sm" variant="outline" onClick={() => setFontSize(s => Math.min(s + 0.25, 10))}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFullscreen(false)}>
            ESC
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded-xl border p-4 sm:p-6" style={{ borderColor: `${textColor}40` }}>
          <pre
            className="m-0 font-mono whitespace-pre-wrap break-words"
            style={{
              fontSize: `${fontSize}rem`,
              lineHeight: 1.4,
              tabSize: 4,
              color: textColor,
            }}
          >
            {text || t('magnify.placeholder')}
          </pre>
        </div>

        <p className="mt-3 text-xs" style={{ color: textColor }}>{t('magnify.hint')}</p>
      </motion.div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4">🔍 {t('magnify.title')}</h3>
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t('magnify.inputPlaceholder')}
        rows={5}
        className="mb-3 font-mono"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Palette className="w-3 h-3" />
          {t('magnify.textColor')}
          <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-8 h-8 p-0 border-0 bg-transparent" />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Palette className="w-3 h-3" />
          {t('magnify.backgroundColor')}
          <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-8 h-8 p-0 border-0 bg-transparent" />
        </label>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{t('magnify.scale')}</span>
          <span>{fontSize.toFixed(2)}rem</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={0.25}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <Button
        size="sm"
        className="w-full"
        disabled={!text.trim()}
        onClick={() => setFullscreen(true)}
      >
        <Maximize2 className="w-4 h-4 mr-1" /> {t('magnify.show')}
      </Button>
    </div>
  );
}
