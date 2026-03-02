import { useState, useEffect } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

import BarrageDiscussion from './BarrageDiscussion';
import CountdownTimer from './CountdownTimer';

// Command card flash overlay
function CommandFlash({ text, emoji, onDone }: { text: string; emoji: string; onDone: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background cursor-pointer"
      onClick={onDone}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-center"
      >
        <div className="text-[10rem] leading-none mb-6">{emoji}</div>
        <div className="text-5xl sm:text-7xl font-bold text-foreground">{text}</div>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 0.6, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-8 text-sm text-muted-foreground"
      >
        按 ESC 或点击任意处退出
      </motion.p>
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
  const [wechatMode, setWechatMode] = useState(true);

  // Build the QR value: wrap through /go redirect for WeChat compatibility
  const getQrValue = () => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (!wechatMode) return trimmed;
    // Use the app's own /go page as intermediary
    const base = window.location.origin;
    return `${base}/go?url=${encodeURIComponent(trimmed)}`;
  };

  const qrValue = getQrValue();

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

      <label className="flex items-center gap-2 mb-4 text-sm text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={wechatMode}
          onChange={e => setWechatMode(e.target.checked)}
          className="rounded border-border"
        />
        微信兼容模式（推荐）
      </label>

      {url.trim() && qrValue && (
        <div className="flex flex-col items-center gap-3">
          <div className="bg-background p-3 rounded-xl border border-border">
            <QRCodeSVG value={qrValue} size={140} level="M" />
          </div>
          <p className="text-xs text-muted-foreground text-center break-all max-w-full">{url}</p>
          {wechatMode && (
            <p className="text-xs text-primary/70 text-center">🛡️ 微信扫码将引导在浏览器中打开</p>
          )}
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
