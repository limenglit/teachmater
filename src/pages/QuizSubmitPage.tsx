import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ChevronLeft, ChevronRight, Send, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { normalizeQuizOptionText } from '@/lib/quiz-utils';
import { runQuizCall, sanitizeQuizQuestions } from '@/lib/quiz-error';
import QuizRecommendations, { type QuizWrongItem } from '@/components/quiz/QuizRecommendations';

interface QuizQuestion {
  type: 'single' | 'multi' | 'tf' | 'short';
  content: string;
  options: string[];
  correct_answer?: string | string[];
}

interface Session {
  id: string;
  title: string;
  questions: QuizQuestion[];
  status: string;
  reveal_answers?: boolean;
  student_names: string[];
}

interface StudentResult {
  student_name: string;
  answers: Array<{ question_index: number; answer: any; is_correct: boolean | null }>;
  correct_count: number;
  objective_total: number;
}

const NAME_KEY = 'quiz-student-name';
const RECENT_KEY = 'quiz-recent-names';
const DRAFT_KEY_PREFIX = 'quiz-draft';

const normalizeStudentName = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
const draftKey = (sessionId: string, studentName: string) =>
  `${DRAFT_KEY_PREFIX}::${sessionId}::${studentName}`;

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
  const [studentResult, setStudentResult] = useState<StudentResult | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recOpen, setRecOpen] = useState(false);

  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const normalizeAnswer = (value: unknown): string => {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const optionText = (q: QuizQuestion, letter: string) => {
    const index = letter.charCodeAt(0) - 65;
    if (index < 0 || index >= q.options.length) return letter;
    return `${letter}. ${normalizeQuizOptionText(q.options[index], index)}`;
  };

  const formatCorrectAnswer = (q: QuizQuestion): string => {
    const raw = q.correct_answer;
    if (raw === undefined || raw === null || raw === '') {
      return tr('quiz.noReferenceAnswer', '教师未配置参考答案');
    }
    if (Array.isArray(raw)) {
      if (q.type === 'multi') return raw.map(letter => optionText(q, letter)).join('；');
      return raw.join('；');
    }
    if (q.type === 'single' || q.type === 'tf') return optionText(q, raw);
    return raw;
  };

  const isCorrectOption = (q: QuizQuestion, letter: string): boolean => {
    const raw = q.correct_answer;
    if (Array.isArray(raw)) return raw.includes(letter);
    return raw === letter;
  };

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await runQuizCall(
        () => supabase.rpc('get_quiz_session_for_student', { p_session_id: sessionId }),
        { timeoutMs: 8000, retries: 2 },
      );
      if (cancelled) return;
      if (error) {
        toast({ title: '加载测验失败', description: error.message, variant: 'destructive' });
      } else if (data) {
        // Defensive: backend rows may contain malformed questions (missing
        // type, null options). Sanitize so the page renders gracefully.
        const raw = data as any;
        const { questions, dropped } = sanitizeQuizQuestions(raw?.questions);
        if (dropped > 0) {
          toast({ title: `已跳过 ${dropped} 道格式异常的题目` });
        }
        setSession({ ...raw, questions });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);


  useEffect(() => {
    if (!sessionId || !session || session.status !== 'ended' || !session.reveal_answers) return;
    const studentName = normalizeStudentName(name) || normalizeStudentName(localStorage.getItem(NAME_KEY) || '');
    if (!studentName) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await runQuizCall<StudentResult>(
        () => (supabase.rpc as any)('get_quiz_student_result', {
          p_session_id: sessionId,
          p_student_name: studentName,
        }),
        { timeoutMs: 8000, retries: 2 },
      );
      if (cancelled) return;
      if (error && error.kind !== 'notfound') {
        toast({ title: '加载成绩失败', description: error.message, variant: 'destructive' });
      } else if (data) {
        setStudentResult(data);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, session, name]);

  const serverAnswerMap = useMemo(() => {
    const map = new Map<number, any>();
    (studentResult?.answers || []).forEach(item => {
      map.set(item.question_index, item.answer);
    });
    return map;
  }, [studentResult]);

  // Compute objective wrong answers for personalized recommendations.
  // Skips short-answer (can't auto-judge) and questions without correct_answer.
  const wrongItems = useMemo<QuizWrongItem[]>(() => {
    if (!session || session.status !== 'ended' || !session.reveal_answers) return [];
    const list: QuizWrongItem[] = [];
    session.questions.forEach((q, idx) => {
      if (q.type === 'short') return;
      const ca = q.correct_answer;
      if (ca === undefined || ca === null || ca === '') return;
      const studentRaw = answers[idx] ?? serverAnswerMap.get(idx);
      let correct = false;
      if (q.type === 'multi') {
        const sa = Array.isArray(studentRaw) ? [...studentRaw].sort() : [];
        const co = Array.isArray(ca) ? [...ca].sort() : [];
        correct = sa.length === co.length && sa.every((v, i) => v === co[i]);
      } else {
        const sa = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
        const co = Array.isArray(ca) ? ca[0] : ca;
        correct = sa === co;
      }
      if (correct) return;
      list.push({
        index: idx,
        type: q.type,
        question: q.content,
        options: q.options,
        correctAnswer: formatCorrectAnswer(q),
        studentAnswer: normalizeAnswer(studentRaw) || '未作答',
      });
    });
    return list;
  }, [session, answers, serverAnswerMap]);


  // Poll session status so students can see when teacher ends the quiz.
  // Stop polling once ended + revealed (nothing more to learn).
  // Transient network failures are swallowed silently so the next tick can retry.
  useEffect(() => {
    if (!sessionId) return;
    if (session?.status === 'ended' && session?.reveal_answers) return;

    const timer = window.setInterval(async () => {
      const { data, error } = await runQuizCall(
        () => supabase.rpc('get_quiz_session_for_student', { p_session_id: sessionId }),
        { timeoutMs: 6000, retries: 0 },
      );
      if (!error && data) {
        const raw = data as any;
        const { questions } = sanitizeQuizQuestions(raw?.questions);
        const nextSession = { ...raw, questions };
        // Detect transition active -> ended while student is mid-answer.
        // Best-effort: try to submit whatever they've entered so the work
        // isn't lost. Failures fall through to the read-only ended view.
        if (
          session?.status === 'active' &&
          nextSession.status !== 'active' &&
          entered && !submitted && !submitting &&
          Object.keys(answers).length > 0
        ) {
          toast({ title: '教师已结束本场测验，正在为你提交已作答内容…' });
          // Fire and forget; submitAll handles its own errors / state.
          void submitAll();
        }
        setSession(nextSession);
      }
    }, 5000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.status, session?.reveal_answers, entered, submitted, submitting, answers]);


  // Build name suggestions from student_names + recent names
  useEffect(() => {
    if (!session) return;
    const recent: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const fromSession = Array.isArray(session.student_names) ? session.student_names : [];
    const all = [...new Set([...fromSession, ...recent])];
    setNameSuggestions(all);
  }, [session]);

  const filteredSuggestions = useMemo(() => {
    const normalized = normalizeStudentName(name).toLowerCase();
    if (!normalized) return nameSuggestions.slice(0, 8);
    return nameSuggestions.filter(n => normalizeStudentName(n).toLowerCase().includes(normalized)).slice(0, 8);
  }, [name, nameSuggestions]);

  // Persist current question index to draft. Debounced 400ms to avoid hammering
  // localStorage on every keystroke in short-answer questions.
  useEffect(() => {
    if (!entered || !sessionId || submitted) return;
    const normalizedName = normalizeStudentName(name);
    if (!normalizedName) return;
    const handle = window.setTimeout(() => {
      try {
        const key = draftKey(sessionId, normalizedName);
        const raw = localStorage.getItem(key);
        const prev = raw ? JSON.parse(raw) : {};
        localStorage.setItem(key, JSON.stringify({ ...prev, answers, currentQ, savedAt: Date.now() }));
      } catch { /* ignore */ }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [currentQ, entered, sessionId, name, submitted, answers]);

  // Cross-tab sync: when another tab updates the draft or submits, merge here.
  useEffect(() => {
    if (!entered || !sessionId) return;
    const normalizedName = normalizeStudentName(name);
    if (!normalizedName) return;
    const key = draftKey(sessionId, normalizedName);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      // Draft removed by another tab => that tab submitted successfully.
      if (e.newValue === null) {
        setSubmitted(true);
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.answers && typeof parsed.answers === 'object') {
          // Merge: prefer the newer savedAt to avoid clobbering local edits.
          setAnswers(prev => ({ ...prev, ...parsed.answers }));
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [entered, sessionId, name]);


  const enterQuiz = () => {
    const normalizedName = normalizeStudentName(name);
    if (!normalizedName) return;
    localStorage.setItem(NAME_KEY, normalizedName);
    const recent: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!recent.some(item => normalizeStudentName(item) === normalizedName)) {
      recent.unshift(normalizedName);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 20)));
    }
    setName(normalizedName);
    // Restore draft answers (auto-recover from refresh / accidental close)
    if (sessionId) {
      try {
        const raw = localStorage.getItem(draftKey(sessionId, normalizedName));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.answers) {
            setAnswers(parsed.answers);
            if (typeof parsed.currentQ === 'number') setCurrentQ(parsed.currentQ);
            toast({ title: '已恢复上次未提交的答题进度' });
          }
        }
      } catch { /* ignore corrupted draft */ }
    }
    setEntered(true);
  };

  const setAnswer = (qi: number, value: any) => {
    setAnswers(prev => {
      const next = { ...prev, [qi]: value };
      // Persist draft on every change so refresh / tab-close does not lose work
      if (sessionId && entered) {
        const normalizedName = normalizeStudentName(name);
        if (normalizedName) {
          try {
            localStorage.setItem(draftKey(sessionId, normalizedName), JSON.stringify({
              answers: next,
              currentQ,
              savedAt: Date.now(),
            }));
          } catch { /* quota or unavailable - ignore */ }
        }
      }
      return next;
    });
  };

  const toggleMultiAnswer = (qi: number, letter: string) => {
    // Functional update to avoid stale-closure race when user taps options
    // rapidly: reading `answers[qi]` from closure can drop the previous click
    // because React batches state updates within the same render.
    setAnswers(prev => {
      const current = Array.isArray(prev[qi]) ? [...prev[qi]] : [];
      const nextValue = current.includes(letter)
        ? current.filter((x: string) => x !== letter)
        : [...current, letter].sort();
      const next = { ...prev, [qi]: nextValue };
      if (sessionId && entered) {
        const normalizedName = normalizeStudentName(name);
        if (normalizedName) {
          try {
            localStorage.setItem(draftKey(sessionId, normalizedName), JSON.stringify({
              answers: next,
              currentQ,
              savedAt: Date.now(),
            }));
          } catch { /* ignore */ }
        }
      }
      return next;
    });
  };

  const submitAll = async () => {
    if (!session || submitting) return;
    if (session.status !== 'active') {
      toast({ title: tr('quiz.sessionEnded', '本场测验已结束，已为你展示参考答案') });
      return;
    }
    setSubmitting(true);
    const questions = session.questions;
    const answersArray = questions.map((_q: any, i: number) => answers[i] ?? '');
    const normalizedName = normalizeStudentName(name);

    // Submission is wrapped with: 15s timeout, 1 retry on network/timeout/5xx.
    // RPC raises (conflict / roster mismatch / auth) are not retried.
    const { error } = await runQuizCall(
      () => supabase.rpc('submit_quiz_answers', {
        p_session_id: session.id,
        p_student_name: normalizedName,
        p_answers: answersArray,
      } as any),
      { timeoutMs: 15_000, retries: 1 },
    );

    if (error) {
      setSubmitting(false);
      // Special-case conflicts: treat as already-submitted success path.
      if (error.kind === 'conflict') {
        if (sessionId && normalizedName) {
          try { localStorage.removeItem(draftKey(sessionId, normalizedName)); } catch { /* ignore */ }
        }
        setSubmitted(true);
        toast({ title: '你已提交过本次测验' });
        return;
      }
      // Keep draft on failure so the user can retry without losing input.
      toast({ title: tr('quiz.submitFailed', '提交失败，请重试'), description: error.message, variant: 'destructive' });
      return;
    }

    // Clear draft only on successful submit
    if (sessionId && normalizedName) {
      try { localStorage.removeItem(draftKey(sessionId, normalizedName)); } catch { /* ignore */ }
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center px-4 text-muted-foreground">{t('common.loading')}</div>;
  if (!session) return <div className="min-h-[100dvh] flex items-center justify-center px-4 text-muted-foreground">{t('quiz.sessionNotFound')}</div>;
  if (session.status !== 'active') return (
    <div className="min-h-[100dvh] bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-5">
          <div className="text-4xl mb-3">⏰</div>
          <p className="text-lg font-medium text-foreground mb-1">{session.title}</p>
          <p className="text-sm text-muted-foreground">{t('quiz.sessionEnded')}</p>
          <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-medium border ${
            session.reveal_answers
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span>{session.reveal_answers ? '✅' : '🔒'}</span>
            <span>
              {session.reveal_answers
                ? tr('quiz.answerNowVisible', '本场测验已结束，以下展示参考答案')
                : tr('quiz.answerHiddenAfterEnd', '本场测验已结束，教师设置为不公开参考答案')}
            </span>
          </div>
        </div>

        {session.reveal_answers ? (
          <div className="space-y-3">
            {session.questions.map((q, idx) => (
              <div key={`${idx}-${q.content}`} id={`quiz-review-q-${idx}`} className="rounded-xl border border-border bg-card p-4 scroll-mt-24 transition-shadow" data-quiz-review-idx={idx}>
                <p className="text-sm font-medium text-foreground mb-2">Q{idx + 1}. {q.content}</p>
                {q.options?.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {q.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const correct = isCorrectOption(q, letter);
                      return (
                        <span
                          key={`${idx}-${letter}`}
                          className={`text-[11px] px-2 py-0.5 rounded ${correct ? 'bg-green-100 text-green-700 font-medium' : 'bg-muted text-muted-foreground'}`}
                        >
                          {letter}. {normalizeQuizOptionText(opt, i)}
                        </span>
                      );
                    })}
                  </div>
                )}
                <p className="text-sm text-muted-foreground mb-1">
                  {tr('quiz.yourAnswer', '你的作答')}：{normalizeAnswer(answers[idx] ?? serverAnswerMap.get(idx)) || tr('quiz.notAnswered', '未作答')}
                </p>
                <p className="text-sm text-green-700">
                  {tr('quiz.referenceAnswer', '参考答案')}：{formatCorrectAnswer(q)}
                </p>
              </div>
            ))}
            {studentResult && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-medium text-foreground">
                  {tr('quiz.scoreSummary', '成绩')}：{studentResult.correct_count} / {studentResult.objective_total}
                </p>
                <p className="text-muted-foreground mt-1">
                  {tr('quiz.scoreHint', '仅统计客观题（单选/多选/判断）')}
                </p>
              </div>
            )}
            {wrongItems.length > 0 && (
              <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">AI 个性化学习推荐</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      你有 {wrongItems.length} 道错题，AI 可分析错误根源并推荐针对性讲解与视频。
                    </p>
                  </div>
                </div>
                <Button size="sm" className="w-full gap-1.5" onClick={() => setRecOpen(true)}>
                  <Sparkles className="w-3.5 h-3.5" /> 生成个性化学习推荐
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground text-center">
            {tr('quiz.answerHiddenAfterEnd', '本场测验已结束，教师设置为不公开参考答案')}
          </div>
        )}
      </div>
      <QuizRecommendations
        open={recOpen}
        onOpenChange={setRecOpen}
        sessionTitle={session.title}
        wrongs={wrongItems}
      />
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
            maxLength={60}
            dir="auto"
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

  const answeredCount = questions.filter((_, i) => answers[i] !== undefined && answers[i] !== '').length;

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Progress */}
      <div className="bg-card border-b border-border px-4 py-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground truncate">{session.title}</span>
          <span className="text-xs text-muted-foreground truncate ml-2">{name}</span>
        </div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-primary" aria-live="polite">
            {tr('quiz.progressLabel', '第')} {currentQ + 1} / {questions.length}
          </span>
          <span className="text-xs text-muted-foreground">
            {tr('quiz.answeredCount', '已作答')} {answeredCount}/{questions.length}
          </span>
        </div>
        <div
          className="flex gap-1"
          role="tablist"
          aria-label={tr('quiz.questionNavLabel', '题目导航')}
        >
          {questions.map((_, i) => {
            const isCurrent = i === currentQ;
            const isAnswered = answers[i] !== undefined && answers[i] !== '';
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-label={`${tr('quiz.jumpToQuestion', '跳转到第')} ${i + 1} ${tr('quiz.questionUnit', '题')}${isAnswered ? `（${tr('quiz.answered', '已作答')}）` : ''}`}
                onClick={() => setCurrentQ(i)}
                className={`h-2 flex-1 min-w-[8px] rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                  isCurrent ? 'bg-primary' : isAnswered ? 'bg-green-500' : 'bg-muted hover:bg-muted-foreground/30'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full pb-6">
        <div className="mb-6">
          <span className="text-xs font-medium text-primary">Q{currentQ + 1}/{questions.length}</span>
          <h2 className="text-base sm:text-lg font-medium text-foreground mt-1 break-words" dir="auto">{q.content}</h2>
        </div>


        {/* Single choice */}
        {q.type === 'single' && (
          <div className="space-y-2" role="radiogroup" aria-label={tr('quiz.singleChoiceLabel', '单选题选项')}>
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const selected = answer === letter;
              return (
                <button key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`w-full text-left p-3 sm:p-4 min-h-[44px] rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setAnswer(currentQ, letter)}
                >
                  <span className="font-mono text-sm mr-2 text-muted-foreground" aria-hidden="true">{letter}.</span>
                  <span className="text-sm text-foreground break-words" dir="auto">{normalizeQuizOptionText(opt, i)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Multiple choice */}
        {q.type === 'multi' && (
          <div className="space-y-2" role="group" aria-label={tr('quiz.multiChoiceLabel', '多选题选项')}>
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const selected = Array.isArray(answer) && answer.includes(letter);
              return (
                <button key={i}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  className={`w-full text-left p-3 sm:p-4 min-h-[44px] rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                  }`}
                  onClick={() => toggleMultiAnswer(currentQ, letter)}
                >
                  <span className="font-mono text-sm mr-2 text-muted-foreground" aria-hidden="true">{letter}.</span>
                  <span className="text-sm text-foreground break-words" dir="auto">{normalizeQuizOptionText(opt, i)}</span>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground">{t('quiz.multiHint')}</p>
          </div>
        )}

        {/* True/False */}
        {q.type === 'tf' && (
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={tr('quiz.tfLabel', '判断题')}>
            <button
              type="button"
              role="radio"
              aria-checked={answer === 'A'}
              aria-label={t('quiz.true')}
              className={`p-6 min-h-[88px] rounded-xl border-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                answer === 'A' ? 'border-green-600 bg-green-50' : 'border-border hover:border-muted-foreground/30'
              }`}
              onClick={() => setAnswer(currentQ, 'A')}
            >
              <span className="text-2xl" aria-hidden="true">✅</span>
              <p className="text-sm mt-1 text-foreground">{t('quiz.true')}</p>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={answer === 'B'}
              aria-label={t('quiz.false')}
              className={`p-6 min-h-[88px] rounded-xl border-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                answer === 'B' ? 'border-red-600 bg-red-50' : 'border-border hover:border-muted-foreground/30'
              }`}
              onClick={() => setAnswer(currentQ, 'B')}
            >
              <span className="text-2xl" aria-hidden="true">❌</span>
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
            maxLength={2000}
            dir="auto"
            aria-label={tr('quiz.shortAnswerLabel', '简答题作答')}
          />
        )}

      </div>

      {/* Navigation */}
      <div className="bg-card border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 sticky bottom-0">
        <Button
          variant="outline"
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="min-h-11"
          aria-label={t('quiz.prev')}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> {t('quiz.prev')}
        </Button>
        {currentQ < questions.length - 1 ? (
          <Button
            onClick={() => setCurrentQ(currentQ + 1)}
            className="min-h-11"
            aria-label={t('quiz.next')}
          >
            {t('quiz.next')} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={submitAll}
            disabled={!allAnswered || submitting}
            className="gap-1 min-h-11"
            aria-label={t('quiz.submit')}
          >
            <Send className="w-4 h-4" /> {submitting ? '提交中...' : t('quiz.submit')}
          </Button>

        )}
      </div>
    </div>
  );
}
