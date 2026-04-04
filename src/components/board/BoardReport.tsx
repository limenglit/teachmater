import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { X, Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { useAIQuota } from '@/hooks/useAIQuota';
import type { BoardCard } from '@/components/BoardPanel';

interface Props {
  cards: BoardCard[];
  boardTitle: string;
  onClose: () => void;
}

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-board`;

export default function BoardReport({ cards, boardTitle, onClose }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const aiQuota = useAIQuota();
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [report, loading]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const generateReport = useCallback(async () => {
    if (cards.length === 0) {
      toast({ title: t('board.reportNoCards'), variant: 'destructive' });
      return;
    }

    // Guest AI rate limit check
    if (!aiQuota.consume()) {
      toast({ title: t('ai.guestLimitReached'), variant: 'destructive' });
      return;
    }

    // Abort previous request if any
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setReport('');
    setGenerated(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: t('board.reportError'), description: 'Login required', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const resp = await fetch(STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cards: cards.map(c => ({
            content: c.content,
            author_nickname: c.author_nickname,
            card_type: c.card_type,
            likes_count: c.likes_count,
            is_pinned: c.is_pinned,
            created_at: c.created_at,
          })),
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        // Try to parse error JSON
        try {
          const errData = await resp.json();
          toast({ title: errData.error || t('board.reportError'), variant: 'destructive' });
        } catch {
          toast({ title: t('board.reportError'), variant: 'destructive' });
        }
        setLoading(false);
        return;
      }

      if (!resp.body) {
        toast({ title: t('board.reportError'), variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Read SSE stream
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let accumulated = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              accumulated += content;
              setReport(accumulated);
            }
          } catch {
            // Incomplete JSON, put back and wait
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              accumulated += content;
              setReport(accumulated);
            }
          } catch { /* ignore */ }
        }
      }

      setGenerated(true);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Report generation failed:', e);
      toast({ title: t('board.reportError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [cards, t]);

  const exportMarkdown = useCallback(() => {
    if (!report) return;
    const blob = new Blob([`# ${boardTitle} - 智能报告\n\n${report}`], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `report-${boardTitle || 'board'}.md`;
    a.click();
  }, [report, boardTitle]);

  const exportPNG = useCallback(async () => {
    const el = contentRef.current;
    if (!el) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `report-${boardTitle || 'board'}.png`;
    a.click();
  }, [boardTitle]);

  // Simple markdown renderer
  const renderMarkdown = (md: string) => {
    return md.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        return <h2 key={i} className="text-lg font-bold text-foreground mt-6 mb-3 first:mt-0">{trimmed.slice(3)}</h2>;
      }
      if (trimmed.startsWith('### ')) {
        return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-2">{trimmed.slice(4)}</h3>;
      }
      if (trimmed.startsWith('- ')) {
        const content = trimmed.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return (
          <li key={i} className="text-sm text-foreground/85 ml-4 mb-1 list-disc" dangerouslySetInnerHTML={{ __html: content }} />
        );
      }
      if (trimmed === '') return <div key={i} className="h-2" />;
      const content = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return <p key={i} className="text-sm text-foreground/85 mb-1" dangerouslySetInnerHTML={{ __html: content }} />;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center p-4"
    >
      {/* Header */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-4 pt-2 flex-shrink-0">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5" /> {t('board.smartReport')}
        </h2>
        <div className="flex items-center gap-2">
          {!generated && !loading && (
            <Button onClick={generateReport} disabled={cards.length === 0} className="gap-1">
              <FileText className="w-4 h-4" />
              {t('board.reportGenerate')}
            </Button>
          )}
          {loading && (
            <Button disabled className="gap-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('board.reportGenerating')}
            </Button>
          )}
          {generated && !loading && (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={generateReport}>
                <RefreshCw className="w-3.5 h-3.5" />
                {t('board.reportRegenerate')}
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={exportMarkdown}>
                <Download className="w-3.5 h-3.5" /> Markdown
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={exportPNG}>
                <Download className="w-3.5 h-3.5" /> PNG
              </Button>
            </>
          )}
          <button onClick={() => { abortRef.current?.abort(); onClose(); }} className="p-2 rounded-full hover:bg-foreground/10 transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="w-full max-w-3xl flex-1 overflow-auto">
        {!generated && !loading && !report && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg mb-2">{t('board.reportPrompt')}</p>
            <p className="text-sm">{t('board.reportPromptSub').replace('{0}', String(cards.length))}</p>
            {aiQuota.remaining >= 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                {t('ai.guestRemaining').replace('{0}', String(aiQuota.remaining)).replace('{1}', String(aiQuota.limit))}
              </p>
            )}
          </div>
        )}

        {report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            ref={contentRef}
            className="bg-card rounded-2xl border border-border shadow-lg p-8"
          >
            <div className="text-center mb-6 pb-4 border-b border-border">
              <h1 className="text-2xl font-bold text-foreground">{boardTitle} - {t('board.smartReport')}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date().toLocaleString()} · {cards.length} {t('board.reportCardCount')}
              </p>
            </div>
            <div>{renderMarkdown(report)}</div>
            {loading && (
              <div className="flex items-center gap-2 mt-4 text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm animate-pulse">{t('board.reportStreaming')}</span>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
