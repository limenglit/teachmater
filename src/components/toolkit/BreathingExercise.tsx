import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

type Phase = 'inhale' | 'hold' | 'exhale' | 'idle';

const PHASE_DURATION: Record<Exclude<Phase, 'idle'>, number> = {
  inhale: 4000,
  hold: 4000,
  exhale: 4000,
};

export default function BreathingExercise() {
  const { t } = useLanguage();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [cycles, setCycles] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cyclePhases = (current: Phase) => {
    if (current === 'idle') return;
    const next: Record<Exclude<Phase, 'idle'>, Phase> = { inhale: 'hold', hold: 'exhale', exhale: 'inhale' };
    const nextPhase = next[current as Exclude<Phase, 'idle'>];
    if (current === 'exhale') setCycles(c => c + 1);
    setPhase(nextPhase);
    timerRef.current = setTimeout(() => cyclePhases(nextPhase), PHASE_DURATION[nextPhase as Exclude<Phase, 'idle'>]);
  };

  const start = () => {
    setRunning(true);
    setPhase('inhale');
    setCycles(0);
    timerRef.current = setTimeout(() => cyclePhases('inhale'), PHASE_DURATION.inhale);
  };

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunning(false);
    setPhase('idle');
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { stop(); setFullscreen(false); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  const phaseLabel = phase === 'idle' ? t('breathe.ready') : t(`breathe.${phase}`);
  const circleScale = phase === 'inhale' ? 1.4 : phase === 'hold' ? 1.4 : phase === 'exhale' ? 0.8 : 1;

  const Circle = () => (
    <motion.div
      animate={{ scale: circleScale }}
      transition={{ duration: phase === 'idle' ? 0.3 : PHASE_DURATION[phase as Exclude<Phase, 'idle'>] / 1000, ease: 'easeInOut' }}
      className={`rounded-full flex items-center justify-center ${fullscreen ? 'w-48 h-48' : 'w-28 h-28'} bg-primary/20 border-2 border-primary/40`}
    >
      <span className={`font-semibold text-primary ${fullscreen ? 'text-2xl' : 'text-sm'}`}>{phaseLabel}</span>
    </motion.div>
  );

  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center"
      >
        <Circle />
        <p className="mt-6 text-muted-foreground text-sm">{t('breathe.cycles')}: {cycles}</p>
        <div className="flex gap-3 mt-4">
          {!running && <Button onClick={start}>{t('breathe.start')}</Button>}
          {running && <Button variant="outline" onClick={stop}>{t('breathe.stop')}</Button>}
          <Button variant="ghost" onClick={() => { stop(); setFullscreen(false); }}>{t('breathe.exit')}</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4">🫁 {t('breathe.title')}</h3>
      <div className="flex justify-center mb-4"><Circle /></div>
      {cycles > 0 && <p className="text-center text-xs text-muted-foreground mb-2">{t('breathe.cycles')}: {cycles}</p>}
      <div className="flex gap-2">
        {!running ? (
          <Button size="sm" className="flex-1" onClick={start}>{t('breathe.start')}</Button>
        ) : (
          <Button size="sm" variant="outline" className="flex-1" onClick={stop}>{t('breathe.stop')}</Button>
        )}
        <Button size="sm" variant="outline" onClick={() => { if (!running) start(); setFullscreen(true); }}>
          {t('breathe.fullscreen')}
        </Button>
      </div>
    </div>
  );
}
