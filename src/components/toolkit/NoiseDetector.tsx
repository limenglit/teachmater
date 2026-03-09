import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export default function NoiseDetector() {
  const { t } = useLanguage();
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0); // 0-100
  const [threshold, setThreshold] = useState(60);
  const [warning, setWarning] = useState(false);
  const [peak, setPeak] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const startMonitor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;
      setActive(true);
      setPeak(0);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setLevel(normalized);
        setPeak(prev => Math.max(prev, normalized));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Permission denied or no mic
    }
  }, []);

  const stopMonitor = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    setActive(false);
    setLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // Warning logic
  useEffect(() => {
    if (active && level > threshold) {
      setWarning(true);
      const timer = setTimeout(() => setWarning(false), 600);
      return () => clearTimeout(timer);
    }
  }, [level, threshold, active]);

  const getBarColor = (val: number) => {
    if (val > threshold) return 'bg-destructive';
    if (val > threshold * 0.7) return 'bg-warning';
    return 'bg-primary';
  };

  return (
    <div className={`bg-card rounded-2xl border shadow-card p-6 transition-colors ${warning ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Volume2 className="w-4 h-4" /> {t('noise.title')}
      </h3>

      {/* Level meter */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{t('noise.level')}</span>
          <span className="font-mono font-bold text-foreground text-lg">{level}</span>
        </div>
        <div className="h-6 bg-muted rounded-full overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-100 ${getBarColor(level)}`}
            style={{ width: `${level}%` }}
          />
          {/* Threshold marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
            style={{ left: `${threshold}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
          <span>{t('noise.quiet')}</span>
          <span>{t('noise.loud')}</span>
        </div>
      </div>

      {/* Threshold slider */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{t('noise.threshold')}</span>
          <span className="font-mono">{threshold}</span>
        </div>
        <Slider
          value={[threshold]}
          onValueChange={([v]) => setThreshold(v)}
          min={20}
          max={90}
          step={5}
        />
      </div>

      {/* Peak display */}
      {active && (
        <div className="text-xs text-muted-foreground mb-3">
          {t('noise.peak')}: <span className="font-mono font-semibold text-foreground">{peak}</span>
        </div>
      )}

      {/* Warning flash */}
      {warning && (
        <div className="text-center py-2 mb-3 rounded-lg bg-destructive/10 text-destructive text-sm font-bold animate-pulse">
          🔊 {t('noise.tooLoud')}
        </div>
      )}

      <Button
        onClick={active ? stopMonitor : startMonitor}
        variant={active ? 'destructive' : 'default'}
        className="w-full gap-2"
      >
        {active ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {active ? t('noise.stop') : t('noise.start')}
      </Button>
    </div>
  );
}
