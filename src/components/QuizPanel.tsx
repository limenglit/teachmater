import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Play, StopCircle, QrCode, ArrowLeft, Download, Cloud, HardDrive, BookOpen, FileCheck, History, Users, Sparkles, Trash2 } from 'lucide-react';
import ClassRosterPicker from '@/components/ClassRosterPicker';
import { useStudents } from '@/contexts/StudentContext';
import { tFormat } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QuizStatsView from '@/components/quiz/QuizStatsView';
import QuizQuestionBank from '@/components/quiz/QuizQuestionBank';
// Heavy tabs lazy-loaded — only fetched when user opens them.
const QuizPaperBank = lazy(() => import('@/components/quiz/QuizPaperBank'));
const QuizAIGenerator = lazy(() => import('@/components/quiz/QuizAIGenerator'));
import type { QuizQuestion, QuizSession, QuizCategory, QuizPaper } from '@/components/quiz/quizTypes';
import {
  getSessionTokens, saveSessionToken, getSessionToken,
  getLocalQuestions, saveLocalQuestions,
  getLocalCategories, getLocalPapers, saveLocalPapers,
} from '@/components/quiz/quizTypes';
import { downloadQrFromContainer } from '@/lib/qr-download';
import QRActionPanel from '@/components/qr/QRActionPanel';
import { runQuizCall } from '@/lib/quiz-error';

// Re-export for backward compat
export type { QuizQuestion, QuizSession };

const SESSION_TOKENS_KEY = 'quiz-session-tokens';

export default function QuizPanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students: sidebarStudents } = useStudents();
  const isGuest = !user;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [papers, setPapers] = useState<QuizPaper[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);

  const [tab, setTab] = useState<'bank' | 'ai' | 'papers' | 'sessions'>('bank');
  const [showSession, setShowSession] = useState(false);

  const [sessionTitle, setSessionTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showQR, setShowQR] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [sessionStudentNames, setSessionStudentNames] = useState<string[]>([]);
  const [ending, setEnding] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<QuizSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [revealAfterEnd, setRevealAfterEnd] = useState(true);
  const [revealFeatureUnsupported, setRevealFeatureUnsupported] = useState(false);
  const [paperSeed, setPaperSeed] = useState<{ questions: QuizQuestion[]; title: string } | null>(null);
  // Submission counts per session — used to warn before destructive operations
  // (delete / end). Populated lazily when the teacher opens a session detail.
  const [sessionSubmissionCount, setSessionSubmissionCount] = useState<number | null>(null);
  const qrPreviewRef = useRef<HTMLDivElement>(null);


  const REVEAL_AFTER_END_KEY = 'quiz-reveal-after-end';

  useEffect(() => {
    const raw = localStorage.getItem(REVEAL_AFTER_END_KEY);
    if (raw === '1') setRevealAfterEnd(true);
    if (raw === '0') setRevealAfterEnd(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(REVEAL_AFTER_END_KEY, revealAfterEnd ? '1' : '0');
  }, [revealAfterEnd]);

  // Fetch distinct submitter count whenever a session detail opens, so the
  // confirm dialogs (end / delete) can warn teachers that real student
  // submissions will be impacted.
  useEffect(() => {
    if (!showSession || !activeSession) { setSessionSubmissionCount(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('quiz_answers')
        .select('student_name')
        .eq('session_id', activeSession.id) as any;
      if (cancelled) return;
      const unique = new Set<string>((data || []).map((r: any) => r.student_name));
      setSessionSubmissionCount(unique.size);
    })();
    return () => { cancelled = true; };
  }, [showSession, activeSession?.id]);


  useEffect(() => {
    if (user) {
      // Parallel fetch — these are independent queries; running them sequentially
      // wastes ~3 round-trips of latency on tab open.
      Promise.all([loadQuestions(), loadSessions(), loadCategories(), loadPapers()]);
    } else {
      setQuestions(getLocalQuestions());
      setCategories(getLocalCategories());
      setPapers(getLocalPapers());
      setSessions([]);
    }
  }, [user]);

  // All loaders wrap their call in runQuizCall so network/timeout/5xx errors
  // become a visible toast instead of a silent empty list. RLS / auth errors
  // (e.g. session expired) also surface so the user knows to re-login.
  const reportLoadError = (label: string, err: { message: string; kind: string } | null) => {
    if (!err) return;
    toast({ title: `加载${label}失败`, description: err.message, variant: 'destructive' });
  };

  const loadQuestions = async () => {
    if (!user) return;
    const { data, error } = await runQuizCall<any[]>(
      () => supabase.from('quiz_questions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }) as any,
      { timeoutMs: 10_000, retries: 1 },
    );
    if (error) return reportLoadError('题库', error);
    if (data) setQuestions(data as any);
  };

  const loadCategories = async () => {
    if (!user) return;
    const { data, error } = await runQuizCall<any[]>(
      () => supabase.from('quiz_categories').select('*').eq('user_id', user.id).order('sort_order') as any,
      { timeoutMs: 10_000, retries: 1 },
    );
    if (error) return reportLoadError('分类', error);
    if (data) setCategories(data as any);
  };

  const loadPapers = async () => {
    if (!user) return;
    const { data, error } = await runQuizCall<any[]>(
      () => supabase.from('quiz_papers').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }) as any,
      { timeoutMs: 10_000, retries: 1 },
    );
    if (error) return reportLoadError('试卷', error);
    if (data) setPapers(data as any);
  };

  const loadSessions = async () => {
    if (!user) return;
    const tokens = Object.values(getSessionTokens());
    const [mine, byToken] = await Promise.all([
      runQuizCall<any[]>(
        () => (supabase.from('quiz_sessions').select('*') as any).eq('user_id', user.id).order('created_at', { ascending: false }),
        { timeoutMs: 10_000, retries: 1 },
      ),
      tokens.length > 0
        ? runQuizCall<any[]>(
            () => supabase.from('quiz_sessions').select('*').in('creator_token', tokens).order('created_at', { ascending: false }) as any,
            { timeoutMs: 10_000, retries: 1 },
          )
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (mine.error) return reportLoadError('测验列表', mine.error);
    const all: QuizSession[] = mine.data ? [...mine.data] : [];
    if (byToken.data) {
      for (const s of byToken.data) {
        if (!all.find((a: any) => a.id === s.id)) all.push(s);
      }
    }
    setSessions(all);
  };

  const ensureSessionToken = (session: QuizSession | null): string | null => {
    if (!session) return null;
    const cached = getSessionToken(session.id);
    if (cached) return cached;

    const fallback = (session as any).creator_token as string | undefined;
    if (fallback && fallback.trim()) {
      saveSessionToken(session.id, fallback);
      return fallback;
    }
    return null;
  };

  const publishQuizSession = async (selectedQuestions: QuizQuestion[], titleSeed?: string) => {
    if (publishing) return;
    if (!user) { toast({ title: t('quiz.loginToPublish'), variant: 'destructive' }); return; }
    if (selectedQuestions.length === 0) { toast({ title: t('quiz.selectQuestions'), variant: 'destructive' }); return; }
    // Validate question content & options - reject empty / malformed before publishing
    const invalidIdx = selectedQuestions.findIndex(q => !q || typeof q.content !== 'string' || q.content.trim() === '');
    if (invalidIdx !== -1) {
      toast({ title: `第 ${invalidIdx + 1} 题内容为空，请补全后再发布`, variant: 'destructive' });
      return;
    }
    const optionMissingIdx = selectedQuestions.findIndex(q =>
      (q.type === 'single' || q.type === 'multi') &&
      (!Array.isArray(q.options) || q.options.filter(o => String(o ?? '').trim() !== '').length < 2)
    );
    if (optionMissingIdx !== -1) {
      toast({ title: `第 ${optionMissingIdx + 1} 题选项不足 2 个，请补全`, variant: 'destructive' });
      return;
    }
    const names = sessionStudentNames.length > 0 ? sessionStudentNames : sidebarStudents.map(s => s.name);
    const title = (titleSeed || sessionTitle).trim() || t('quiz.defaultTitle');
    const payload: any = {
      user_id: user.id,
      title,
      questions: selectedQuestions as any,
      reveal_answers: revealAfterEnd,
      student_names: names as any,
    };

    const isRevealSchemaError = (message?: string) => {
      const m = (message || '').toLowerCase();
      return m.includes('reveal_answers') && (m.includes('schema cache') || m.includes('column') || m.includes('could not find'));
    };

    setPublishing(true);
    let { data, error } = await supabase.from('quiz_sessions').insert(payload).select().single() as any;

    if (error && isRevealSchemaError(error.message)) {
      const { reveal_answers: _skip, ...fallbackPayload } = payload;
      const retry = await supabase.from('quiz_sessions').insert(fallbackPayload).select().single() as any;
      data = retry.data;
      error = retry.error;
      if (!retry.error) {
        setRevealFeatureUnsupported(true);
        toast({ title: '测验已发布（数据库未升级公开答案功能，已自动降级）' });
      }
    }

    setPublishing(false);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    saveSessionToken(data.id, data.creator_token);
    setActiveSession(data); setShowSession(true);
    setSelectedIds(new Set()); setSessionTitle(''); setSessionStudentNames([]);
    loadSessions();
  };


  const startSession = async () => {
    const selected = questions.filter(q => selectedIds.has(q.id));
    await publishQuizSession(selected);
  };

  const endSession = async () => {
    if (!activeSession || ending) return;
    const token = ensureSessionToken(activeSession);
    if (!token) {
      toast({ title: '无法结束测验：缺少会话凭证', variant: 'destructive' });
      return;
    }

    setEnding(true);
    const { error } = await supabase.rpc('update_quiz_session', {
      p_session_id: activeSession.id,
      p_token: token,
      p_status: 'ended',
      p_reveal_answers: revealAfterEnd,
    } as any);

    if (error && /p_reveal_answers/i.test(error.message || '')) {
      // Backward compatibility for databases not yet migrated.
      const fallback = await supabase.rpc('update_quiz_session', {
        p_session_id: activeSession.id,
        p_token: token,
        p_status: 'ended',
      } as any);
      setEnding(false);
      if (fallback.error) {
        toast({ title: `结束测验失败：${fallback.error.message}`, variant: 'destructive' });
        return;
      }
      setActiveSession(prev => prev ? { ...prev, status: 'ended', reveal_answers: false } : null);
      toast({ title: '测验已结束。当前数据库未升级，暂不支持公开参考答案开关' });
      loadSessions();
      return;
    }

    setEnding(false);

    if (error) {
      toast({ title: `结束测验失败：${error.message}`, variant: 'destructive' });
      return;
    }

    setActiveSession(prev => prev ? { ...prev, status: 'ended', reveal_answers: revealAfterEnd } : null);
    toast({ title: revealAfterEnd ? '测验已结束，学生端将显示参考答案与成绩' : '测验已结束，参考答案对学生端隐藏' });
    loadSessions();
  };

  const deleteSession = async (s: QuizSession) => {
    const token = ensureSessionToken(s);
    if (!token) {
      toast({ title: '无法删除测验：缺少会话凭证', variant: 'destructive' });
      return;
    }
    setDeleting(true);
    const { error } = await supabase.rpc('delete_quiz_session', { p_session_id: s.id, p_token: token } as any);
    setDeleting(false);
    if (error) {
      toast({ title: `删除测验失败：${error.message}`, variant: 'destructive' });
      return;
    }
    setSessions(prev => prev.filter(x => x.id !== s.id));
    if (activeSession?.id === s.id) { setActiveSession(null); setShowSession(false); }
    setSessionToDelete(null);
    setDeleteConfirmOpen(false);
    toast({ title: '测验已删除' });
  };

  const requestDeleteSession = (session: QuizSession) => {
    setSessionToDelete(session);
    setDeleteConfirmOpen(true);
  };

  const exportCSV = async () => {
    if (!activeSession) return;
    const { data } = await supabase.from('quiz_answers').select('*').eq('session_id', activeSession.id).order('student_name').order('question_index') as any;
    if (!data || data.length === 0) { toast({ title: t('quiz.noData') }); return; }
    const qs = activeSession.questions;
    // RFC 4180 CSV-safe cell escaping: wrap in quotes if contains comma/quote/newline; double internal quotes
    const escapeCell = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v);
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = ['学生', ...qs.map((_: any, i: number) => `Q${i + 1}`), '正确数', '总题数'];
    const students = [...new Set(data.map((a: any) => a.student_name))];
    const rows = students.map(name => {
      const answers = data.filter((a: any) => a.student_name === name);
      let correct = 0;
      const cells = qs.map((_: any, i: number) => {
        const a = answers.find((x: any) => x.question_index === i);
        if (!a) return '';
        if (a.is_correct) correct++;
        return typeof a.answer === 'string' ? a.answer : JSON.stringify(a.answer);
      });
      return [name, ...cells, correct, qs.length];
    });
    const csv = [headers, ...rows].map(r => r.map(escapeCell).join(',')).join('\r\n');
    // Sanitize title for filename (avoid path traversal / illegal chars)
    const safeTitle = (activeSession.title || 'session').replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, 80);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `quiz-${safeTitle}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // Active session view
  if (showSession && activeSession) {
    const submitUrl = `${window.location.origin}/quiz/${activeSession.id}`;
    return (
      <div data-testid="quiz-panel-session" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setShowSession(false)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> {t('board.back')}
          </Button>
          <h2 className="font-semibold text-foreground text-sm truncate">{activeSession.title}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeSession.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
            {activeSession.status === 'active' ? t('quiz.active') : t('quiz.ended')}
          </span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              (activeSession as any).reveal_answers
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={(activeSession as any).reveal_answers ? '结束后学生端可看到参考答案' : '结束后学生端不会显示参考答案'}
          >
            {(activeSession as any).reveal_answers ? '答案：公开' : '答案：隐藏'}
          </span>
          <div className="ml-auto flex items-center gap-1 max-w-full overflow-x-auto pb-1">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowQR(true)}>
              <QrCode className="w-3 h-3" /> {t('board.qrcode')}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportCSV}>
              <Download className="w-3 h-3" /> {t('quiz.exportCSV')}
            </Button>
            {activeSession.status === 'active' && (
              <label className="flex items-center gap-1.5 h-7 px-2 rounded border border-border bg-card text-xs text-foreground cursor-pointer">
                <Switch
                  checked={revealAfterEnd}
                  onCheckedChange={setRevealAfterEnd}
                  disabled={revealFeatureUnsupported}
                  className="scale-75 -mx-1"
                />
                <span className="whitespace-nowrap">公开答案</span>
              </label>
            )}
            {activeSession.status === 'active' && (
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => setEndConfirmOpen(true)} disabled={ending}>
                <StopCircle className="w-3 h-3" /> {t('quiz.endSession')}
              </Button>
            )}
            {activeSession.status === 'ended' && (
              <Button data-testid="quiz-session-detail-delete-trigger" variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => requestDeleteSession(activeSession)} disabled={deleting}>
                <Trash2 className="w-3 h-3" /> {t('common.delete')}
              </Button>
            )}
          </div>
        </div>
        <QuizStatsView session={activeSession} />
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t('quiz.scanToAnswer')}</DialogTitle></DialogHeader>
            <QRActionPanel
              url={submitUrl}
              qrSize={200}
              qrContainerRef={qrPreviewRef}
              actions={(
                <>
                  <Button size="sm" variant="outline" className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap" onClick={() => { navigator.clipboard.writeText(submitUrl); toast({ title: t('board.shareLink') }); }}>{t('board.shareLink')}</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap"
                    onClick={async () => {
                      try {
                        await downloadQrFromContainer(qrPreviewRef.current, `quiz-${activeSession?.id || 'qrcode'}.png`);
                        toast({ title: t('board.downloadPng') });
                      } catch {
                        toast({ title: '下载PNG失败', variant: 'destructive' });
                      }
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> {t('board.downloadPng')}
                  </Button>
                </>
              )}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog open={endConfirmOpen} onOpenChange={setEndConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('quiz.endSession')}</AlertDialogTitle>
              <AlertDialogDescription>
                {sessionSubmissionCount && sessionSubmissionCount > 0
                  ? `本场测验已有 ${sessionSubmissionCount} 位学生提交答案。结束后学生将无法继续提交，且本场不可重新开放。请确认操作。`
                  : '结束后学生将无法继续提交答案。请确认是否立即结束本场测验。'}
              </AlertDialogDescription>

            </AlertDialogHeader>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="text-sm">
                <p className="font-medium text-foreground">结束后公开参考答案</p>
                <p className="text-xs text-muted-foreground">
                  {revealFeatureUnsupported
                    ? '当前数据库未升级公开答案功能，开关暂不可用'
                    : '开启后，学生端在结束页可查看每题参考答案'}
                </p>
              </div>
              <Switch checked={revealAfterEnd} onCheckedChange={setRevealAfterEnd} disabled={revealFeatureUnsupported} />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={ending}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void endSession().then(() => setEndConfirmOpen(false));
                }}
                disabled={ending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {ending ? '处理中...' : '确认结束'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {sessionToDelete && sessionSubmissionCount && sessionSubmissionCount > 0
                  ? `⚠️ 本场测验包含 ${sessionSubmissionCount} 位学生的作答记录，删除后将一并永久清除，且不可恢复。`
                  : '确定要删除这场已结束测验吗？删除后学生作答记录也将不可恢复。'}
              </AlertDialogDescription>

            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                data-testid="quiz-session-delete-confirm"
                onClick={(event) => {
                  event.preventDefault();
                  if (sessionToDelete) {
                    void deleteSession(sessionToDelete);
                  }
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? '删除中...' : t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Main view with tabs
  const tabs = [
    { id: 'bank' as const, label: t('quiz.questionBank'), icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'ai' as const, label: t('quiz.ai.tab'), icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'papers' as const, label: t('quiz.paper.paperBank'), icon: <FileCheck className="w-3.5 h-3.5" /> },
    { id: 'sessions' as const, label: t('quiz.recentSessions'), icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <div data-testid="quiz-panel" className="flex-1 overflow-auto p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold text-foreground text-lg">📝 {t('quiz.title')}</h3>
          {isGuest ? (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              <HardDrive className="w-3 h-3" /> {t('quiz.localMode')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Cloud className="w-3 h-3" /> {t('quiz.cloudMode')}
            </span>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-5 border-b border-border">
          {tabs.map(tb => (
            <button key={tb.id}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === tb.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab(tb.id)}>
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'bank' && (
          <QuizQuestionBank
            questions={questions} setQuestions={setQuestions}
            categories={categories} setCategories={setCategories}
            selectedIds={selectedIds} setSelectedIds={setSelectedIds}
            onStartSession={startSession}
            publishing={publishing}

            sessionTitle={sessionTitle} setSessionTitle={setSessionTitle}
            revealAfterEnd={revealAfterEnd}
            onRevealAfterEndChange={setRevealAfterEnd}
            isGuest={isGuest}
            onBuildPaperFromSelection={(qs, title) => {
              setPaperSeed({ questions: qs, title });
              setTab('papers');
            }}
            rosterButton={
              <Button
                variant={sessionStudentNames.length > 0 ? 'default' : 'outline'}
                size="sm" className="h-8 text-xs gap-1 shrink-0"
                onClick={() => setShowRoster(true)}
              >
                <Users className="w-3 h-3" />
                {sessionStudentNames.length > 0
                  ? tFormat(t('board.studentCount'), sessionStudentNames.length)
                  : t('board.selectClass')}
              </Button>
            }
          />
        )}

        {tab === 'ai' && (
          <Suspense fallback={<div className="text-center py-10 text-xs text-muted-foreground">{t('common.loading') || 'Loading…'}</div>}>
            <QuizAIGenerator
              isGuest={isGuest}
              userId={user?.id ?? null}
              questions={questions}
              setQuestions={setQuestions}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onSwitchToBank={() => setTab('bank')}
            />
          </Suspense>
        )}

        {tab === 'papers' && (
          <Suspense fallback={<div className="text-center py-10 text-xs text-muted-foreground">{t('common.loading') || 'Loading…'}</div>}>
            <QuizPaperBank
              papers={papers} setPapers={setPapers}
              questions={questions} isGuest={isGuest}
              seedQuestions={paperSeed?.questions}
              seedTitle={paperSeed?.title}
              onSeedConsumed={() => setPaperSeed(null)}
              onPublishPaper={async (paper) => {
                await publishQuizSession(paper.questions.map((item) => item.question), paper.title);
              }}
              rosterButton={
                <Button
                  variant={sessionStudentNames.length > 0 ? 'default' : 'outline'}
                  size="sm" className="h-8 text-xs gap-1 shrink-0"
                  onClick={() => setShowRoster(true)}
                >
                  <Users className="w-3 h-3" />
                  {sessionStudentNames.length > 0
                    ? tFormat(t('board.studentCount'), sessionStudentNames.length)
                    : t('board.selectClass')}
                </Button>
              }
            />
          </Suspense>
        )}

        {tab === 'sessions' && (
          <div className="space-y-2">
            {isGuest ? (
              <div className="text-center py-10 text-muted-foreground">
                <Cloud className="w-8 h-8 mx-auto mb-2 text-primary/30" />
                <p className="text-xs">{t('quiz.loginForSessions')}</p>
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">{t('quiz.noSessions')}</p>
            ) : sessions.map(s => (
              <div key={s.id}
                className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => {
                  ensureSessionToken(s);
                  setRevealAfterEnd(!!(s as any).reveal_answers);
                  setActiveSession(s);
                  setShowSession(true);
                }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground truncate">{s.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {s.status === 'active' ? t('quiz.active') : t('quiz.ended')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {(s.questions as any[]).length} {t('quiz.questionsCount')} · {new Date(s.created_at).toLocaleDateString()}
                  </span>
                  {s.status === 'ended' && (
                    <Button
                      data-testid={`quiz-session-list-delete-${s.id}`}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDeleteSession(s);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ClassRosterPicker
        open={showRoster}
        onOpenChange={setShowRoster}
        onSelect={(names) => {
          setSessionStudentNames(names);
          toast({ title: t('board.classLinked'), description: tFormat(t('board.studentCount'), names.length) });
        }}
        currentCount={sessionStudentNames.length}
        onClear={() => setSessionStudentNames([])}
      />
    </div>
  );
}
