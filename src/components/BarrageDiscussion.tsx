import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, FileText, Cloud, Download, Trash2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { recordGuestAIUsage } from '@/lib/guest-ai-limit';

interface BarrageMessage {
  id: string;
  content: string;
  created_at: string;
}

interface WordCloudItem {
  word: string;
  count: number;
}

function BarrageItem({ text, index, speed }: { text: string; index: number; speed: number }) {
  const colors = [
    'text-primary', 'text-blue-500', 'text-green-500', 'text-orange-500',
    'text-pink-500', 'text-purple-500', 'text-cyan-500', 'text-yellow-500',
  ];
  const color = colors[index % colors.length];
  const top = 5 + ((index * 37) % 85);
  const duration = 8 + Math.random() * 4;
  const adjustedDuration = duration / speed;

  return (
    <motion.div
      initial={{ x: '100vw' }}
      animate={{ x: '-100%' }}
      transition={{ duration: adjustedDuration, ease: 'linear' }}
      className={`absolute whitespace-nowrap text-base sm:text-lg font-semibold ${color} pointer-events-none`}
      style={{ top: `${top}%` }}
    >
      {text}
    </motion.div>
  );
}

function WordCloudCanvas({ words }: { words: WordCloudItem[] }) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || words.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = 500;
    const h = canvas.height = 350;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const maxCount = Math.max(...words.map(w => w.count));
    const minSize = 14;
    const maxSize = 56;
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    const placed: { x: number; y: number; w: number; h: number }[] = [];

    words.forEach((item, i) => {
      const fontSize = minSize + ((item.count / maxCount) * (maxSize - minSize));
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      const metrics = ctx.measureText(item.word);
      const textW = metrics.width;
      const textH = fontSize;

      let px = w / 2, py = h / 2;
      let angle = 0, radius = 0;
      let found = false;
      for (let step = 0; step < 500; step++) {
        px = w / 2 + radius * Math.cos(angle) - textW / 2;
        py = h / 2 + radius * Math.sin(angle) + textH / 3;
        const rect = { x: px, y: py - textH, w: textW, h: textH };
        const overlaps = placed.some(p =>
          !(rect.x + rect.w < p.x || rect.x > p.x + p.w || rect.y + rect.h < p.y || rect.y > p.y + p.h)
        );
        if (!overlaps && px > 0 && py > textH && px + textW < w && py < h) {
          found = true;
          break;
        }
        angle += 0.5;
        radius += 0.6;
      }

      if (found) {
        placed.push({ x: px, y: py - textH, w: textW, h: textH });
        ctx.fillStyle = colors[i % colors.length];
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        ctx.fillText(item.word, px, py);
      }
    });
  }, [words]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = '讨论词云.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="w-full rounded-xl border border-border" style={{ maxHeight: 350 }} />
      <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
        <Download className="w-3.5 h-3.5" /> {t('barrage.saveCloud')}
      </Button>
    </div>
  );
}

export default function BarrageDiscussion() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const [topicTitle, setTopicTitle] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);
  const [creatorToken, setCreatorToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<BarrageMessage[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [visibleMessages, setVisibleMessages] = useState<BarrageMessage[]>([]);
  const [view, setView] = useState<'barrage' | 'report' | 'wordcloud'>('barrage');
  const [reportContent, setReportContent] = useState('');
  const [wordCloudData, setWordCloudData] = useState<WordCloudItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const barrageIndexRef = useRef(0);
  const reportRef = useRef<HTMLDivElement>(null);

  const discussUrl = topicId ? `${window.location.origin}/discuss/${topicId}` : '';

  const handleCreateTopic = async () => {
    if (!topicTitle.trim()) return;
    const token = crypto.randomUUID();
    const { data, error } = await supabase
      .from('discussion_topics' as any)
      .insert({ title: topicTitle.trim(), creator_token: token } as any)
      .select('id')
      .single();
    if (error) {
      toast({ title: t('barrage.createFailed'), description: error.message, variant: 'destructive' });
      return;
    }
    const id = (data as any).id;
    setTopicId(id);
    setCreatorToken(token);
    sessionStorage.setItem(`topic_token_${id}`, token);
    setMessages([]);
    setVisibleMessages([]);
    toast({ title: t('barrage.topicCreated'), description: t('barrage.topicCreatedDesc') });
  };

  const handleEditTopic = async () => {
    if (!editTitle.trim() || !topicId || !creatorToken) return;
    try {
      const { error } = await supabase.rpc('update_topic', {
        p_topic_id: topicId,
        p_token: creatorToken,
        p_title: editTitle.trim(),
      } as any);
      if (error) throw error;
      setTopicTitle(editTitle.trim());
      setEditDialogOpen(false);
      toast({ title: t('barrage.topicUpdated') });
    } catch (e: any) {
      toast({ title: t('barrage.editFailed'), description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteTopic = async () => {
    if (!topicId || !creatorToken) return;
    if (!confirm(t('barrage.deleteConfirm'))) return;
    try {
      const { error } = await supabase.rpc('delete_topic', {
        p_topic_id: topicId,
        p_token: creatorToken,
      } as any);
      if (error) throw error;
      sessionStorage.removeItem(`topic_token_${topicId}`);
      handleReset();
      toast({ title: t('barrage.topicDeleted') });
    } catch (e: any) {
      toast({ title: t('barrage.deleteFailed'), description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!topicId) return;
    supabase
      .from('barrage_messages' as any)
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(data as any[]);
          barrageIndexRef.current = (data as any[]).length;
        }
      });

    const channel = supabase
      .channel(`barrage-${topicId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'barrage_messages', filter: `topic_id=eq.${topicId}` },
        (payload) => {
          const newMsg = payload.new as BarrageMessage;
          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [topicId]);

  useEffect(() => {
    if (!isPlaying || messages.length === 0) return;
    const latest = messages.slice(-30);
    setVisibleMessages(latest);
  }, [messages, isPlaying]);

  const handleReport = async () => {
    if (messages.length === 0) {
      toast({ title: t('barrage.noData'), variant: 'destructive' });
      return;
    }
    if (!recordGuestAIUsage(isLoggedIn)) {
      toast({ title: t('ai.guestLimitReached'), variant: 'destructive' });
      return;
    }
    setAnalyzing(true);
    setView('report');
    try {
      const res = await supabase.functions.invoke('analyze-barrage', {
        body: { messages: messages.map(m => m.content), type: 'report', topic_id: topicId, creator_token: creatorToken },
      });
      if (res.error) throw res.error;
      setReportContent(res.data.result);
    } catch (e: any) {
      toast({ title: t('barrage.analyzeFailed'), description: e.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleWordCloud = async () => {
    if (messages.length === 0) {
      toast({ title: t('barrage.noData'), variant: 'destructive' });
      return;
    }
    if (!recordGuestAIUsage(isLoggedIn)) {
      toast({ title: t('ai.guestLimitReached'), variant: 'destructive' });
      return;
    }
    setAnalyzing(true);
    setView('wordcloud');
    try {
      const res = await supabase.functions.invoke('analyze-barrage', {
        body: { messages: messages.map(m => m.content), type: 'wordcloud', topic_id: topicId, creator_token: creatorToken },
      });
      if (res.error) throw res.error;
      const text = res.data.result;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as WordCloudItem[];
        setWordCloudData(parsed);
      } else {
        toast({ title: t('barrage.cloudParseFail'), variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: t('barrage.analyzeFailed'), description: e.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `讨论弹幕-${topicTitle}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const handleReset = () => {
    setTopicId(null);
    setCreatorToken(null);
    setTopicTitle('');
    setMessages([]);
    setVisibleMessages([]);
    setReportContent('');
    setWordCloudData([]);
    setView('barrage');
  };

  if (!topicId) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">{t('barrage.title')}</h3>
        <div className="space-y-3">
          <Input
            value={topicTitle}
            onChange={e => setTopicTitle(e.target.value)}
            placeholder={t('barrage.inputTopic')}
            className="text-sm"
          />
          <Button onClick={handleCreateTopic} disabled={!topicTitle.trim()} className="w-full gap-2">
            {t('barrage.publish')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{t('barrage.privacy')}</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-4 sm:p-6 col-span-1 md:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          💬 {topicTitle}
          <span className="text-xs font-normal text-muted-foreground">({messages.length} {t('barrage.messages')})</span>
          {creatorToken && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditTitle(topicTitle); setEditDialogOpen(true); }}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant={view === 'barrage' ? 'default' : 'outline'} size="sm" onClick={() => setView('barrage')}>
            {t('barrage.wall')}
          </Button>
          <Button variant={view === 'report' ? 'default' : 'outline'} size="sm" onClick={handleReport} disabled={analyzing}>
            <FileText className="w-3.5 h-3.5 mr-1" />
            {analyzing && view === 'report' ? t('barrage.analyzing2') : t('barrage.report')}
          </Button>
          <Button variant={view === 'wordcloud' ? 'default' : 'outline'} size="sm" onClick={handleWordCloud} disabled={analyzing}>
            <Cloud className="w-3.5 h-3.5 mr-1" />
            {analyzing && view === 'wordcloud' ? t('barrage.generating') : t('barrage.wordcloud')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <Download className="w-3.5 h-3.5 mr-1" /> JSON
          </Button>
          {creatorToken && (
            <Button variant="outline" size="sm" onClick={handleDeleteTopic} className="text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> {t('barrage.deleteTopic')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleReset}>
            {t('barrage.end')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="flex flex-col items-center gap-2 p-4 bg-background rounded-xl border border-border">
          <QRCodeSVG value={discussUrl} size={160} level="M" />
          <p className="text-xs text-muted-foreground text-center">{t('barrage.scanToJoin')}</p>
          <p className="text-[10px] text-muted-foreground break-all text-center max-w-[180px]">{discussUrl}</p>
        </div>

        <div className="lg:col-span-3">
          {view === 'barrage' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsPlaying(!isPlaying)} className="gap-1">
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPlaying ? t('barrage.end') : t('barrage.play')}
                </Button>
                <span className="text-xs text-muted-foreground">{t('barrage.speed')}</span>
                {[0.5, 1, 1.5, 2].map(s => (
                  <Button key={s} variant={speed === s ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setSpeed(s)}>
                    {s}x
                  </Button>
                ))}
              </div>

              <div className="relative w-full h-64 sm:h-80 bg-foreground/5 rounded-xl overflow-hidden border border-border">
                <AnimatePresence>
                  {isPlaying && visibleMessages.map((msg, i) => (
                    <BarrageItem key={msg.id} text={msg.content} index={i} speed={speed} />
                  ))}
                </AnimatePresence>
                {messages.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                    {t('barrage.waiting')}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'report' && (
            <div ref={reportRef} className="bg-background rounded-xl border border-border p-4 sm:p-6 min-h-[260px]">
              {analyzing ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  <div className="text-center">
                    <div className="text-3xl mb-2 animate-spin">🧠</div>
                    <div>{t('barrage.analyzing')}</div>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                  <h4 className="text-foreground mb-3">{t('barrage.reportTitle')}</h4>
                  {reportContent || t('barrage.noReport')}
                </div>
              )}
            </div>
          )}

          {view === 'wordcloud' && (
            <div className="bg-background rounded-xl border border-border p-4 sm:p-6 min-h-[260px]">
              {analyzing ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  <div className="text-center">
                    <div className="text-3xl mb-2 animate-pulse">☁️</div>
                    <div>{t('barrage.generatingCloud')}</div>
                  </div>
                </div>
              ) : wordCloudData.length > 0 ? (
                <WordCloudCanvas words={wordCloudData} />
              ) : (
                <div className="text-center text-muted-foreground py-12">{t('barrage.noCloud')}</div>
              )}
            </div>
          )}
        </div>
      </div>
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('barrage.editTitle')}</DialogTitle>
          </DialogHeader>
          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder={t('barrage.newTitlePlaceholder')} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t('barrage.cancel')}</Button>
            <Button onClick={handleEditTopic} disabled={!editTitle.trim()}>{t('settings.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
