import { useState, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { X, Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { BoardCard } from '@/components/BoardPanel';

interface Props {
  cards: BoardCard[];
  boardTitle: string;
  onClose: () => void;
}

export default function BoardReport({ cards, boardTitle, onClose }: Props) {
  const { t } = useLanguage();
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const generateReport = useCallback(async () => {
    if (cards.length === 0) {
      toast({ title: t('board.reportNoCards'), variant: 'destructive' });
      return;
    }

    setLoading(true);
    setReport('');

    try {
      const { data, error } = await supabase.functions.invoke('analyze-board', {
        body: {
          cards: cards.map(c => ({
            content: c.content,
            author_nickname: c.author_nickname,
            card_type: c.card_type,
            likes_count: c.likes_count,
            is_pinned: c.is_pinned,
            created_at: c.created_at,
          })),
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: data.error, variant: 'destructive' });
        return;
      }

      setReport(data.result || '');
      setGenerated(true);
    } catch (e: any) {
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
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center p-4 overflow-auto"
    >
      {/* Header */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-4 pt-2">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5" /> {t('board.smartReport')}
        </h2>
        <div className="flex items-center gap-2">
          {!generated && (
            <Button onClick={generateReport} disabled={loading || cards.length === 0} className="gap-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {loading ? t('board.reportGenerating') : t('board.reportGenerate')}
            </Button>
          )}
          {generated && (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={generateReport} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
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
          <button onClick={onClose} className="p-2 rounded-full hover:bg-foreground/10 transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-3xl flex-1">
        {!generated && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg mb-2">{t('board.reportPrompt')}</p>
            <p className="text-sm">{t('board.reportPromptSub').replace('{0}', String(cards.length))}</p>
          </div>
        )}

        {loading && !report && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('board.reportGenerating')}</p>
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
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
