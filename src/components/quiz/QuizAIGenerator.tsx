import { useMemo, useState, useCallback } from 'react';
import { Sparkles, Plus, CheckCircle2, ListChecks, ToggleLeft, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAIQuota } from '@/hooks/useAIQuota';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { QuizQuestion } from './quizTypes';
import { getLocalQuestions, saveLocalQuestions } from './quizTypes';

interface Props {
  isGuest: boolean;
  userId: string | null;
  questions: QuizQuestion[];
  setQuestions: (qs: QuizQuestion[]) => void;
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  onSwitchToBank: () => void;
}

type QuestionType = QuizQuestion['type'];

type Difficulty = 'basic' | 'medium' | 'hard';

interface GeneratedQuestion {
  id: string;
  type: QuestionType;
  content: string;
  options: string[];
  correct_answer: string | string[];
  tags: string;
}

interface GenerateCounts {
  single: number;
  multi: number;
  tf: number;
  short: number;
}

function normalizeKnowledgePoints(input: string): string[] {
  return input
    .split(/[,，、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGeneratedQuestion(raw: any, index: number, defaultTag: string): GeneratedQuestion | null {
  const type = raw?.type;
  const content = typeof raw?.content === 'string' ? raw.content.trim() : '';
  const tags = typeof raw?.tags === 'string' && raw.tags.trim() ? raw.tags.trim() : defaultTag;
  if (!content) return null;
  if (!['single', 'multi', 'tf', 'short'].includes(type)) return null;

  if (type === 'single') {
    const options = Array.isArray(raw?.options) ? raw.options.map((o: any) => String(o).trim()).filter(Boolean) : [];
    const answer = typeof raw?.correct_answer === 'string' ? raw.correct_answer.trim().toUpperCase() : 'A';
    if (options.length < 2) return null;
    return {
      id: `ai-${crypto.randomUUID()}-${index}`,
      type,
      content,
      options,
      correct_answer: /^[A-F]$/.test(answer) ? answer : 'A',
      tags,
    };
  }

  if (type === 'multi') {
    const options = Array.isArray(raw?.options) ? raw.options.map((o: any) => String(o).trim()).filter(Boolean) : [];
    const arr: string[] = Array.isArray(raw?.correct_answer)
      ? raw.correct_answer.map((a: any) => String(a).trim().toUpperCase()).filter((a: string) => /^[A-F]$/.test(a))
      : [];
    if (options.length < 2) return null;
    const unique: string[] = Array.from(new Set(arr)) as string[];
    return {
      id: `ai-${crypto.randomUUID()}-${index}`,
      type,
      content,
      options,
      correct_answer: unique.length > 0 ? unique : ['A'],
      tags,
    };
  }

  if (type === 'tf') {
    const answer = typeof raw?.correct_answer === 'string' ? raw.correct_answer.trim().toUpperCase() : 'A';
    return {
      id: `ai-${crypto.randomUUID()}-${index}`,
      type,
      content,
      options: ['正确', '错误'],
      correct_answer: answer === 'B' ? 'B' : 'A',
      tags,
    };
  }

  return {
    id: `ai-${crypto.randomUUID()}-${index}`,
    type: 'short',
    content,
    options: [],
    correct_answer: typeof raw?.correct_answer === 'string' ? raw.correct_answer.trim() : '',
    tags,
  };
}

// ── Dedup: check content similarity against existing bank ──
function isSimilarContent(a: string, b: string): boolean {
  const na = a.replace(/\s+/g, '').toLowerCase();
  const nb = b.replace(/\s+/g, '').toLowerCase();
  if (na === nb) return true;
  // Jaccard on bigrams for fuzzy match
  if (na.length < 4 || nb.length < 4) return na === nb;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const setA = bigrams(na);
  const setB = bigrams(nb);
  let inter = 0;
  for (const b of setA) if (setB.has(b)) inter++;
  const union = setA.size + setB.size - inter;
  return union > 0 && inter / union > 0.7;
}

function deduplicateGenerated(
  generated: GeneratedQuestion[],
  existingBank: QuizQuestion[],
): { unique: GeneratedQuestion[]; dupCount: number } {
  const unique: GeneratedQuestion[] = [];
  let dupCount = 0;
  for (const q of generated) {
    const isDup =
      existingBank.some((e) => isSimilarContent(e.content, q.content)) ||
      unique.some((u) => isSimilarContent(u.content, q.content));
    if (isDup) {
      dupCount++;
    } else {
      unique.push(q);
    }
  }
  return { unique, dupCount };
}

// ── Coverage: check each knowledge point has at least 1 question ──
function checkKnowledgeCoverage(
  questions: GeneratedQuestion[],
  knowledgePoints: string[],
): string[] {
  const uncovered: string[] = [];
  for (const kp of knowledgePoints) {
    const kpLower = kp.toLowerCase();
    const found = questions.some(
      (q) =>
        q.content.toLowerCase().includes(kpLower) ||
        q.tags.toLowerCase().includes(kpLower),
    );
    if (!found) uncovered.push(kp);
  }
  return uncovered;
}

export default function QuizAIGenerator({
  isGuest,
  userId,
  questions,
  setQuestions,
  selectedIds,
  setSelectedIds,
  onSwitchToBank,
}: Props) {
  const { t, lang } = useLanguage();
  const [courseName, setCourseName] = useState('');
  const [knowledgeInput, setKnowledgeInput] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [counts, setCounts] = useState<GenerateCounts>({ single: 3, multi: 1, tf: 1, short: 1 });
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedQuestion[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dedupInfo, setDedupInfo] = useState<string | null>(null);
  const [coverageWarning, setCoverageWarning] = useState<string[] | null>(null);

  const totalCount = useMemo(
    () => counts.single + counts.multi + counts.tf + counts.short,
    [counts.multi, counts.short, counts.single, counts.tf],
  );

  const updateCount = (key: keyof GenerateCounts, value: string) => {
    const next = Number(value);
    setCounts((prev) => ({
      ...prev,
      [key]: Number.isFinite(next) ? Math.max(0, Math.min(20, next)) : 0,
    }));
  };

  const aiQuota = useAIQuota();

  const handleGenerate = async () => {
    const trimmedCourse = courseName.trim();
    const points = normalizeKnowledgePoints(knowledgeInput);

    if (isGuest || !userId) {
      toast({ title: t('quiz.ai.loginRequired'), variant: 'destructive' });
      return;
    }

    if (!aiQuota.consume()) {
      toast({ title: t('ai.guestLimitReached'), variant: 'destructive' });
      return;
    }

    if (!trimmedCourse) {
      toast({ title: t('quiz.ai.needCourse'), variant: 'destructive' });
      return;
    }

    if (points.length === 0) {
      toast({ title: t('quiz.ai.needKnowledge'), variant: 'destructive' });
      return;
    }

    if (totalCount <= 0) {
      toast({ title: t('quiz.ai.needCount'), variant: 'destructive' });
      return;
    }

    setGenerating(true);
    setDedupInfo(null);
    setCoverageWarning(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz-questions', {
        body: {
          courseName: trimmedCourse,
          knowledgePoints: points,
          difficulty,
          counts,
          lang,
        },
      });
      if (error) throw error;

      const defaultTag = `${trimmedCourse} ${points.join('、')}`.trim();
      const list = Array.isArray(data?.questions) ? data.questions : [];
      const normalized = list
        .map((item: any, index: number) => normalizeGeneratedQuestion(item, index, defaultTag))
        .filter((item: GeneratedQuestion | null): item is GeneratedQuestion => Boolean(item));

      // Dedup against existing bank
      const { unique, dupCount } = deduplicateGenerated(normalized, questions);
      if (dupCount > 0) {
        setDedupInfo(tFormat(t('quiz.ai.dedupRemoved'), dupCount));
      }

      // Coverage check
      const uncovered = checkKnowledgeCoverage(unique, points);
      if (uncovered.length > 0) {
        setCoverageWarning(uncovered);
      }

      setGenerated(unique);
      setPicked(new Set(unique.map((item) => item.id)));
      toast({ title: tFormat(t('quiz.ai.generatedCount'), unique.length) });
    } catch (err: any) {
      toast({ title: err?.message || t('visual.analyzeError'), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (picked.size === generated.length) {
      setPicked(new Set());
      return;
    }
    setPicked(new Set(generated.map((item) => item.id)));
  };

  const addSelectedToBank = async () => {
    const selected = generated.filter((item) => picked.has(item.id));
    if (selected.length === 0) {
      toast({ title: t('quiz.selectQuestions'), variant: 'destructive' });
      return;
    }

    if (isGuest || !userId) {
      const localRows: QuizQuestion[] = selected.map((item) => ({
        id: crypto.randomUUID(),
        user_id: 'local',
        type: item.type,
        content: item.content,
        options: item.options,
        correct_answer: item.correct_answer,
        tags: item.tags,
        category_id: null,
        is_starred: false,
        created_at: new Date().toISOString(),
      }));
      const merged = [...localRows, ...getLocalQuestions()];
      saveLocalQuestions(merged);
      setQuestions(merged);

      const nextSelected = new Set(selectedIds);
      for (const q of localRows) nextSelected.add(q.id);
      setSelectedIds(nextSelected);

      toast({ title: tFormat(t('quiz.ai.addedToBank'), localRows.length) });
      onSwitchToBank();
      return;
    }

    const rows = selected.map((item) => ({
      user_id: userId,
      type: item.type,
      content: item.content,
      options: item.options,
      correct_answer: item.correct_answer,
      tags: item.tags,
      category_id: null,
      is_starred: false,
    }));

    const { data, error } = await supabase.from('quiz_questions').insert(rows as any).select('*');
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }

    const inserted = (data || []) as QuizQuestion[];
    const merged = [...inserted, ...questions.filter((item) => !inserted.some((row) => row.id === item.id))];
    setQuestions(merged);

    const nextSelected = new Set(selectedIds);
    for (const q of inserted) nextSelected.add(q.id);
    setSelectedIds(nextSelected);

    toast({ title: tFormat(t('quiz.ai.addedToBank'), inserted.length) });
    onSwitchToBank();
  };

  const typeIcon = (type: QuestionType) => {
    if (type === 'single') return <CheckCircle2 className="w-3.5 h-3.5 text-primary" />;
    if (type === 'multi') return <ListChecks className="w-3.5 h-3.5 text-amber-600" />;
    if (type === 'tf') return <ToggleLeft className="w-3.5 h-3.5 text-green-600" />;
    return <FileText className="w-3.5 h-3.5 text-orange-500" />;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4 bg-card space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{t('quiz.ai.title')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('quiz.ai.desc')}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{t('quiz.ai.courseName')}</p>
            <Input
              value={courseName}
              onChange={(event) => setCourseName(event.target.value)}
              placeholder={t('quiz.ai.coursePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{t('quiz.ai.difficulty')}</p>
            <Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">{t('quiz.ai.diff.basic')}</SelectItem>
                <SelectItem value="medium">{t('quiz.ai.diff.medium')}</SelectItem>
                <SelectItem value="hard">{t('quiz.ai.diff.hard')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{t('quiz.ai.knowledgePoints')}</p>
          <Textarea
            value={knowledgeInput}
            onChange={(event) => setKnowledgeInput(event.target.value)}
            rows={3}
            placeholder={t('quiz.ai.knowledgePlaceholder')}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('quiz.ai.countSingle')}</p>
            <Input type="number" min={0} max={20} value={counts.single} onChange={(event) => updateCount('single', event.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('quiz.ai.countMulti')}</p>
            <Input type="number" min={0} max={20} value={counts.multi} onChange={(event) => updateCount('multi', event.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('quiz.ai.countTf')}</p>
            <Input type="number" min={0} max={20} value={counts.tf} onChange={(event) => updateCount('tf', event.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('quiz.ai.countShort')}</p>
            <Input type="number" min={0} max={20} value={counts.short} onChange={(event) => updateCount('short', event.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">{tFormat(t('quiz.ai.totalCount'), totalCount)}</p>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
            <Sparkles className="w-4 h-4" />
            {generating ? t('quiz.ai.generating') : t('quiz.ai.generate')}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 bg-card space-y-3">
        {/* Dedup & coverage warnings */}
        {dedupInfo && (
          <div className="flex items-center gap-2 text-xs rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-primary">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{dedupInfo}</span>
          </div>
        )}
        {coverageWarning && coverageWarning.length > 0 && (
          <div className="flex items-start gap-2 text-xs rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t('quiz.ai.coverageWarning')}{coverageWarning.join('、')}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{t('quiz.ai.generatedList')}</p>
          {generated.length > 0 && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggleAll}>
              {picked.size === generated.length ? t('quiz.deselectAll') : t('quiz.selectAll')}
            </Button>
          )}
        </div>

        {generated.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('quiz.ai.empty')}</p>
        ) : (
          <div className="space-y-2">
            {generated.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 cursor-pointer transition-colors ${picked.has(item.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
                onClick={() => togglePick(item.id)}
              >
                <div className="flex items-start gap-2">
                  <Checkbox checked={picked.has(item.id)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {typeIcon(item.type)}
                      <span className="text-xs text-muted-foreground">{item.type}</span>
                    </div>
                    <p className="text-sm text-foreground">{item.content}</p>
                    {item.options.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.options.map((opt, idx) => (
                          <span key={`${item.id}-${idx}`} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {String.fromCharCode(65 + idx)}. {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button className="gap-1.5" onClick={addSelectedToBank} disabled={picked.size === 0}>
            <Plus className="w-4 h-4" />
            {t('quiz.ai.addToBankAndSwitch')}
          </Button>
        </div>
      </div>
    </div>
  );
}
