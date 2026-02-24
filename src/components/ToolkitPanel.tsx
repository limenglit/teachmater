import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Link as LinkIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import BarrageDiscussion from './BarrageDiscussion';

// Command card flash overlay
function CommandFlash({ text, emoji, onDone }: { text: string; emoji: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
      onClick={onDone}
    >
      <div className="bg-card rounded-3xl shadow-elevated p-12 text-center">
        <div className="text-7xl mb-4">{emoji}</div>
        <div className="text-3xl font-bold text-foreground">{text}</div>
      </div>
    </motion.div>
  );
}

export default function ToolkitPanel() {
  return (
    <div className="flex-1 p-4 sm:p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6">课堂工具箱</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <BarrageDiscussion />
          <CountdownTimer />
          <CommandCards />
          <QRCodeGenerator />
        </div>
      </div>
    </div>
  );
}

function CountdownTimer() {
  const [totalSeconds, setTotalSeconds] = useState(300); // 5 min default
  const [remaining, setRemaining] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number>(0);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

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

  const handleReset = () => {
    setIsRunning(false);
    setRemaining(totalSeconds);
  };

  const handleTimeChange = (field: 'min' | 'sec', val: number) => {
    const newTotal = field === 'min' ? val * 60 + (totalSeconds % 60) : Math.floor(totalSeconds / 60) * 60 + val;
    setTotalSeconds(newTotal);
    if (!isRunning) setRemaining(newTotal);
  };

  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">⏳ 倒计时器</h3>

      {/* Time display */}
      <div className="text-center mb-4">
        <div className={`text-5xl font-light tabular-nums tracking-wider ${remaining === 0 ? 'text-destructive' : 'text-foreground'}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-full mt-4 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Time input */}
      {!isRunning && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <Input
            type="number"
            min={0}
            max={99}
            value={Math.floor(totalSeconds / 60)}
            onChange={e => handleTimeChange('min', Number(e.target.value))}
            className="w-16 h-8 text-center text-sm"
          />
          <span className="text-muted-foreground">:</span>
          <Input
            type="number"
            min={0}
            max={59}
            value={totalSeconds % 60}
            onChange={e => handleTimeChange('sec', Number(e.target.value))}
            className="w-16 h-8 text-center text-sm"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-2">
        <Button
          variant={isRunning ? 'outline' : 'default'}
          size="sm"
          onClick={() => setIsRunning(!isRunning)}
          disabled={remaining === 0 && !isRunning}
          className="gap-1"
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isRunning ? '暂停' : '开始'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> 重置
        </Button>
      </div>
    </div>
  );
}

function CommandCards() {
  const [flashCommand, setFlashCommand] = useState<{ text: string; emoji: string } | null>(null);

  const commands = [
    { text: '保持安静', emoji: '🤫' },
    { text: '分组讨论', emoji: '👥' },
    { text: '独立完成', emoji: '🧑‍🎓' },
    { text: '同桌交流', emoji: '🤝' },
    { text: '认真听讲', emoji: '👂' },
    { text: '举手发言', emoji: '✋' },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">📢 课堂指令卡</h3>
      <div className="grid grid-cols-2 gap-2">
        {commands.map(cmd => (
          <button
            key={cmd.text}
            onClick={() => setFlashCommand(cmd)}
            className="flex flex-col items-center gap-1 p-3 rounded-xl border border-border hover:bg-accent hover:border-primary/30 transition-all"
          >
            <span className="text-2xl">{cmd.emoji}</span>
            <span className="text-xs text-foreground font-medium">{cmd.text}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {flashCommand && (
          <CommandFlash
            text={flashCommand.text}
            emoji={flashCommand.emoji}
            onDone={() => setFlashCommand(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function QRCodeGenerator() {
  const [url, setUrl] = useState('');

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <LinkIcon className="w-4 h-4" /> 二维码生成器
      </h3>

      <Input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="输入网址..."
        className="mb-4"
      />

      {url.trim() && (
        <div className="flex flex-col items-center gap-3">
          <div className="bg-background p-3 rounded-xl border border-border">
            <QRCodeSVG value={url} size={140} level="M" />
          </div>
          <p className="text-xs text-muted-foreground text-center break-all max-w-full">{url}</p>
        </div>
      )}

      {!url.trim() && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          输入网址即可实时生成二维码
        </div>
      )}
    </div>
  );
}
