import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, BookOpen, Lightbulb, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getErrorsForSet, clearLocalErrors } from '@/lib/vocab-errors';
import { toast } from 'sonner';

interface Recommendation {
  topic: string;
  explanation: string;
  examples: string[];
  memoryTip: string;
  bilibiliQuery: string;
  bilibiliUrl: string;
  youtubeUrl: string;
}

interface ApiResult {
  summary: string;
  weakAreas: string[];
  recommendations: Recommendation[];
  errorCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  setId: string;
  setTitle: string;
  audience?: string;
}

export default function VocabRecommendations({ open, onOpenChange, setId, setTitle, audience }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string>('');
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    setResult(null);
    setLoading(true);

    (async () => {
      const errors = await getErrorsForSet(setId);
      if (cancelled) return;
      setErrorCount(errors.length);

      if (errors.length === 0) {
        setError('暂无错题记录，请先完成一轮练习并记录错题后再来获取推荐。');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fnErr } = await supabase.functions.invoke('recommend-learning', {
          body: { setId, setTitle, audience, errors },
        });
        if (cancelled) return;
        if (fnErr) {
          setError(fnErr.message || '推荐生成失败');
          setLoading(false);
          return;
        }
        if ((data as any)?.error) {
          setError((data as any).error);
          setLoading(false);
          return;
        }
        setResult(data as ApiResult);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || '推荐生成失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, setId, setTitle, audience]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            个性化学习推荐
          </DialogTitle>
          <DialogDescription>
            基于你在 <strong>{setTitle}</strong> 的错题（共 {errorCount} 个），AI 为你生成了下面的学习材料
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">AI 正在分析你的错题…</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 p-4 rounded-md bg-muted/50 border border-border">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && result && (
          <div className="space-y-5">
            {result.summary && (
              <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
                <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary" /> 总体分析
                </h4>
                <p className="text-sm text-foreground leading-relaxed">{result.summary}</p>
                {result.weakAreas?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {result.weakAreas.map((w, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{w}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {result.recommendations.map((r, i) => (
                <div key={i} className="p-4 rounded-md border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-foreground">
                      {i + 1}. {r.topic}
                    </h4>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{r.explanation}</p>

                  {r.examples?.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                      {r.examples.map((ex, j) => <li key={j}>{ex}</li>)}
                    </ul>
                  )}

                  {r.memoryTip && (
                    <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{r.memoryTip}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <a href={r.bilibiliUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3 h-3" /> B站搜「{r.bilibiliQuery}」
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <a href={r.youtubeUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3 h-3" /> YouTube
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearLocalErrors(setId);
                  toast.success('已清空本机错题缓存');
                  onOpenChange(false);
                }}
              >
                清空本机错题
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>关闭</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
