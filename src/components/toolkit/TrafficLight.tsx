import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type LightColor = 'red' | 'yellow' | 'green';

const LIGHT_CONFIG: Record<LightColor, { bg: string; glow: string; label: string }> = {
  red: { bg: 'bg-red-500', glow: 'shadow-[0_0_30px_rgba(239,68,68,0.6)]', label: 'traffic.stop' },
  yellow: { bg: 'bg-yellow-400', glow: 'shadow-[0_0_30px_rgba(250,204,21,0.6)]', label: 'traffic.wait' },
  green: { bg: 'bg-green-500', glow: 'shadow-[0_0_30px_rgba(34,197,94,0.6)]', label: 'traffic.go' },
};

export default function TrafficLight() {
  const { t } = useLanguage();
  const [active, setActive] = useState<LightColor>('green');
  const [fullscreen, setFullscreen] = useState(false);

  const handleClick = (color: LightColor) => {
    setActive(color);
  };

  const Light = ({ color }: { color: LightColor }) => {
    const isActive = active === color;
    const cfg = LIGHT_CONFIG[color];
    return (
      <button
        onClick={() => handleClick(color)}
        className={`rounded-full transition-all duration-300 ${
          fullscreen ? 'w-28 h-28' : 'w-14 h-14'
        } ${isActive ? `${cfg.bg} ${cfg.glow}` : 'bg-muted/60'}`}
      />
    );
  };

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === '1') setActive('red');
      if (e.key === '2') setActive('yellow');
      if (e.key === '3') setActive('green');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center cursor-pointer"
        onClick={() => setFullscreen(false)}
      >
        <div className="bg-card/80 rounded-3xl p-8 flex flex-col items-center gap-6 border border-border" onClick={e => e.stopPropagation()}>
          <Light color="red" />
          <Light color="yellow" />
          <Light color="green" />
        </div>
        <p className="text-3xl font-bold mt-6 text-foreground">{t(LIGHT_CONFIG[active].label)}</p>
        <p className="text-sm text-muted-foreground mt-4">{t('traffic.hint')}</p>
      </motion.div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4">🚦 {t('traffic.title')}</h3>
      <div className="flex items-center justify-center gap-3 mb-4">
        <Light color="red" />
        <Light color="yellow" />
        <Light color="green" />
      </div>
      <p className="text-center text-sm font-medium text-foreground mb-3">{t(LIGHT_CONFIG[active].label)}</p>
      <Button size="sm" variant="outline" className="w-full" onClick={() => setFullscreen(true)}>
        {t('traffic.fullscreen')}
      </Button>
    </div>
  );
}
