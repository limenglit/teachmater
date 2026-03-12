import { useState } from 'react';
import { Sparkles, Plus, CheckSquare, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { QuizQuestion } from './quizTypes';

interface QuestionConfig {
  type: QuizQuestion['type'];
  count: number;
}

interface AIQuizGeneratorProps {
  onAddToBank: (questions: QuizQuestion[]) => void;
}

const QUESTION_TYPES: Array<{ type: QuizQuestion['type']; labelKey: string }> = [
  { type: 'single', labelKey: 'quiz.single' },
  { type: 'multi', labelKey: 'quiz.multi' },
  { type: 'tf', labelKey: 'quiz.tf' },
  { type: 'short', labelKey: 'quiz.short' },
];

export default function AIQuizGenerator({ onAddToBank }: AIQuizGeneratorProps) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const [courseName, setCourseName] = useState('');
  const [topics, setTopics] = useState('');
  const [questionConfig, setQuestionConfig] = useState<QuestionConfig[]>([
    { type: 'single', count: 5 },
    { type: 'tf', count: 3 },
  ]);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const updateCount = (type: QuizQuestion['type'], count: number) => {
    setQuestionConfig(prev => {
      const existing = prev.find(c => c.type === type);
      if (count <= 0) {
        return prev.filter(c => c.type !== type);
      }
      if (existing) {
        return prev.map(c => c.type === type ? { ...c, count } : c);
      }
      return [...prev, { type, count }];
    });
  };

  const getCount = (type: QuizQuestion['type']) =>
    questionConfig.find(c => c.type === type)?.count ?? 0;

  const handleGenerate = async () => {
    if (!user) {
      toast({ title: t('quiz.ai.loginRequired'), variant: 'destructive' });
      return;
    }
    if (!courseName.trim()) {
      toast({ title: t('quiz.ai.noCourse'), variant: 'destructive' });
      return;
    }
    if (!topics.trim()) {
      toast({ title: t('quiz.ai.noTopics'), variant: 'destructive' });
      return;
    }
    const activeConfig = questionConfig.filter(c => c.count > 0);
    if (activeConfig.length === 0) {
      toast({ title: t('quiz.ai.selectAtLeastOne'), variant: 'destructive' });
      return;
    }

    setGenerating(true);
    setGeneratedQuestions([]);
    setSelectedIndices(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz-questions', {
        body: { courseName: courseName.trim(), topics: topics.trim(), questionConfig: activeConfig, lang },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error === 'Rate limited') {
          toast({ title: t('visual.rateLimited'), variant: 'destructive' });
        } else {
          toast({ title: data.error, variant: 'destructive' });
        }
        return;
      }

      const questions: QuizQuestion[] = (data.questions ?? []).map((q: Omit<QuizQuestion, 'id' | 'user_id' | 'created_at'>) => ({
        id: crypto.randomUUID(),
        user_id: user.id,
        created_at: new Date().toISOString(),
        type: q.type,
        content: q.content,
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: q.correct_answer,
        tags: q.tags ?? courseName.trim(),
        category_id: null,
        is_starred: false,
      }));

      setGeneratedQuestions(questions);
      setSelectedIndices(new Set(questions.map((_, i) => i)));
      toast({ title: t('quiz.ai.generateSuccess') });
    } catch (err: unknown) {
      console.error(err);
      toast({ title: t('quiz.ai.generateError'), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === generatedQuestions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(generatedQuestions.map((_, i) => i)));
    }
  };

  const handleAddSelected = () => {
    const toAdd = generatedQuestions.filter((_, i) => selectedIndices.has(i));
    if (toAdd.length === 0) return;
    onAddToBank(toAdd);
    setGeneratedQuestions(prev => prev.filter((_, i) => !selectedIndices.has(i)));
    setSelectedIndices(new Set());
    toast({ title: t('quiz.ai.addedCount').replace('{0}', String(toAdd.length)) });
  };

  const renderQuestionPreview = (q: QuizQuestion, index: number) => {
    const selected = selectedIndices.has(index);
    const typeLabel = t(`quiz.${q.type}`);
    return (
      <div
        key={q.id}
        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
          selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
        }`}
        onClick={() => toggleSelect(index)}
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5 shrink-0 text-primary">
            {selected
              ? <CheckSquare className="w-4 h-4" />
              : <Square className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{typeLabel}</span>
              {q.tags && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{q.tags}</span>
              )}
            </div>
            <p className="text-sm text-foreground leading-snug mb-1.5">{q.content}</p>
            {q.options.length > 0 && (
              <ul className="space-y-0.5">
                {q.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const isCorrect = Array.isArray(q.correct_answer)
                    ? (q.correct_answer as string[]).includes(letter)
                    : q.correct_answer === letter || q.correct_answer === opt;
                  return (
                    <li key={i} className={`text-xs flex items-start gap-1 ${isCorrect ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                      <span className="shrink-0">{letter}.</span>
                      <span>{opt}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {q.type === 'tf' && (
              <p className="text-xs text-green-600 font-medium mt-1">
                ✓ {String(q.correct_answer)}
              </p>
            )}
            {q.type === 'short' && (
              <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                {String(q.correct_answer)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Sparkles className="w-10 h-10 text-primary/30 mb-3" />
        <p className="text-sm text-muted-foreground mb-1">{t('quiz.ai.loginRequired')}</p>
        <p className="text-xs text-muted-foreground">{t('quiz.ai.loginHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Input form */}
      <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">{t('quiz.ai.courseName')}</label>
          <Input
            placeholder={t('quiz.ai.courseNamePlaceholder')}
            value={courseName}
            onChange={e => setCourseName(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">{t('quiz.ai.topics')}</label>
          <Textarea
            placeholder={t('quiz.ai.topicsPlaceholder')}
            value={topics}
            onChange={e => setTopics(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">{t('quiz.ai.questionTypes')}</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUESTION_TYPES.map(({ type, labelKey }) => (
              <div key={type} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground text-center">{t(labelKey)}</span>
                <div className="flex items-center gap-1 justify-center">
                  <button
                    aria-label={`${t(labelKey)} −`}
                    className="w-6 h-6 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors text-sm font-medium flex items-center justify-center"
                    onClick={() => updateCount(type, Math.max(0, getCount(type) - 1))}
                  >−</button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums">{getCount(type)}</span>
                  <button
                    aria-label={`${t(labelKey)} +`}
                    className="w-6 h-6 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors text-sm font-medium flex items-center justify-center"
                    onClick={() => updateCount(type, Math.min(20, getCount(type) + 1))}
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" />{t('quiz.ai.generating')}</>
            : <><Sparkles className="w-4 h-4" />{t('quiz.ai.generate')}</>}
        </Button>
      </div>

      {/* Generated questions */}
      {generatedQuestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">{t('quiz.ai.preview')} ({generatedQuestions.length})</h4>
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={toggleSelectAll}
              >
                {selectedIndices.size === generatedQuestions.length ? t('quiz.deselectAll') : t('quiz.selectAll')}
              </button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={selectedIndices.size === 0}
                onClick={handleAddSelected}
              >
                <Plus className="w-3 h-3" />
                {t('quiz.ai.addSelected')} ({selectedIndices.size})
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {generatedQuestions.map((q, i) => renderQuestionPreview(q, i))}
          </div>
          {selectedIndices.size > 0 && (
            <Button
              className="w-full gap-2"
              onClick={handleAddSelected}
            >
              <Plus className="w-4 h-4" />
              {t('quiz.ai.addSelected')} ({selectedIndices.size})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
