import { useState, useEffect } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
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

export default function ToolkitPanel() {
  const { t } = useLanguage();
  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-4 pr-2 sm:p-8 sm:pr-4">
      <div className="max-w-5xl mx-auto pb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6">{t('toolkit.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <BarrageDiscussion />
          <CountdownTimer />
          <NoiseDetector />
          <Scoreboard />
          <RandomAssigner />
          <LotteryDrawer />
          <PollManager />
          <Stopwatch />
          <TrafficLight />
          <BreathingExercise />
          <TextMagnifier />
          <TaskChecklist />
          <SeatRollCall />
          <CommandCards />
          <QRCodeGenerator />
        </div>
      </div>
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
        <div className="flex flex-col items-center gap-3">
          <div className="bg-background p-3 rounded-xl border border-border">
            <QRCodeSVG value={url.trim()} size={140} level="M" />
          </div>
          <p className="text-xs text-muted-foreground text-center break-all max-w-full">{url}</p>
          <p className="text-xs text-muted-foreground text-center">{t('qr.scanTip')}</p>
        </div>
      )}

      {!url.trim() && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          {t('qr.emptyTip')}
        </div>
      )}
    </div>
  );
}
