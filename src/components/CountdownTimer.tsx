import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Maximize, Minimize, Settings, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';

// TTS voice reminder
function speakReminder(secondsLeft: number) {
  if (!('speechSynthesis' in window)) return;
  const msg = new SpeechSynthesisUtterance(`还剩${secondsLeft}秒`);
  msg.lang = 'zh-CN';
  msg.rate = 1.1;
  msg.volume = 1;
  speechSynthesis.speak(msg);
}

export default function CountdownTimer() {
  const [totalSeconds, setTotalSeconds] = useState(300);
  const [remaining, setRemaining] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<number>(0);

  // Reminder settings
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderSeconds, setReminderSeconds] = useState(30);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [reminded, setReminded] = useState(false);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  // Reset reminded flag when timer resets or reminder config changes
  useEffect(() => {
    if (!isRunning) setReminded(false);
  }, [isRunning, reminderSeconds]);

  useEffect(() => {
    if (isRunning && remaining > 0) {
      intervalRef.current = window.setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, remaining]);

  // Reminder trigger
  useEffect(() => {
    if (!reminderEnabled || reminded || !isRunning) return;
    if (remaining === reminderSeconds && remaining > 0) {
      setReminded(true);
      if (voiceEnabled) speakReminder(remaining);
    }
  }, [remaining, reminderEnabled, reminderSeconds, voiceEnabled, reminded, isRunning]);

  // ESC to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

  const handleReset = () => {
    setIsRunning(false);
    setRemaining(totalSeconds);
    setReminded(false);
  };

  const handleTimeChange = (field: 'min' | 'sec', val: number) => {
    const newTotal = field === 'min' ? val * 60 + (totalSeconds % 60) : Math.floor(totalSeconds / 60) * 60 + val;
    setTotalSeconds(newTotal);
    if (!isRunning) setRemaining(newTotal);
  };

  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const isInReminder = reminderEnabled && remaining <= reminderSeconds && remaining > 0 && isRunning;
  const isUrgent = remaining <= 10 && remaining > 0;
  const isDone = remaining === 0;

  // Color logic: reminder zone → destructive (red)
  const isAlert = isInReminder || isUrgent || isDone;

  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const reminderSettingsUI = (
    <div className="space-y-3 text-sm" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">启用提醒</span>
        <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
      </div>
      {reminderEnabled && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">提醒时间</span>
              <span className="text-foreground font-medium tabular-nums">{reminderSeconds}秒前</span>
            </div>
            <Slider
              value={[reminderSeconds]}
              onValueChange={v => setReminderSeconds(v[0])}
              min={5} max={Math.max(10, Math.min(totalSeconds - 1, 120))} step={5}
              className="w-full"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              语音播报
            </span>
            <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
          </div>
        </>
      )}
    </div>
  );

  const fullscreenOverlay = isFullscreen
    ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
          onClick={() => {}}
        >
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="提醒设置"
            >
              <Settings className="w-6 h-6" />
            </button>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-3 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="退出全屏 (ESC)"
            >
              <Minimize className="w-6 h-6" />
            </button>
          </div>

          {/* Fullscreen settings panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-20 right-6 bg-card border border-border rounded-xl p-4 w-64 shadow-lg"
                onClick={e => e.stopPropagation()}
              >
                <h4 className="font-medium text-foreground mb-3">⏰ 提醒设置</h4>
                {reminderSettingsUI}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reminder badge */}
          <AnimatePresence>
            {isInReminder && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 rounded-full text-sm font-medium"
              >
                ⏰ 还剩 {remaining} 秒
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative mb-8">
            <svg width="320" height="320" viewBox="0 0 320 320">
              <circle cx="160" cy="160" r="150" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <motion.circle
                cx="160" cy="160" r="150" fill="none"
                stroke={isAlert ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 150}
                animate={{ strokeDashoffset: 2 * Math.PI * 150 * (1 - progress) }}
                transition={{ duration: 0.5 }}
                transform="rotate(-90 160 160)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className={`text-8xl font-extralight tabular-nums tracking-wider ${isAlert ? 'text-destructive' : 'text-foreground'}`}
                animate={isUrgent || isInReminder ? { scale: [1, 1.05, 1] } : {}}
                transition={isUrgent || isInReminder ? { repeat: Infinity, duration: 1 } : {}}
              >
                {timeDisplay}
              </motion.span>
              {isDone && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl text-destructive mt-2 font-medium"
                >
                  时间到！
                </motion.span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant={isRunning ? 'outline' : 'default'} size="lg"
              onClick={() => setIsRunning(!isRunning)}
              disabled={isDone && !isRunning}
              className="gap-2 text-lg px-8 h-14"
            >
              {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {isRunning ? '暂停' : '开始'}
            </Button>
            <Button variant="outline" size="lg" onClick={handleReset} className="gap-2 text-lg px-8 h-14">
              <RotateCcw className="w-5 h-5" /> 重置
            </Button>
          </div>
        </motion.div>
      )
    : null;

  return (
    <div
      className="bg-card rounded-2xl border border-border shadow-card p-6 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => !isFullscreen && setIsFullscreen(true)}
    >
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        ⏳ 倒计时器
        <Maximize className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
      </h3>

      {/* Time display */}
      <div className="text-center mb-4">
        <div className={`text-5xl font-light tabular-nums tracking-wider ${isAlert ? 'text-destructive' : 'text-foreground'}`}>
          {timeDisplay}
        </div>
        <div className="h-1 bg-muted rounded-full mt-4 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isAlert ? 'bg-destructive' : 'bg-primary'}`}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Time input */}
      {!isRunning && (
        <div className="flex items-center justify-center gap-2 mb-4" onClick={e => e.stopPropagation()}>
          <Input
            type="number" min={0} max={99}
            value={Math.floor(totalSeconds / 60)}
            onChange={e => handleTimeChange('min', Number(e.target.value))}
            className="w-16 h-8 text-center text-sm"
          />
          <span className="text-muted-foreground">:</span>
          <Input
            type="number" min={0} max={59}
            value={totalSeconds % 60}
            onChange={e => handleTimeChange('sec', Number(e.target.value))}
            className="w-16 h-8 text-center text-sm"
          />
        </div>
      )}

      {/* Reminder indicator */}
      {reminderEnabled && !isRunning && (
        <div className="text-center mb-3 text-xs text-muted-foreground" onClick={e => e.stopPropagation()}>
          ⏰ {reminderSeconds}秒前提醒 {voiceEnabled ? '(语音)' : '(仅变色)'}
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-2" onClick={e => e.stopPropagation()}>
        <Button
          variant={isRunning ? 'outline' : 'default'} size="sm"
          onClick={() => setIsRunning(!isRunning)}
          disabled={isDone && !isRunning}
          className="gap-1"
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isRunning ? '暂停' : '开始'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> 重置
        </Button>
      </div>

      <AnimatePresence>{fullscreenOverlay}</AnimatePresence>
    </div>
  );
}
