import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Link as LinkIcon, Download, Copy, X, Code2, MessagesSquare, Timer, Volume2, Trophy, Shuffle, Dices, BarChart3, Clock, CircleDot, Wind, Type, MonitorPlay, ListChecks, Braces, Image as ImageIcon, Megaphone, QrCode, Brain, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatureConfig } from '@/contexts/FeatureConfigContext';
import { toast } from '@/hooks/use-toast';
import { downloadQrFromContainer } from '@/lib/qr-download';
import QRActionPanel from '@/components/qr/QRActionPanel';
// import Community from './Community';
import {
  type CommandItem,
  buildCustomCommand,
  searchTopicBadgeCandidates,
  shouldFallbackToDefault,
} from '@/lib/command-cards';

import BarrageDiscussion from './BarrageDiscussion';
import CountdownTimer from './CountdownTimer';
import NoiseDetector from './toolkit/NoiseDetector';
import RandomAssigner from './toolkit/RandomAssigner';
import Scoreboard from './toolkit/Scoreboard';
import LotteryDrawer from './toolkit/LotteryDrawer';
import PollManager from './toolkit/PollManager';
import Stopwatch from './toolkit/Stopwatch';
import TrafficLight from './toolkit/TrafficLight';
import BreathingExercise from './toolkit/BreathingExercise';
import TextMagnifier from './toolkit/TextMagnifier';
import TaskChecklist from './toolkit/TaskChecklist';
import ScreenCaptureTool from './toolkit/ScreenCaptureTool';
import CodeVisualizerTool from './toolkit/CodeVisualizerTool';
import ImageEditorTool from './toolkit/ImageEditorTool';
import MemoryAidTool from './toolkit/MemoryAidTool';
import CoderMateTool from './toolkit/CoderMateTool';


// Command card flash overlay
function CommandFlash({ text, emoji, iconUrl, onDone }: { text: string; emoji?: string; iconUrl?: string; onDone: () => void }) {
  const { t } = useLanguage();
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
        {t('cmd.escOrClick')}
      </motion.p>
    </motion.div>
  );
}

type ToolDef = { id: string; zh: [string, string]; en: [string, string]; icon: LucideIcon; render: () => React.ReactNode };

const TOOLS: ToolDef[] = [
  { id: 'coderMate', zh: ['编码搭子', '代码调试与讲解助手'], en: ['CoderMate', 'Code debugging helper'], icon: Code2, render: () => <CoderMateTool /> },
  { id: 'barrage', zh: ['讨论弹幕', '扫码发弹幕，历史回看与报告'], en: ['Discussion Wall', 'Live barrage with history'], icon: MessagesSquare, render: () => <BarrageDiscussion /> },
  { id: 'countdown', zh: ['倒计时', '课堂活动限时提醒'], en: ['Countdown', 'Timed class activities'], icon: Timer, render: () => <CountdownTimer /> },
  { id: 'noise', zh: ['噪音检测', '实时监测课堂音量'], en: ['Noise Meter', 'Monitor class volume'], icon: Volume2, render: () => <NoiseDetector /> },
  { id: 'scoreboard', zh: ['评分板', '小组积分实时累计'], en: ['Scoreboard', 'Track team points'], icon: Trophy, render: () => <Scoreboard /> },
  { id: 'randomAssigner', zh: ['随机分配', '任务与角色随机分配'], en: ['Random Assigner', 'Assign tasks randomly'], icon: Shuffle, render: () => <RandomAssigner /> },
  { id: 'lottery', zh: ['抽奖 / 随机数', '随机数与抽签'], en: ['Lottery', 'Random numbers & draws'], icon: Dices, render: () => <LotteryDrawer /> },
  { id: 'poll', zh: ['实时投票', '扫码投票，结果即时统计'], en: ['Live Poll', 'Scan-to-vote with results'], icon: BarChart3, render: () => <PollManager /> },
  { id: 'stopwatch', zh: ['秒表', '计时与分段记录'], en: ['Stopwatch', 'Time and laps'], icon: Clock, render: () => <Stopwatch /> },
  { id: 'trafficLight', zh: ['课堂信号灯', '红黄绿提示课堂状态'], en: ['Traffic Light', 'Signal class status'], icon: CircleDot, render: () => <TrafficLight /> },
  { id: 'breathing', zh: ['呼吸练习', '引导学生放松专注'], en: ['Breathing', 'Calm and focus'], icon: Wind, render: () => <BreathingExercise /> },
  { id: 'textMagnifier', zh: ['文字放大器', '大字投屏展示'], en: ['Text Magnifier', 'Show big text'], icon: Type, render: () => <TextMagnifier /> },
  { id: 'screenCapture', zh: ['截图 / 录屏', '截取或录制屏幕'], en: ['Screen Capture', 'Capture or record screen'], icon: MonitorPlay, render: () => <ScreenCaptureTool /> },
  { id: 'taskChecklist', zh: ['课堂任务清单', '扫码打卡，进度实时追踪'], en: ['Task Checklist', 'Track student progress'], icon: ListChecks, render: () => <TaskChecklist /> },
  { id: 'codeVisualizer', zh: ['代码可视化', '代码执行过程演示'], en: ['Code Visualizer', 'Step through code'], icon: Braces, render: () => <CodeVisualizerTool /> },
  { id: 'imageEditor', zh: ['图片编辑器', '裁剪、擦除、图层编辑'], en: ['Image Editor', 'Crop, erase, layers'], icon: ImageIcon, render: () => <ImageEditorTool /> },
  { id: 'commandCards', zh: ['课堂指令卡', '全屏展示课堂指令'], en: ['Command Cards', 'Full-screen class cues'], icon: Megaphone, render: () => <CommandCards /> },
  { id: 'qrCode', zh: ['二维码生成器', '把网址变成二维码'], en: ['QR Generator', 'Turn links into QR'], icon: QrCode, render: () => <QRCodeGenerator /> },
  { id: 'memoryAid', zh: ['辅助记忆', '配对与闪卡记忆游戏'], en: ['Memory Aid', 'Match & flashcards'], icon: Brain, render: () => <MemoryAidTool /> },
];

export default function ToolkitPanel() {
  const { t, lang } = useLanguage();
  const { isToolkitToolVisible } = useFeatureConfig();
  const [openId, setOpenId] = useState<string | null>(null);
  // Tools stay mounted after first open so running timers/sessions survive closing the panel.
  const [mounted, setMounted] = useState<string[]>([]);
  const tools = TOOLS.filter(tool => isToolkitToolVisible(tool.id as never));
  const label = (tool: ToolDef) => (lang === 'zh' ? tool.zh : tool.en);

  const open = (id: string) => {
    setMounted(prev => (prev.includes(id) ? prev : [...prev, id]));
    setOpenId(id);
  };

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  return (
    <div data-testid="toolkit-panel" className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-4 pr-2 sm:p-8 sm:pr-4">
      <div className="max-w-5xl mx-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6">{t('toolkit.title')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {tools.map(tool => {
            const [name, desc] = label(tool);
            const Icon = tool.icon;
            const active = mounted.includes(tool.id);
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => open(tool.id)}
                className="group h-36 sm:h-40 flex flex-col items-start text-left gap-2 p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-card hover:border-primary/40 hover:bg-accent/40 transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="font-semibold text-foreground text-sm sm:text-base leading-tight">{name}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">{desc}</span>
                {active && <span className="mt-auto text-[10px] text-primary">{lang === 'zh' ? '已打开' : 'Open'}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {mounted.map(id => {
        const tool = TOOLS.find(x => x.id === id);
        if (!tool) return null;
        const visible = openId === id;
        return (
          <div
            key={id}
            className={visible ? 'toolkit-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/30 p-0 sm:p-6' : 'hidden'}
            onClick={() => setOpenId(null)}
          >
            <div
              role="dialog"
              aria-label={label(tool)[0]}
              className="toolkit-window w-full sm:max-w-2xl max-h-[calc(var(--app-vh,100dvh)-1rem)] sm:max-h-[calc(var(--app-vh,100dvh)-3rem)] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-card"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 bg-card border-b border-border">
                <span className="font-semibold text-foreground">{label(tool)[0]}</span>
                <Button variant="ghost" size="icon" aria-label={lang === 'zh' ? '关闭' : 'Close'} onClick={() => setOpenId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="toolkit-window-body p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">{tool.render()}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommandCards() {
  const { t } = useLanguage();
  const [flashCommand, setFlashCommand] = useState<CommandItem | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [customCommands, setCustomCommands] = useState<CommandItem[]>([]);
  const [searchError, setSearchError] = useState('');
  const [candidateTopic, setCandidateTopic] = useState('');
  const [iconCandidates, setIconCandidates] = useState<string[]>([]);

  const commands: CommandItem[] = [
    { text: t('cmd.quiet'), emoji: '🤫' },
    { text: t('cmd.discuss'), emoji: '👥' },
    { text: t('cmd.independent'), emoji: '🧑‍🎓' },
    { text: t('cmd.pairTalk'), emoji: '🤝' },
    { text: t('cmd.listen'), emoji: '👂' },
    { text: t('cmd.raiseHand'), emoji: '✋' },
  ];

  const allCommands = [...customCommands, ...commands];

  const addCustomCommand = (topic: string, iconUrl?: string) => {
    const next = buildCustomCommand(topic, iconUrl);
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
      const candidates = await searchTopicBadgeCandidates(topic, (input) => fetch(input));
      const picked = candidates.slice(0, 6);
      if (shouldFallbackToDefault(picked)) {
        addCustomCommand(topic);
        setCustomTopic('');
        setSearchError(t('cmd.noIcon'));
        return;
      }
      setCandidateTopic(topic);
      setIconCandidates(picked);
    } catch (error) {
      addCustomCommand(topic);
      setCustomTopic('');
      setSearchError(t('cmd.searchFail'));
    } finally {
      setLoadingTopic(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">{t('cmd.title')}</h3>
      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
          <Input
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            placeholder={t('cmd.inputPlaceholder')}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void loadIconCandidates();
              }
            }}
          />
          <Button onClick={() => void loadIconCandidates()} disabled={loadingTopic || !customTopic.trim()}>
            {loadingTopic ? t('cmd.searching') : t('cmd.searchBadge')}
          </Button>
        </div>
        {searchError && <p className="text-xs text-destructive">{searchError}</p>}
        {iconCandidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t('cmd.foundIcons').replace('{0}', String(iconCandidates.length)).replace('{1}', candidateTopic)}</p>
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
                  title={`${t('cmd.selectCandidate')} ${idx + 1}`}
                >
                  <span className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 inline-flex items-center justify-center mx-auto">
                    <img src={url} alt={`${t('cmd.candidateIcon')}${idx + 1}`} className="w-6 h-6" loading="lazy" />
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
  const { t } = useLanguage();
  const [url, setUrl] = useState('');
  const qrPreviewRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <LinkIcon className="w-4 h-4" /> {t('qr.title')}
      </h3>

      <Input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder={t('qr.placeholder')}
        className="mb-4"
      />

      {url.trim() && (
        <QRActionPanel
          url={url.trim()}
          qrSize={140}
          scanTip={t('qr.scanTip')}
          qrContainerRef={qrPreviewRef}
          className="flex flex-col items-center gap-3 py-1"
          actions={(
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap"
                onClick={() => {
                  navigator.clipboard.writeText(url.trim());
                  toast({ title: t('board.shareLink') });
                }}
              >
                <Copy className="w-3.5 h-3.5" /> {t('board.shareLink')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap"
                onClick={async () => {
                  try {
                    await downloadQrFromContainer(qrPreviewRef.current, 'qrcode.png');
                    toast({ title: t('board.downloadPng') });
                  } catch {
                    toast({ title: '下载PNG失败', variant: 'destructive' });
                  }
                }}
              >
                <Download className="w-3.5 h-3.5" /> {t('board.downloadPng')}
              </Button>
            </>
          )}
        />
      )}

      {!url.trim() && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          {t('qr.emptyTip')}
        </div>
      )}
    </div>
  );
}
