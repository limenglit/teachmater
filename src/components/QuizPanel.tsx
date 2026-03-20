import { useState, useEffect, useRef } from 'react';
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
import QuizPaperBank from '@/components/quiz/QuizPaperBank';
import QuizAIGenerator from '@/components/quiz/QuizAIGenerator';
import type { QuizQuestion, QuizSession, QuizCategory, QuizPaper } from '@/components/quiz/quizTypes';
import {
  getSessionTokens, saveSessionToken, getSessionToken,
  getLocalQuestions, saveLocalQuestions,
  getLocalCategories, getLocalPapers, saveLocalPapers,
} from '@/components/quiz/quizTypes';
import { downloadSvgAsPng } from '@/lib/qr-download';
import QRActionPanel from '@/components/qr/QRActionPanel';

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
  const [revealAfterEnd, setRevealAfterEnd] = useState(true);
  const [revealFeatureUnsupported, setRevealFeatureUnsupported] = useState(false);
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

  useEffect(() => {
    if (user) {
      loadQuestions(); loadSessions(); loadCategories(); loadPapers();
    } else {
      setQuestions(getLocalQuestions());
      setCategories(getLocalCategories());
      setPapers(getLocalPapers());
      setSessions([]);
    }
  }, [user]);

  const loadQuestions = async () => {
    if (!user) return;
    const { data } = await supabase.from('quiz_questions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }) as any;
    if (data) setQuestions(data);
  };

  const loadCategories = async () => {
    if (!user) return;
    const { data } = await supabase.from('quiz_categories').select('*').eq('user_id', user.id).order('sort_order') as any;
    if (data) setCategories(data);
  };

  const loadPapers = async () => {
    if (!user) return;
    const { data } = await supabase.from('quiz_papers').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }) as any;
    if (data) setPapers(data);
  };

  const loadSessions = async () => {
    if (!user) return;
    const tokens = Object.values(getSessionTokens());
    let all: QuizSession[] = [];
    const { data } = await (supabase.from('quiz_sessions').select('*') as any).eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) all = data;
    if (tokens.length > 0) {
      const { data: d2 } = await supabase.from('quiz_sessions').select('*').in('creator_token', tokens).order('created_at', { ascending: false }) as any;
      if (d2) { for (const s of d2) { if (!all.find((a: any) => a.id === s.id)) all.push(s); } }
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

  const startSession = async () => {
    if (!user) { toast({ title: t('quiz.loginToPublish'), variant: 'destructive' }); return; }
    const selected = questions.filter(q => selectedIds.has(q.id));
    if (selected.length === 0) { toast({ title: t('quiz.selectQuestions'), variant: 'destructive' }); return; }
    // Default to sidebar students if no roster selected
    const names = sessionStudentNames.length > 0 ? sessionStudentNames : sidebarStudents.map(s => s.name);
    const title = sessionTitle.trim() || t('quiz.defaultTitle');
    const payload: any = {
      user_id: user.id,
      title,
      questions: selected as any,
      reveal_answers: revealAfterEnd,
      student_names: names as any,
    };

    const isRevealSchemaError = (message?: string) => {
      const m = (message || '').toLowerCase();
      return m.includes('reveal_answers') && (m.includes('schema cache') || m.includes('column') || m.includes('could not find'));
    };

    let { data, error } = await supabase.from('quiz_sessions').insert(payload).select().single() as any;

    if (error && isRevealSchemaError(error.message)) {
      // Auto fallback when database column is not migrated or PostgREST schema cache is stale.
      const { reveal_answers: _skip, ...fallbackPayload } = payload;
      const retry = await supabase.from('quiz_sessions').insert(fallbackPayload).select().single() as any;
      data = retry.data;
      error = retry.error;
      if (!retry.error) {
        setRevealFeatureUnsupported(true);
        toast({ title: '测验已发布（数据库未升级公开答案功能，已自动降级）' });
      }
    }

    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    saveSessionToken(data.id, data.creator_token);
    setActiveSession(data); setShowSession(true);
    setSelectedIds(new Set()); setSessionTitle(''); setSessionStudentNames([]);
    loadSessions();
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
      p_reveal_answers: true,
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

    setActiveSession(prev => prev ? { ...prev, status: 'ended', reveal_answers: true } : null);
    toast({ title: '测验已结束，学生端将显示参考答案与成绩' });
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
    const headers = ['学生', ...qs.map((_: any, i: number) => `Q${i + 1}`), '正确数', '总题数'];
    const students = [...new Set(data.map((a: any) => a.student_name))];
    const rows = students.map(name => {
      const answers = data.filter((a: any) => a.student_name === name);
      let correct = 0;
      const cells = qs.map((_: any, i: number) => { const a = answers.find((x: any) => x.question_index === i); if (!a) return ''; if (a.is_correct) correct++; return typeof a.answer === 'string' ? a.answer : JSON.stringify(a.answer); });
      return [name, ...cells, correct, qs.length];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `quiz-${activeSession.title}.csv`; a.click(); URL.revokeObjectURL(url);
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
          <div className="ml-auto flex items-center gap-1 max-w-full overflow-x-auto pb-1">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowQR(true)}>
              <QrCode className="w-3 h-3" /> {t('board.qrcode')}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportCSV}>
              <Download className="w-3 h-3" /> {t('quiz.exportCSV')}
            </Button>
            {activeSession.status === 'active' && (
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => setEndConfirmOpen(true)} disabled={ending}>
                <StopCircle className="w-3 h-3" /> {t('quiz.endSession')}
              </Button>
            )}
            {activeSession.status === 'ended' && (
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => requestDeleteSession(activeSession)} disabled={deleting}>
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
                        const svg = qrPreviewRef.current?.querySelector('svg');
                        if (!svg) throw new Error('QR not ready');
                        await downloadSvgAsPng(svg as SVGSVGElement, `quiz-${activeSession?.id || 'qrcode'}.png`);
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
                结束后学生将无法继续提交答案。请确认是否立即结束本场测验。
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
                确定要删除这场已结束测验吗？删除后学生作答记录也将不可恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
              <AlertDialogAction
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
            sessionTitle={sessionTitle} setSessionTitle={setSessionTitle}
            revealAfterEnd={revealAfterEnd}
            onRevealAfterEndChange={setRevealAfterEnd}
            isGuest={isGuest}
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
          <QuizAIGenerator
            isGuest={isGuest}
            userId={user?.id ?? null}
            questions={questions}
            setQuestions={setQuestions}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onSwitchToBank={() => setTab('bank')}
          />
        )}

        {tab === 'papers' && (
          <QuizPaperBank
            papers={papers} setPapers={setPapers}
            questions={questions} isGuest={isGuest}
          />
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
