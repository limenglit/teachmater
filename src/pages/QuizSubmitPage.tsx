import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ChevronLeft, ChevronRight, Send } from 'lucide-react';

interface QuizQuestion {
  type: 'single' | 'multi' | 'tf' | 'short';
  content: string;
  options: string[];
}

interface Session {
  id: string;
  title: string;
  questions: QuizQuestion[];
  status: string;
  student_names: string[];
}

const NAME_KEY = 'quiz-student-name';
const RECENT_KEY = 'quiz-recent-names';

export default function QuizSubmitPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(localStorage.getItem(NAME_KEY) || '');
  const [entered, setEntered] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    supabase.rpc('get_quiz_session_for_student', { p_session_id: sessionId })
      .then(({ data }) => {
        if (data) setSession(data as any);
        setLoading(false);
      });
  }, [sessionId]);

  // Build name suggestions from student_names + recent names
  useEffect(() => {
    if (!session) return;
    const recent: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const fromSession = Array.isArray(session.student_names) ? session.student_names : [];
    const all = [...new Set([...fromSession, ...recent])];
    setNameSuggestions(all);
  }, [session]);

  const filteredSuggestions = useMemo(() => {
    if (!name.trim()) return nameSuggestions.slice(0, 8);
    return nameSuggestions.filter(n => n.includes(name.trim())).slice(0, 8);
  }, [name, nameSuggestions]);

  const enterQuiz = () => {
    if (!name.trim()) return;
    localStorage.setItem(NAME_KEY, name.trim());
    const recent: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!recent.includes(name.trim())) {
      recent.unshift(name.trim());
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 20)));
    }
    setEntered(true);
  };

  const setAnswer = (qi: number, value: any) => {
    setAnswers(prev => ({ ...prev, [qi]: value }));
  };

  const toggleMultiAnswer = (qi: number, letter: string) => {
    const current = Array.isArray(answers[qi]) ? [...answers[qi]] : [];
    if (current.includes(letter)) setAnswer(qi, current.filter((x: string) => x !== letter));
    else setAnswer(qi, [...current, letter].sort());
  };

  const submitAll = async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    const questions = session.questions;
    const answersArray = questions.map((_q: any, i: number) => answers[i] ?? '');
    await supabase.rpc('submit_quiz_answers', {
      p_session_id: session.id,
      p_student_name: name.trim(),
      p_answers: answersArray,
    } as any);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center px-4 text-muted-foreground">{t('common.loading')}</div>;
  if (!session) return <div className="min-h-[100dvh] flex items-center justify-center px-4 text-muted-foreground">{t('quiz.sessionNotFound')}</div>;
  if (session.status !== 'active') return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 text-muted-foreground">
      <div className="text-center">
        <div className="text-4xl mb-3">⏰</div>
        <p className="text-lg font-medium text-foreground mb-1">{session.title}</p>
        <p className="text-sm">{t('quiz.sessionEnded')}</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <div className="text-center p-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <p className="text-lg font-semibold text-foreground mb-1">{t('quiz.submitSuccess')}</p>
        <p className="text-sm text-muted-foreground">{t('quiz.waitForResult')}</p>
      </div>
    </div>
  );

  // Name entry
  if (!entered) return (
    <div className="min-h-[100dvh] bg-background overflow-y-auto px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-sm space-y-4 mx-auto min-h-[calc(100dvh-max(2rem,env(safe-area-inset-top))-env(safe-area-inset-bottom))] flex flex-col justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-foreground mb-1">{session.title}</h1>
          <p className="text-sm text-muted-foreground">{session.questions.length} {t('quiz.questionsCount')}</p>
        </div>
        <div className="relative">
          <Input
            value={name}
            onChange={e => { setName(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={t('quiz.enterName')}
            className="h-12 text-base"
            onKeyDown={e => e.key === 'Enter' && enterQuiz()}
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-auto">
              {filteredSuggestions.map(s => (
                <button key={s} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onClick={() => { setName(s); setShowSuggestions(false); }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={enterQuiz} disabled={!name.trim()} className="w-full h-12 text-base">
          {t('quiz.startAnswer')}
        </Button>
      </div>
    </div>
  );

  // Quiz questions
  const questions = session.questions;
  const q = questions[currentQ];
  const answer = answers[currentQ];
  const allAnswered = questions.every((_, i) => answers[i] !== undefined && answers[i] !== '');

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Progress */}
      <div className="bg-card border-b border-border px-4 py-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">{session.title}</span>
          <span className="text-xs text-muted-foreground">{name}</span>
        </div>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors cursor-pointer ${
                i === currentQ ? 'bg-primary' : answers[i] !== undefined ? 'bg-green-400' : 'bg-muted'
              }`}
              onClick={() => setCurrentQ(i)}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full pb-6">
        <div className="mb-6">
          <span className="text-xs font-medium text-primary">Q{currentQ + 1}/{questions.length}</span>
          <p className="text-base sm:text-lg font-medium text-foreground mt-1">{q.content}</p>
        </div>

        {/* Single choice */}
        {q.type === 'single' && (
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              return (
                <button key={i}
                  className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${
                    answer === letter ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setAnswer(currentQ, letter)}
                >
                  <span className="font-mono text-sm mr-2 text-muted-foreground">{letter}.</span>
                  <span className="text-sm text-foreground">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Multiple choice */}
        {q.type === 'multi' && (
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const selected = Array.isArray(answer) && answer.includes(letter);
              return (
                <button key={i}
                  className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                  }`}
                  onClick={() => toggleMultiAnswer(currentQ, letter)}
                >
                  <span className="font-mono text-sm mr-2 text-muted-foreground">{letter}.</span>
                  <span className="text-sm text-foreground">{opt}</span>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground">{t('quiz.multiHint')}</p>
          </div>
        )}

        {/* True/False */}
        {q.type === 'tf' && (
          <div className="grid grid-cols-2 gap-3">
            <button
              className={`p-6 rounded-xl border-2 text-center transition-all ${
                answer === 'A' ? 'border-green-500 bg-green-50' : 'border-border hover:border-muted-foreground/30'
              }`}
              onClick={() => setAnswer(currentQ, 'A')}
            >
              <span className="text-2xl">✅</span>
              <p className="text-sm mt-1 text-foreground">{t('quiz.true')}</p>
            </button>
            <button
              className={`p-6 rounded-xl border-2 text-center transition-all ${
                answer === 'B' ? 'border-red-500 bg-red-50' : 'border-border hover:border-muted-foreground/30'
              }`}
              onClick={() => setAnswer(currentQ, 'B')}
            >
              <span className="text-2xl">❌</span>
              <p className="text-sm mt-1 text-foreground">{t('quiz.false')}</p>
            </button>
          </div>
        )}

        {/* Short answer */}
        {q.type === 'short' && (
          <Textarea
            value={answer || ''}
            onChange={e => setAnswer(currentQ, e.target.value)}
            placeholder={t('quiz.shortPlaceholder')}
            rows={4}
            className="text-base"
          />
        )}
      </div>

      {/* Navigation */}
      <div className="bg-card border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 sticky bottom-0">
        <Button variant="outline" size="sm" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> {t('quiz.prev')}
        </Button>
        {currentQ < questions.length - 1 ? (
          <Button size="sm" onClick={() => setCurrentQ(currentQ + 1)}>
            {t('quiz.next')} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button size="sm" onClick={submitAll} disabled={!allAnswered || submitting} className="gap-1">
            <Send className="w-4 h-4" /> {t('quiz.submit')}
          </Button>
        )}
      </div>
    </div>
  );
}
