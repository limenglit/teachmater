import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { runQuizCall } from '@/lib/quiz-error';
import { toast } from '@/hooks/use-toast';
import type { QuizSession } from '@/components/QuizPanel';

interface Answer {
  id: string;
  session_id: string;
  student_name: string;
  question_index: number;
  answer: any;
  is_correct: boolean | null;
  created_at: string;
}

interface Props {
  session: QuizSession;
}

export default function QuizStatsView({ session }: Props) {
  const { t } = useLanguage();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const questions = session.questions as any[];

  useEffect(() => {
    loadAnswers();

    const channel = supabase
      .channel(`quiz-answers-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'quiz_answers',
        filter: `session_id=eq.${session.id}`,
      }, (payload) => {
        setAnswers(prev => {
          if (prev.find(a => a.id === (payload.new as any).id)) return prev;
          return [...prev, payload.new as Answer];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session.id]);

  const loadAnswers = async () => {
    const { data, error } = await runQuizCall<any[]>(
      () => supabase.from('quiz_answers').select('*').eq('session_id', session.id) as any,
      { timeoutMs: 10_000, retries: 1 },
    );
    if (error) {
      toast({ title: '加载答题数据失败', description: error.message, variant: 'destructive' });
      return;
    }
    if (data) setAnswers(data as any);
  };

  // Stats
  // Bucket all answers in one O(N) pass so per-question/per-student/per-option
  // counters don't run repeated O(N) filters on every realtime insert.
  const stats = useMemo(() => {
    const byQuestion = new Map<number, Answer[]>();
    const byStudent = new Map<string, { total: number; correct: number }>();
    let totalCorrect = 0;
    for (const a of answers) {
      let bucket = byQuestion.get(a.question_index);
      if (!bucket) { bucket = []; byQuestion.set(a.question_index, bucket); }
      bucket.push(a);
      const s = byStudent.get(a.student_name) || { total: 0, correct: 0 };
      s.total += 1;
      if (a.is_correct === true) { s.correct += 1; totalCorrect += 1; }
      byStudent.set(a.student_name, s);
    }
    return { byQuestion, byStudent, totalCorrect };
  }, [answers]);

  const studentNames = useMemo(() => Array.from(stats.byStudent.keys()), [stats]);
  const submittedCount = studentNames.length;

  return (
    <div className="flex-1 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary">{submittedCount}</div>
          <div className="text-xs text-muted-foreground">{t('quiz.submittedStudents')}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{questions.length}</div>
          <div className="text-xs text-muted-foreground">{t('quiz.totalQuestions')}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {answers.length > 0
              ? `${Math.round((stats.totalCorrect / answers.length) * 100)}%`
              : '—'}
          </div>
          <div className="text-xs text-muted-foreground">{t('quiz.accuracy')}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{answers.length}</div>
          <div className="text-xs text-muted-foreground">{t('quiz.totalAnswers')}</div>
        </div>
      </div>

      {/* Per-question stats */}
      <div className="space-y-4">
        {questions.map((q: any, qi: number) => {
          const qAnswers = stats.byQuestion.get(qi) || [];
          const total = qAnswers.length;
          const correct = qAnswers.reduce((n, a) => n + (a.is_correct === true ? 1 : 0), 0);

          return (
            <div key={qi} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <span className="text-xs font-medium text-primary mr-2">Q{qi + 1}</span>
                  <span className="text-sm text-foreground">{q.content}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {total} {t('quiz.answers')} · {total > 0 ? `${Math.round((correct / total) * 100)}%` : '—'}
                </span>
              </div>

              {/* Option distribution for objective questions */}
              {q.type !== 'short' && q.options && (
                <div className="space-y-1.5">
                  {(q.options as string[]).map((opt: string, oi: number) => {
                    const letter = String.fromCharCode(65 + oi);
                    const count = qAnswers.filter(a => {
                      const ans = a.answer;
                      if (Array.isArray(ans)) return ans.includes(letter);
                      return ans === letter;
                    }).length;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    const isCorrectOpt = Array.isArray(q.correct_answer)
                      ? q.correct_answer.includes(letter)
                      : q.correct_answer === letter;

                    return (
                      <div key={oi} className="flex items-center gap-2">
                        <span className={`text-xs font-mono w-4 ${isCorrectOpt ? 'text-green-600 font-bold' : 'text-muted-foreground'}`}>{letter}</span>
                        <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
                          <div
                            className={`h-full rounded-md transition-all duration-500 ${isCorrectOpt ? 'bg-green-500/30' : 'bg-primary/15'}`}
                            style={{ width: `${pct}%` }}
                          />
                          <span className="absolute inset-0 flex items-center px-2 text-[11px] text-foreground truncate">
                            {opt}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">{count} ({Math.round(pct)}%)</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Short answer responses */}
              {q.type === 'short' && qAnswers.length > 0 && (
                <div className="space-y-1 mt-2 max-h-32 overflow-auto">
                  {qAnswers.map(a => (
                    <div key={a.id} className="text-xs flex items-center gap-2">
                      <span className="font-medium text-foreground">{a.student_name}:</span>
                      <span className="text-muted-foreground">{typeof a.answer === 'string' ? a.answer : JSON.stringify(a.answer)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Student list */}
      {studentNames.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t('quiz.studentList')}</h4>
          <div className="flex flex-wrap gap-1.5">
            {studentNames.map(name => {
              const s = stats.byStudent.get(name) || { total: 0, correct: 0 };
              const totalQ = questions.length;
              return (
                <span key={name} className="text-xs bg-muted px-2 py-1 rounded-md">
                  {name} <span className="text-muted-foreground">({s.correct}/{totalQ})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
