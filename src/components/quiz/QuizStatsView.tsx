import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
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
    const { data } = await supabase.from('quiz_answers').select('*').eq('session_id', session.id) as any;
    if (data) setAnswers(data);
  };

  // Stats
  const studentNames = [...new Set(answers.map(a => a.student_name))];
  const submittedCount = studentNames.length;

  return (
    <div className="flex-1 overflow-auto p-4 space-y-6">
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
              ? `${Math.round((answers.filter(a => a.is_correct === true).length / answers.length) * 100)}%`
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
          const qAnswers = answers.filter(a => a.question_index === qi);
          const total = qAnswers.length;
          const correct = qAnswers.filter(a => a.is_correct === true).length;

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
              const studentAnswers = answers.filter(a => a.student_name === name);
              const correctCount = studentAnswers.filter(a => a.is_correct === true).length;
              const totalQ = questions.length;
              return (
                <span key={name} className="text-xs bg-muted px-2 py-1 rounded-md">
                  {name} <span className="text-muted-foreground">({correctCount}/{totalQ})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
