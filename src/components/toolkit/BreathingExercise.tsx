import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';

type Phase = 'inhale' | 'hold' | 'exhale' | 'idle';

type RhythmMode = '444' | '478';
type MusicPreset = 'ocean' | 'drone' | 'rain';

const RHYTHM_MAP: Record<RhythmMode, Record<Exclude<Phase, 'idle'>, number>> = {
  '444': { inhale: 4000, hold: 4000, exhale: 4000 },
  '478': { inhale: 4000, hold: 7000, exhale: 8000 },
};

function createNoiseBuffer(ctx: AudioContext, seconds = 2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export default function BreathingExercise() {
  const { t } = useLanguage();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [cycles, setCycles] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [rhythmMode, setRhythmMode] = useState<RhythmMode>('444');
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicPreset, setMusicPreset] = useState<MusicPreset>('ocean');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<{
    sources: Array<OscillatorNode | AudioBufferSourceNode>;
    filters: AudioNode[];
    gains: GainNode[];
  }>({ sources: [], filters: [], gains: [] });

  const currentPhaseDuration = RHYTHM_MAP[rhythmMode];

  const stopAmbient = () => {
    const nodes = audioNodesRef.current;
    for (const source of nodes.sources) {
      try {
        source.stop();
      } catch {
        // ignore source stop failures for already-stopped nodes
      }
      try {
        source.disconnect();
      } catch {
        // ignore disconnect failures
      }
    }
    for (const filter of nodes.filters) {
      try {
        filter.disconnect();
      } catch {
        // ignore disconnect failures
      }
    }
    for (const gain of nodes.gains) {
      try {
        gain.disconnect();
      } catch {
        // ignore disconnect failures
      }
    }
    audioNodesRef.current = { sources: [], filters: [], gains: [] };
  };

  const startAmbient = async (preset: MusicPreset) => {
    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      audioCtxRef.current = ctx;
    }
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    stopAmbient();

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.04;
    masterGain.connect(ctx.destination);
    audioNodesRef.current.gains.push(masterGain);

    if (preset === 'ocean') {
      const source = ctx.createBufferSource();
      source.buffer = createNoiseBuffer(ctx, 3);
      source.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 550;

      const swell = ctx.createOscillator();
      const swellGain = ctx.createGain();
      swell.type = 'sine';
      swell.frequency.value = 0.09;
      swellGain.gain.value = 110;

      swell.connect(swellGain);
      swellGain.connect(lowpass.frequency);

      source.connect(lowpass);
      lowpass.connect(masterGain);

      source.start();
      swell.start();
      audioNodesRef.current.sources.push(source, swell);
      audioNodesRef.current.filters.push(lowpass);
      audioNodesRef.current.gains.push(swellGain);
      return;
    }

    if (preset === 'drone') {
      masterGain.gain.value = 0.06;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g1 = ctx.createGain();
      const g2 = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.value = 196;
      osc2.frequency.value = 293.66;
      g1.gain.value = 0.25;
      g2.gain.value = 0.12;

      osc1.connect(g1);
      osc2.connect(g2);
      g1.connect(masterGain);
      g2.connect(masterGain);

      osc1.start();
      osc2.start();
      audioNodesRef.current.sources.push(osc1, osc2);
      audioNodesRef.current.gains.push(g1, g2);
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(ctx, 2.5);
    source.loop = true;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1800;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 3100;
    bandpass.Q.value = 0.6;

    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(masterGain);

    source.start();
    audioNodesRef.current.sources.push(source);
    audioNodesRef.current.filters.push(highpass, bandpass);
  };

  const cyclePhases = (current: Phase) => {
    if (current === 'idle') return;
    const next: Record<Exclude<Phase, 'idle'>, Phase> = { inhale: 'hold', hold: 'exhale', exhale: 'inhale' };
    const nextPhase = next[current as Exclude<Phase, 'idle'>];
    if (current === 'exhale') setCycles(c => c + 1);
    setPhase(nextPhase);
    timerRef.current = setTimeout(() => cyclePhases(nextPhase), currentPhaseDuration[nextPhase as Exclude<Phase, 'idle'>]);
  };

  const start = () => {
    setRunning(true);
    setPhase('inhale');
    setCycles(0);
    timerRef.current = setTimeout(() => cyclePhases('inhale'), currentPhaseDuration.inhale);
  };

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunning(false);
    setPhase('idle');
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopAmbient();
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close();
    }
  }, []);

  useEffect(() => {
    if (running) {
      stop();
      start();
    }
  }, [rhythmMode]);

  useEffect(() => {
    if (!running || !musicEnabled) {
      stopAmbient();
      return;
    }
    void startAmbient(musicPreset);
  }, [running, musicEnabled, musicPreset]);

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
  const phaseDuration = phase === 'idle' ? 0.3 : currentPhaseDuration[phase as Exclude<Phase, 'idle'>] / 1000;

  const Circle = () => {
    const ringSize = fullscreen ? 260 : 170;
    const coreSize = fullscreen ? 170 : 110;
    const labelSize = fullscreen ? 'text-2xl' : 'text-sm';

    return (
      <div className={`relative flex items-center justify-center ${fullscreen ? 'h-[320px]' : 'h-[220px]'}`}>
        {running && (
          <>
            <motion.div
              className="absolute rounded-full border border-primary/35"
              style={{ width: ringSize, height: ringSize }}
              animate={{ scale: [0.85, 1.1], opacity: [0.55, 0] }}
              transition={{ duration: phaseDuration, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full border border-primary/20"
              style={{ width: ringSize, height: ringSize }}
              animate={{ scale: [0.9, 1.2], opacity: [0.4, 0] }}
              transition={{ duration: phaseDuration, repeat: Infinity, ease: 'easeOut', delay: phaseDuration / 2 }}
            />
          </>
        )}

        <motion.div
          animate={{ scale: circleScale }}
          transition={{ duration: phaseDuration, ease: 'easeInOut' }}
          className="rounded-full border-2 border-primary/40 bg-gradient-to-b from-primary/30 to-primary/10 shadow-[0_0_0_8px_rgba(99,102,241,0.06)] flex items-center justify-center"
          style={{ width: coreSize, height: coreSize }}
        >
          <div className="flex flex-col items-center justify-center leading-none">
            <span className="text-primary/70 text-lg">~</span>
            <span className={`font-semibold text-primary ${labelSize}`}>{phaseLabel}</span>
          </div>
        </motion.div>
      </div>
    );
  };

  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center"
      >
        <Circle />
        <p className="mt-2 text-muted-foreground text-sm">{t('breathe.cycles')}: {cycles}</p>
        <div className="flex gap-3 mt-4">
          {!running && <Button onClick={start}>{t('breathe.start')}</Button>}
          {running && <Button variant="outline" onClick={stop}>{t('breathe.stop')}</Button>}
          <Button variant="ghost" onClick={() => { stop(); setFullscreen(false); }}>{t('breathe.exit')}</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6 flex flex-col min-h-[320px]">
      <h3 className="font-semibold text-foreground mb-4">🫁 {t('breathe.title')}</h3>
      <div className="pointer-events-none select-none">
        <Circle />
      </div>
      {cycles > 0 && <p className="text-center text-xs text-muted-foreground -mt-1 mb-3">{t('breathe.cycles')}: {cycles}</p>}

      <div className="mt-auto space-y-2 pt-3">
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-between"
          onClick={() => setRhythmMode(prev => (prev === '444' ? '478' : '444'))}
        >
          <span>{t('breathe.rhythm')}</span>
          <span className="font-mono">{rhythmMode === '444' ? '4-4-4' : '4-7-8'}</span>
        </Button>

        <div className="rounded-lg border border-border p-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('breathe.music')}</span>
            <Switch checked={musicEnabled} onCheckedChange={setMusicEnabled} />
          </div>
          <Select value={musicPreset} onValueChange={(value) => setMusicPreset(value as MusicPreset)}>
            <SelectTrigger className="h-8 text-xs" disabled={!musicEnabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ocean">{t('breathe.musicOcean')}</SelectItem>
              <SelectItem value="drone">{t('breathe.musicDrone')}</SelectItem>
              <SelectItem value="rain">{t('breathe.musicRain')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!running ? (
          <Button size="sm" className="w-full" onClick={start}>{t('breathe.start')}</Button>
        ) : (
          <Button size="sm" variant="outline" className="w-full" onClick={stop}>{t('breathe.stop')}</Button>
        )}
        <Button size="sm" variant="outline" className="w-full" onClick={() => { if (!running) start(); setFullscreen(true); }}>
          {t('breathe.fullscreen')}
        </Button>
      </div>
    </div>
  );
}
