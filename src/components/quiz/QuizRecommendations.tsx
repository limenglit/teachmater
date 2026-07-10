import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, BookOpen, Lightbulb, ExternalLink, Loader2, AlertCircle, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface QuizWrongItem {
  index: number; // 0-based question index in the paper
  type: 'single' | 'multi' | 'tf' | 'short';
  question: string;
  options?: string[];
  correctAnswer?: string;
  studentAnswer?: string;
}

interface Recommendation {
  topic: string;
  rootCause: string;
  explanation: string;
  examples: string[];
  memoryTip: string;
  bilibiliQuery: string;
  bilibiliUrl: string;
  youtubeUrl: string;
  relatedQuestionIndexes: number[];
}

interface ApiResult {
  summary: string;
  weakAreas: string[];
  recommendations: Recommendation[];
  wrongCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionTitle: string;
  wrongs: QuizWrongItem[];
  onJumpToQuestion?: (index: number) => void;
}

export default function QuizRecommendations({ open, onOpenChange, sessionTitle, wrongs, onJumpToQuestion }: Props) {

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(''); setResult(null); setLoading(true);

    (async () => {
      if (wrongs.length === 0) {
        setError('太棒了！本次测验没有可诊断的错题，无需推荐。');
        setLoading(false);
        return;
      }
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('recommend-quiz-learning', {
          body: { sessionTitle, wrongs },
        });
        if (cancelled) return;
        if (fnErr) { setError(fnErr.message || '推荐生成失败'); setLoading(false); return; }
        if ((data as any)?.error) { setError((data as any).error); setLoading(false); return; }
        setResult(data as ApiResult);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || '推荐生成失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, sessionTitle, wrongs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            个性化学习推荐
          </DialogTitle>
          <DialogDescription>
            基于你在 <strong>{sessionTitle}</strong> 的 {wrongs.length} 道错题，AI 分析错误根源并生成针对性学习建议
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

            {wrongs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-rose-600" /> 错题根源与解析
                </h4>
                <div className="space-y-2">
                  {wrongs.map((w, i) => {
                    const pos = i + 1; // matches relatedQuestionIndexes (1-based)
                    const rec = result.recommendations.find(r => (r.relatedQuestionIndexes || []).includes(pos));
                    const rootCause = rec?.rootCause || '未归类（AI 未针对此题给出根源分析）';
                    const summary = rec?.explanation || '';
                    const topic = rec?.topic || '';
                    const clickable = !!onJumpToQuestion;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={clickable ? () => onJumpToQuestion!(w.index) : undefined}
                        disabled={!clickable}
                        title={clickable ? '点击跳转到该题回放' : undefined}
                        className={`w-full text-left p-3 rounded-md border border-border bg-muted/30 space-y-1.5 ${clickable ? 'hover:bg-muted/60 hover:border-primary/50 cursor-pointer transition-colors' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="text-xs font-medium text-foreground flex-1 min-w-0">
                            <Badge variant="outline" className="text-[10px] mr-1.5">题 {pos}</Badge>
                            <span className="line-clamp-2">{w.question}</span>
                          </div>
                          {topic && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">{topic}</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>正确：<span className="text-emerald-700 dark:text-emerald-400">{w.correctAnswer || '—'}</span></span>
                          <span>你答：<span className="text-rose-700 dark:text-rose-400">{w.studentAnswer || '未作答'}</span></span>
                        </div>
                        <div className="flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-400">
                          <Target className="w-3 h-3 mt-0.5 shrink-0" />
                          <span><strong>根源：</strong>{rootCause}</span>
                        </div>
                        {summary && (
                          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">
                            <strong className="text-foreground">解析：</strong>{summary}
                          </p>
                        )}
                        {clickable && (
                          <p className="text-[10px] text-primary/80 pt-0.5">→ 点击查看该题回放</p>
                        )}
                      </button>
                    );

                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">

              {result.recommendations.map((r, i) => (
                <div key={i} className="p-4 rounded-md border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-foreground">{i + 1}. {r.topic}</h4>
                    {r.relatedQuestionIndexes?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.relatedQuestionIndexes.map(idx => (
                          <Badge key={idx} variant="outline" className="text-[10px]">题 {idx}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {r.rootCause && (
                    <div className="flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-400">
                      <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span><strong>错误根源：</strong>{r.rootCause}</span>
                    </div>
                  )}

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

            <div className="flex justify-end pt-2 border-t border-border">
              <Button size="sm" onClick={() => onOpenChange(false)}>关闭</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
