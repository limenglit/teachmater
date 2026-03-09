import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TextMagnifier() {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(4); // rem

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === '+' || e.key === '=') setFontSize(s => Math.min(s + 0.5, 12));
      if (e.key === '-') setFontSize(s => Math.max(s - 0.5, 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-8 cursor-pointer"
        onClick={() => setFullscreen(false)}
      >
        <div
          className="text-foreground font-bold text-center break-words max-w-full overflow-auto"
          style={{ fontSize: `${fontSize}rem`, lineHeight: 1.3 }}
        >
          {text || t('magnify.placeholder')}
        </div>
        <div className="absolute bottom-6 flex gap-3 items-center" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => setFontSize(s => Math.max(s - 0.5, 1))}><Minus className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">{fontSize}rem</span>
          <Button size="sm" variant="outline" onClick={() => setFontSize(s => Math.min(s + 0.5, 12))}><Plus className="w-4 h-4" /></Button>
        </div>
        <p className="absolute bottom-16 text-xs text-muted-foreground">{t('magnify.hint')}</p>
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
        rows={3}
        className="mb-3 resize-none"
      />
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
