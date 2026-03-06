import { useState, useEffect } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

import BarrageDiscussion from './BarrageDiscussion';
import CountdownTimer from './CountdownTimer';

type CommandItem = {
  text: string;
  emoji?: string;
  iconUrl?: string;
};

// Command card flash overlay
function CommandFlash({ text, emoji, iconUrl, onDone }: { text: string; emoji?: string; iconUrl?: string; onDone: () => void }) {
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
        <div className="text-[10rem] leading-none mb-6 flex justify-center">
          {iconUrl ? (
            <div className="w-56 h-56 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <img src={iconUrl} alt={text} className="w-40 h-40" loading="lazy" />
            </div>
          ) : (
            <span>{emoji || '📢'}</span>
          )}
        </div>
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
  const [flashCommand, setFlashCommand] = useState<CommandItem | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [customCommands, setCustomCommands] = useState<CommandItem[]>([]);
  const [searchError, setSearchError] = useState('');
  const [candidateTopic, setCandidateTopic] = useState('');
  const [iconCandidates, setIconCandidates] = useState<string[]>([]);

  const commands: CommandItem[] = [
    { text: '保持安静', emoji: '🤫' },
    { text: '分组讨论', emoji: '👥' },
    { text: '独立完成', emoji: '🧑‍🎓' },
    { text: '同桌交流', emoji: '🤝' },
    { text: '认真听讲', emoji: '👂' },
    { text: '举手发言', emoji: '✋' },
  ];

  const allCommands = [...customCommands, ...commands];

  const toIconUrl = (iconName: string) => {
    const [prefix, name] = iconName.split(':');
    if (!prefix || !name) return '';
    return `https://api.iconify.design/${prefix}/${name}.svg`;
  };

  const searchTopicBadgeCandidates = async (topic: string) => {
    const terms = [topic, `${topic} education`, `${topic} class`, 'education badge'];
    const collected: string[] = [];

    for (const term of terms) {
      const resp = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(term)}&limit=10`);
      if (!resp.ok) continue;
      const data = await resp.json();
      const icons = Array.isArray(data?.icons) ? data.icons : [];
      for (const icon of icons) {
        const iconName = String(icon);
        const iconUrl = toIconUrl(iconName);
        if (!iconUrl) continue;
        if (!collected.includes(iconUrl)) {
          collected.push(iconUrl);
        }
        if (collected.length >= 6) {
          return collected;
        }
      }
    }
    return collected;
  };

  const addCustomCommand = (topic: string, iconUrl: string) => {
    const next: CommandItem = { text: topic, iconUrl };
    setCustomCommands(prev => {
      const deduped = prev.filter(item => item.text !== topic);
      return [next, ...deduped].slice(0, 8);
    });
    setFlashCommand(next);
  };

  const loadIconCandidates = async () => {
    const topic = customTopic.trim();
    if (!topic) return;
    setLoadingTopic(true);
    setSearchError('');
    setIconCandidates([]);

    try {
      const candidates = await searchTopicBadgeCandidates(topic);
      const picked = candidates.slice(0, 6);
      if (picked.length < 3) {
        throw new Error('候选图标不足');
      }
      setCandidateTopic(topic);
      setIconCandidates(picked);
    } catch (error) {
      setSearchError('联网检索图标失败或候选不足，请换个主题重试');
    } finally {
      setLoadingTopic(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">📢 课堂指令卡</h3>
      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
          <Input
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            placeholder="输入课堂指令主题，如：小组辩论"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void loadIconCandidates();
              }
            }}
          />
          <Button onClick={() => void loadIconCandidates()} disabled={loadingTopic || !customTopic.trim()}>
            {loadingTopic ? '检索中...' : '检索徽章'}
          </Button>
        </div>
        {searchError && <p className="text-xs text-destructive">{searchError}</p>}
        {iconCandidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">已找到 {iconCandidates.length} 个候选图标，请点选一个用于“{candidateTopic}”</p>
            <div className="grid grid-cols-3 gap-2">
              {iconCandidates.map((url, idx) => (
                <button
                  key={`${url}-${idx}`}
                  onClick={() => {
                    addCustomCommand(candidateTopic, url);
                    setCustomTopic('');
                    setIconCandidates([]);
                    setCandidateTopic('');
                  }}
                  className="rounded-lg border border-border bg-background p-2 hover:border-primary/50 hover:bg-accent transition-all"
                  title={`选择候选 ${idx + 1}`}
                >
                  <span className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 inline-flex items-center justify-center mx-auto">
                    <img src={url} alt={`候选图标${idx + 1}`} className="w-6 h-6" loading="lazy" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {allCommands.map(cmd => (
          <button
            key={`${cmd.text}-${cmd.iconUrl || cmd.emoji || 'builtin'}`}
            onClick={() => setFlashCommand(cmd)}
            className="flex flex-col items-center gap-1 p-3 rounded-xl border border-border hover:bg-accent hover:border-primary/30 transition-all"
          >
            {cmd.iconUrl ? (
              <span className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 inline-flex items-center justify-center">
                <img src={cmd.iconUrl} alt={cmd.text} className="w-5 h-5" loading="lazy" />
              </span>
            ) : (
              <span className="text-2xl">{cmd.emoji}</span>
            )}
            <span className="text-xs text-foreground font-medium">{cmd.text}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {flashCommand && (
          <CommandFlash
            text={flashCommand.text}
            emoji={flashCommand.emoji}
            iconUrl={flashCommand.iconUrl}
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
            <QRCodeSVG value={url.trim()} size={140} level="M" />
          </div>
          <p className="text-xs text-muted-foreground text-center break-all max-w-full">{url}</p>
          <p className="text-xs text-muted-foreground text-center">📱 请用手机浏览器扫描访问</p>
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
