import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, BookOpen, Lightbulb, ExternalLink, Loader2, AlertCircle,
  Target, Route, ListChecks, Brain, Clock, Eye, EyeOff,
} from 'lucide-react';
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

interface ProblemItem {
  problem: string;
  evidence: string;
  severity: 'high' | 'medium' | 'low';
  relatedQuestionIndexes: number[];
}

interface KnowledgePoint {
  name: string;
  description: string;
  mastery: 'weak' | 'partial' | 'ok';
  relatedProblems: string[];
}

interface LearningStep {
  step: number;
  title: string;
  goal: string;
  action: string;
  minutes: number;
  searchQuery: string;
  bilibiliUrl: string;
  youtubeUrl: string;
}

interface PracticeQuestion {
  question: string;
  type: 'single' | 'multi' | 'tf' | 'short';
  options: string[];
  answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  knowledgePoint: string;
}

interface ApiResult {
  summary: string;
  weakAreas: string[];
  problems?: ProblemItem[];
  knowledgePoints?: KnowledgePoint[];
  learningPath?: LearningStep[];
  practiceQuestions?: PracticeQuestion[];
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

const SEVERITY_STYLE: Record<ProblemItem['severity'], { label: string; cls: string }> = {
  high: { label: '严重', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30' },
  medium: { label: '中等', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  low: { label: '轻微', cls: 'bg-muted text-muted-foreground border-border' },
};

const MASTERY_STYLE: Record<KnowledgePoint['mastery'], { label: string; cls: string }> = {
  weak: { label: '薄弱', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30' },
  partial: { label: '半掌握', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  ok: { label: '基本掌握', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
};

const DIFFICULTY_LABEL: Record<PracticeQuestion['difficulty'], string> = {
  easy: '基础', medium: '进阶', hard: '挑战',
};

const TYPE_LABEL: Record<PracticeQuestion['type'], string> = {
  single: '单选', multi: '多选', tf: '判断', short: '简答',
};

export default function QuizRecommendations({ open, onOpenChange, sessionTitle, wrongs, onJumpToQuestion }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(''); setResult(null); setRevealed({}); setLoading(true);

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

  const problems = result?.problems ?? [];
  const knowledgePoints = result?.knowledgePoints ?? [];
  const learningPath = result?.learningPath ?? [];
  const practice = result?.practiceQuestions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            个性化学习推荐
          </DialogTitle>
          <DialogDescription>
            基于你在 <strong>{sessionTitle}</strong> 的 {wrongs.length} 道错题，AI 生成结构化诊断与学习方案
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
          <div className="space-y-4">
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

            <Tabs defaultValue="problems">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="problems" className="text-xs gap-1">
                  <Target className="w-3.5 h-3.5" /> 存在问题
                </TabsTrigger>
                <TabsTrigger value="knowledge" className="text-xs gap-1">
                  <Brain className="w-3.5 h-3.5" /> 对应知识点
                </TabsTrigger>
                <TabsTrigger value="path" className="text-xs gap-1">
                  <Route className="w-3.5 h-3.5" /> 学习路径
                </TabsTrigger>
                <TabsTrigger value="practice" className="text-xs gap-1">
                  <ListChecks className="w-3.5 h-3.5" /> 练习题
                </TabsTrigger>
              </TabsList>

              {/* 1. 存在问题 */}
              <TabsContent value="problems" className="space-y-3 mt-3">
                {problems.length === 0 && (
                  <p className="text-xs text-muted-foreground">AI 未生成问题清单，可查看下方错题明细。</p>
                )}
                {problems.map((p, i) => (
                  <div key={i} className="p-3 rounded-md border border-border bg-card space-y-1.5">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h5 className="text-sm font-semibold text-foreground flex-1 min-w-0">{i + 1}. {p.problem}</h5>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${SEVERITY_STYLE[p.severity].cls}`}>
                        {SEVERITY_STYLE[p.severity].label}
                      </Badge>
                    </div>
                    {p.evidence && <p className="text-xs text-muted-foreground leading-relaxed">证据：{p.evidence}</p>}
                    {p.relatedQuestionIndexes?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {p.relatedQuestionIndexes.map(pos => {
                          const w = wrongs[pos - 1];
                          return (
                            <Badge
                              key={pos}
                              variant="outline"
                              onClick={w && onJumpToQuestion ? () => { onJumpToQuestion(w.index); onOpenChange(false); } : undefined}
                              className={`text-[10px] ${w && onJumpToQuestion ? 'cursor-pointer hover:bg-primary/10 hover:border-primary/50' : ''}`}
                            >
                              题 {pos}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                <div className="space-y-2 pt-1">
                  <h5 className="text-xs font-semibold text-muted-foreground">错题明细</h5>
                  {wrongs.map((w, i) => {
                    const pos = i + 1;
                    const rec = result.recommendations.find(r => (r.relatedQuestionIndexes || []).includes(pos));
                    const clickable = !!onJumpToQuestion;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={clickable ? () => { onJumpToQuestion!(w.index); onOpenChange(false); } : undefined}
                        disabled={!clickable}
                        className={`w-full text-left p-3 rounded-md border border-border bg-muted/30 space-y-1.5 ${clickable ? 'hover:bg-muted/60 hover:border-primary/50 cursor-pointer transition-colors' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="text-xs font-medium text-foreground flex-1 min-w-0">
                            <Badge variant="outline" className="text-[10px] mr-1.5">题 {pos}</Badge>
                            <span className="line-clamp-2">{w.question}</span>
                          </div>
                          {rec?.topic && <Badge variant="secondary" className="text-[10px] shrink-0">{rec.topic}</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>正确：<span className="text-emerald-700 dark:text-emerald-400">{w.correctAnswer || '—'}</span></span>
                          <span>你答：<span className="text-rose-700 dark:text-rose-400">{w.studentAnswer || '未作答'}</span></span>
                        </div>
                        {rec?.rootCause && (
                          <div className="flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-400">
                            <Target className="w-3 h-3 mt-0.5 shrink-0" />
                            <span><strong>根源：</strong>{rec.rootCause}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </TabsContent>

              {/* 2. 对应知识点 */}
              <TabsContent value="knowledge" className="space-y-3 mt-3">
                {knowledgePoints.length === 0 && (
                  <p className="text-xs text-muted-foreground">AI 未生成知识点清单。</p>
                )}
                {knowledgePoints.map((k, i) => (
                  <div key={i} className="p-3 rounded-md border border-border bg-card space-y-1.5">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h5 className="text-sm font-semibold text-foreground flex-1 min-w-0">{k.name}</h5>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${MASTERY_STYLE[k.mastery].cls}`}>
                        {MASTERY_STYLE[k.mastery].label}
                      </Badge>
                    </div>
                    {k.description && <p className="text-xs text-foreground/85 leading-relaxed">{k.description}</p>}
                    {k.relatedProblems?.length > 0 && (
                      <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                        {k.relatedProblems.map((rp, j) => <li key={j}>{rp}</li>)}
                      </ul>
                    )}
                  </div>
                ))}

                {result.recommendations.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <h5 className="text-xs font-semibold text-muted-foreground">主题精讲</h5>
                    {result.recommendations.map((r, i) => (
                      <div key={i} className="p-3 rounded-md border border-border bg-muted/20 space-y-2">
                        <h6 className="text-sm font-semibold text-foreground">{i + 1}. {r.topic}</h6>
                        <p className="text-xs text-foreground/90 leading-relaxed">{r.explanation}</p>
                        {r.examples?.length > 0 && (
                          <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc">
                            {r.examples.map((ex, j) => <li key={j}>{ex}</li>)}
                          </ul>
                        )}
                        {r.memoryTip && (
                          <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                            <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{r.memoryTip}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
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
                )}
              </TabsContent>

              {/* 3. 建议学习路径 */}
              <TabsContent value="path" className="space-y-3 mt-3">
                {learningPath.length === 0 && (
                  <p className="text-xs text-muted-foreground">AI 未生成学习路径。</p>
                )}
                {learningPath.map((s, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                        {s.step}
                      </div>
                      {i < learningPath.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                    </div>
                    <div className="flex-1 min-w-0 p-3 rounded-md border border-border bg-card space-y-1.5 mb-1">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h5 className="text-sm font-semibold text-foreground flex-1 min-w-0">{s.title}</h5>
                        <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                          <Clock className="w-3 h-3" /> {s.minutes} 分钟
                        </Badge>
                      </div>
                      {s.goal && <p className="text-xs text-muted-foreground">目标：{s.goal}</p>}
                      {s.action && <p className="text-xs text-foreground/90 leading-relaxed">行动：{s.action}</p>}
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <a href={s.bilibiliUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3 h-3" /> B站搜「{s.searchQuery}」
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <a href={s.youtubeUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3 h-3" /> YouTube
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* 4. 可直接练习的题目 */}
              <TabsContent value="practice" className="space-y-3 mt-3">
                {practice.length === 0 && (
                  <p className="text-xs text-muted-foreground">AI 未生成练习题。</p>
                )}
                {practice.map((p, i) => (
                  <div key={i} className="p-3 rounded-md border border-border bg-card space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h5 className="text-sm font-medium text-foreground flex-1 min-w-0">{i + 1}. {p.question}</h5>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[p.type]}</Badge>
                        <Badge variant="outline" className="text-[10px]">{DIFFICULTY_LABEL[p.difficulty]}</Badge>
                      </div>
                    </div>
                    {p.options?.length > 0 && (
                      <ul className="text-xs text-foreground/85 space-y-1">
                        {p.options.map((o, j) => (
                          <li key={j}>{String.fromCharCode(65 + j)}. {o}</li>
                        ))}
                      </ul>
                    )}
                    {p.knowledgePoint && (
                      <p className="text-[11px] text-muted-foreground">对应知识点：{p.knowledgePoint}</p>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => setRevealed(prev => ({ ...prev, [i]: !prev[i] }))}
                    >
                      {revealed[i] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {revealed[i] ? '隐藏答案' : '查看答案'}
                    </Button>
                    {revealed[i] && (
                      <div className="p-2 rounded bg-muted/40 border border-border space-y-1">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400"><strong>答案：</strong>{p.answer || '—'}</p>
                        {p.explanation && <p className="text-xs text-muted-foreground leading-relaxed">解析：{p.explanation}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button size="sm" onClick={() => onOpenChange(false)}>关闭</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
