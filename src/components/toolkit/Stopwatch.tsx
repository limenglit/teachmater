import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Flag } from 'lucide-react';

export default function Stopwatch() {
  const { t } = useLanguage();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const start = useCallback(() => {
    startTimeRef.current = Date.now() - elapsed;
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 37);
    setRunning(true);
  }, [elapsed]);

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setElapsed(0);
    setLaps([]);
  }, []);

  const lap = useCallback(() => {
    setLaps(prev => [elapsed, ...prev]);
  }, [elapsed]);

  const fmt = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4">⏱️ {t('stopwatch.title')}</h3>
      <div className="text-center mb-4">
        <div className="text-4xl font-mono font-bold text-foreground tabular-nums">{fmt(elapsed)}</div>
      </div>
      <div className="flex gap-2 justify-center mb-3">
        {running ? (
          <Button size="sm" variant="outline" onClick={pause}><Pause className="w-4 h-4 mr-1" />{t('stopwatch.pause')}</Button>
        ) : (
          <Button size="sm" onClick={start}><Play className="w-4 h-4 mr-1" />{t('stopwatch.start')}</Button>
        )}
        {running && (
          <Button size="sm" variant="outline" onClick={lap}><Flag className="w-4 h-4 mr-1" />{t('stopwatch.lap')}</Button>
        )}
        <Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="w-4 h-4 mr-1" />{t('stopwatch.reset')}</Button>
      </div>
      {laps.length > 0 && (
        <div className="max-h-28 overflow-auto space-y-1">
          {laps.map((l, i) => (
            <div key={i} className="flex justify-between text-xs text-muted-foreground px-2">
              <span>#{laps.length - i}</span>
              <span className="font-mono">{fmt(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
