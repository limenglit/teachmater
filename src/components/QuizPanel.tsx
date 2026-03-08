import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Play, StopCircle, QrCode, ArrowLeft, Download, CheckCircle2, XCircle, HelpCircle, ListChecks, ToggleLeft, FileText, Cloud, HardDrive } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import QuizStatsView from '@/components/quiz/QuizStatsView';
import QuizImporter from '@/components/quiz/QuizImporter';

export interface QuizQuestion {
  id: string;
  user_id: string;
  type: 'single' | 'multi' | 'tf' | 'short';
  content: string;
  options: string[];
  correct_answer: string | string[];
  tags: string;
  created_at: string;
}

export interface QuizSession {
  id: string;
  user_id: string | null;
  creator_token: string;
  title: string;
  questions: QuizQuestion[];
  status: string;
  student_names: string[];
  created_at: string;
  ended_at: string | null;
}

const SESSION_TOKENS_KEY = 'quiz-session-tokens';
const LOCAL_QUESTIONS_KEY = 'quiz-local-questions';
const LOCAL_SESSIONS_KEY = 'quiz-local-sessions';

function getSessionTokens(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SESSION_TOKENS_KEY) || '{}'); } catch { return {}; }
}
function saveSessionToken(sessionId: string, token: string) {
  const tokens = getSessionTokens();
  tokens[sessionId] = token;
  localStorage.setItem(SESSION_TOKENS_KEY, JSON.stringify(tokens));
}
function getSessionToken(sessionId: string): string | null {
  return getSessionTokens()[sessionId] || null;
}

// Local storage helpers for guest mode
function getLocalQuestions(): QuizQuestion[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_QUESTIONS_KEY) || '[]'); } catch { return []; }
}
function saveLocalQuestions(questions: QuizQuestion[]) {
  localStorage.setItem(LOCAL_QUESTIONS_KEY, JSON.stringify(questions));
}

type QuestionType = 'single' | 'multi' | 'tf' | 'short';

export default function QuizPanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isGuest = !user;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
  const [view, setView] = useState<'main' | 'add' | 'session'>('main');
  const [loading, setLoading] = useState(false);

  // New question form
  const [qType, setQType] = useState<QuestionType>('single');
  const [qContent, setQContent] = useState('');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState<string | string[]>('A');
  const [qTags, setQTags] = useState('');

  // Quick session
  const [sessionTitle, setSessionTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showQR, setShowQR] = useState(false);

  // Load data
  useEffect(() => {
    if (user) {
      loadQuestions();
      loadSessions();
    } else {
      // Guest: load from localStorage
      setQuestions(getLocalQuestions());
      setSessions([]);
    }
  }, [user]);

  const loadQuestions = async () => {
    if (!user) return;
    const { data } = await supabase.from('quiz_questions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }) as any;
    if (data) setQuestions(data);
  };

  const loadSessions = async () => {
    if (!user) return;
    const tokens = Object.values(getSessionTokens());
    let all: QuizSession[] = [];
    const { data } = await (supabase.from('quiz_sessions').select('*') as any).eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) all = data;
    if (tokens.length > 0) {
      const { data: d2 } = await supabase.from('quiz_sessions').select('*').in('creator_token', tokens).order('created_at', { ascending: false }) as any;
      if (d2) {
        for (const s of d2) {
          if (!all.find((a: any) => a.id === s.id)) all.push(s);
        }
      }
    }
    setSessions(all);
  };

  const saveQuestion = async () => {
    if (!qContent.trim()) return;
    const opts = qType === 'tf' ? ['正确', '错误'] : qType === 'short' ? [] : qOptions.filter(o => o.trim());
    if ((qType === 'single' || qType === 'multi') && opts.length < 2) {
      toast({ title: t('quiz.needOptions'), variant: 'destructive' });
      return;
    }

    if (isGuest) {
      // Save locally
      const newQ: QuizQuestion = {
        id: crypto.randomUUID(),
        user_id: 'local',
        type: qType,
        content: qContent.trim(),
        options: opts,
        correct_answer: qCorrect,
        tags: qTags.trim(),
        created_at: new Date().toISOString(),
      };
      const updated = [newQ, ...questions];
      setQuestions(updated);
      saveLocalQuestions(updated);
      toast({ title: t('quiz.saved') });
    } else {
      const { error } = await supabase.from('quiz_questions').insert({
        user_id: user.id,
        type: qType,
        content: qContent.trim(),
        options: opts,
        correct_answer: qCorrect,
        tags: qTags.trim(),
      } as any);
      if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
      toast({ title: t('quiz.saved') });
      loadQuestions();
    }

    setQContent('');
    setQOptions(['', '', '', '']);
    setQCorrect('A');
    setQTags('');
    setView('main');
  };

  const deleteQuestion = async (id: string) => {
    if (isGuest) {
      const updated = questions.filter(q => q.id !== id);
      setQuestions(updated);
      saveLocalQuestions(updated);
    } else {
      await supabase.from('quiz_questions').delete().eq('id', id) as any;
      setQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  const handleImport = async (imported: { type: 'single' | 'multi' | 'tf' | 'short'; content: string; options: string[]; correct_answer: string | string[]; tags: string }[]) => {
    if (isGuest) {
      const newQs = imported.map(q => ({
        id: crypto.randomUUID(),
        user_id: 'local',
        type: q.type,
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        tags: q.tags,
        created_at: new Date().toISOString(),
      }));
      const updated = [...newQs, ...questions];
      setQuestions(updated);
      saveLocalQuestions(updated);
    } else {
      const rows = imported.map(q => ({
        user_id: user!.id,
        type: q.type,
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        tags: q.tags,
      }));
      const { error } = await supabase.from('quiz_questions').insert(rows as any);
      if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
      loadQuestions();
    }
  };

    const selected = questions.filter(q => selectedIds.has(q.id));
    if (selected.length === 0) { toast({ title: t('quiz.selectQuestions'), variant: 'destructive' }); return; }

    if (isGuest) {
      toast({ title: t('quiz.loginToPublish'), variant: 'destructive' });
      return;
    }

    const title = sessionTitle.trim() || t('quiz.defaultTitle');
    const { data, error } = await supabase.from('quiz_sessions').insert({
      user_id: user.id,
      title,
      questions: selected as any,
    }).select().single() as any;
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    saveSessionToken(data.id, data.creator_token);
    setActiveSession(data);
    setView('session');
    setSelectedIds(new Set());
    setSessionTitle('');
    loadSessions();
  };

  const endSession = async () => {
    if (!activeSession) return;
    const token = getSessionToken(activeSession.id);
    if (!token) return;
    await supabase.rpc('update_quiz_session', { p_session_id: activeSession.id, p_token: token, p_status: 'ended' } as any);
    setActiveSession(prev => prev ? { ...prev, status: 'ended' } : null);
    loadSessions();
  };

  const deleteSession = async (s: QuizSession) => {
    const token = getSessionToken(s.id);
    if (!token) return;
    await supabase.rpc('delete_quiz_session', { p_session_id: s.id, p_token: token } as any);
    setSessions(prev => prev.filter(x => x.id !== s.id));
    if (activeSession?.id === s.id) { setActiveSession(null); setView('main'); }
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
      const cells = qs.map((_: any, i: number) => {
        const a = answers.find((x: any) => x.question_index === i);
        if (!a) return '';
        if (a.is_correct) correct++;
        return typeof a.answer === 'string' ? a.answer : JSON.stringify(a.answer);
      });
      return [name, ...cells, correct, qs.length];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-${activeSession.title}-${new Date().toLocaleDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === questions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(questions.map(q => q.id)));
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'single': return <CheckCircle2 className="w-3.5 h-3.5 text-primary" />;
      case 'multi': return <ListChecks className="w-3.5 h-3.5 text-accent-foreground" />;
      case 'tf': return <ToggleLeft className="w-3.5 h-3.5 text-green-600" />;
      case 'short': return <FileText className="w-3.5 h-3.5 text-orange-500" />;
      default: return <HelpCircle className="w-3.5 h-3.5" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'single': return t('quiz.single');
      case 'multi': return t('quiz.multi');
      case 'tf': return t('quiz.tf');
      case 'short': return t('quiz.short');
      default: return type;
    }
  };

  // Active session view
  if (view === 'session' && activeSession) {
    const submitUrl = `${window.location.origin}/quiz/${activeSession.id}`;
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => { setView('main'); setActiveSession(null); }} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> {t('board.back')}
          </Button>
          <h2 className="font-semibold text-foreground text-sm truncate">{activeSession.title}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeSession.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
            {activeSession.status === 'active' ? t('quiz.active') : t('quiz.ended')}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowQR(true)}>
              <QrCode className="w-3 h-3" /> {t('board.qrcode')}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportCSV}>
              <Download className="w-3 h-3" /> {t('quiz.exportCSV')}
            </Button>
            {activeSession.status === 'active' && (
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={endSession}>
                <StopCircle className="w-3 h-3" /> {t('quiz.endSession')}
              </Button>
            )}
          </div>
        </div>

        <QuizStatsView session={activeSession} />

        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t('quiz.scanToAnswer')}</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-background p-4 rounded-xl border border-border">
                <QRCodeSVG value={submitUrl} size={200} level="M" />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all">{submitUrl}</p>
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(submitUrl);
                toast({ title: t('board.shareLink') });
              }}>{t('board.shareLink')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Add question form
  if (view === 'add') {
    return (
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Button variant="ghost" size="sm" onClick={() => setView('main')} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> {t('board.back')}
            </Button>
            <h3 className="font-semibold text-foreground text-lg">{t('quiz.addQuestion')}</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{t('quiz.questionType')}</label>
              <Select value={qType} onValueChange={v => {
                setQType(v as QuestionType);
                if (v === 'tf') setQCorrect('A');
                else if (v === 'multi') setQCorrect([]);
                else setQCorrect('A');
              }}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{t('quiz.single')}</SelectItem>
                  <SelectItem value="multi">{t('quiz.multi')}</SelectItem>
                  <SelectItem value="tf">{t('quiz.tf')}</SelectItem>
                  <SelectItem value="short">{t('quiz.short')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{t('quiz.questionContent')}</label>
              <Textarea value={qContent} onChange={e => setQContent(e.target.value)} placeholder={t('quiz.questionPlaceholder')} rows={3} />
            </div>

            {(qType === 'single' || qType === 'multi') && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t('quiz.options')}</label>
                <div className="space-y-2">
                  {qOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground w-5">{String.fromCharCode(65 + i)}</span>
                      <Input
                        value={opt}
                        onChange={e => { const next = [...qOptions]; next[i] = e.target.value; setQOptions(next); }}
                        placeholder={`${t('quiz.option')} ${String.fromCharCode(65 + i)}`}
                        className="flex-1"
                      />
                      {i >= 2 && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setQOptions(qOptions.filter((_, j) => j !== i))}>
                          <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {qOptions.length < 6 && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setQOptions([...qOptions, ''])}>
                      <Plus className="w-3 h-3 mr-1" /> {t('quiz.addOption')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{t('quiz.correctAnswer')}</label>
              {qType === 'single' && (
                <div className="flex gap-2">
                  {qOptions.map((_, i) => {
                    const letter = String.fromCharCode(65 + i);
                    return (
                      <Button key={i} variant={qCorrect === letter ? 'default' : 'outline'} size="sm"
                        onClick={() => setQCorrect(letter)}>
                        {letter}
                      </Button>
                    );
                  })}
                </div>
              )}
              {qType === 'multi' && (
                <div className="flex gap-2">
                  {qOptions.map((_, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const selected = Array.isArray(qCorrect) && qCorrect.includes(letter);
                    return (
                      <Button key={i} variant={selected ? 'default' : 'outline'} size="sm"
                        onClick={() => {
                          const arr = Array.isArray(qCorrect) ? [...qCorrect] : [];
                          if (selected) setQCorrect(arr.filter(x => x !== letter));
                          else setQCorrect([...arr, letter].sort());
                        }}>
                        {letter}
                      </Button>
                    );
                  })}
                </div>
              )}
              {qType === 'tf' && (
                <div className="flex gap-2">
                  <Button variant={qCorrect === 'A' ? 'default' : 'outline'} size="sm" onClick={() => setQCorrect('A')}>
                    ✅ {t('quiz.true')}
                  </Button>
                  <Button variant={qCorrect === 'B' ? 'default' : 'outline'} size="sm" onClick={() => setQCorrect('B')}>
                    ❌ {t('quiz.false')}
                  </Button>
                </div>
              )}
              {qType === 'short' && (
                <Input value={typeof qCorrect === 'string' ? qCorrect : ''} onChange={e => setQCorrect(e.target.value)}
                  placeholder={t('quiz.referenceAnswer')} />
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{t('quiz.tags')}</label>
              <Input value={qTags} onChange={e => setQTags(e.target.value)} placeholder={t('quiz.tagsPlaceholder')} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={saveQuestion} className="gap-1"><Plus className="w-4 h-4" /> {t('quiz.save')}</Button>
              <Button variant="outline" onClick={() => setView('main')}>{t('quiz.cancel')}</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main view: question bank + sessions
  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2 text-lg">
          📝 {t('quiz.title')}
          {isGuest && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              <HardDrive className="w-3 h-3" /> {t('quiz.localMode')}
            </span>
          )}
          {!isGuest && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Cloud className="w-3 h-3" /> {t('quiz.cloudMode')}
            </span>
          )}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Question Bank */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground">{t('quiz.questionBank')} ({questions.length})</h4>
              <div className="flex gap-2">
                {questions.length > 0 && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={selectAll}>
                    {selectedIds.size === questions.length ? t('quiz.deselectAll') : t('quiz.selectAll')}
                  </Button>
                )}
                <Button size="sm" onClick={() => setView('add')} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> {t('quiz.addQuestion')}
                </Button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/5 flex items-center justify-center">
                  <HelpCircle className="w-10 h-10 text-primary/30" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">{t('quiz.noQuestions')}</p>
                <p className="text-xs text-muted-foreground mb-4">{t('quiz.noQuestionsHint')}</p>
                <Button size="sm" onClick={() => setView('add')} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> {t('quiz.addQuestion')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <div key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${selectedIds.has(q.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                    onClick={() => toggleSelect(q.id)}
                  >
                    <Checkbox checked={selectedIds.has(q.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {typeIcon(q.type)}
                        <span className="text-[10px] text-muted-foreground">{typeLabel(q.type)}</span>
                        {q.tags && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{q.tags}</span>}
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{q.content}</p>
                      {q.options.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {q.options.map((o: string, i: number) => {
                            const letter = String.fromCharCode(65 + i);
                            const isCorrect = Array.isArray(q.correct_answer)
                              ? q.correct_answer.includes(letter)
                              : q.correct_answer === letter;
                            return (
                              <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded ${isCorrect ? 'bg-green-100 text-green-700 font-medium' : 'bg-muted text-muted-foreground'}`}>
                                {letter}. {o}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={e => { e.stopPropagation(); deleteQuestion(q.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Start session from selected */}
            {selectedIds.size > 0 && (
              <div className="sticky bottom-0 bg-card border border-border rounded-xl p-4 shadow-lg flex items-center gap-3">
                <span className="text-sm text-foreground font-medium">{t('quiz.selected')}: {selectedIds.size}</span>
                <Input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)}
                  placeholder={t('quiz.sessionTitle')} className="flex-1 h-9" />
                <Button onClick={startSession} disabled={isGuest} className="gap-1 shrink-0"
                  title={isGuest ? t('quiz.loginToPublish') : ''}>
                  <Play className="w-4 h-4" /> {t('quiz.startSession')}
                </Button>
                {isGuest && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('quiz.loginToPublish')}</span>
                )}
              </div>
            )}
          </div>

          {/* Sessions sidebar */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">{t('quiz.recentSessions')}</h4>
            {isGuest ? (
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="w-8 h-8 mx-auto mb-2 text-primary/30" />
                <p className="text-xs mb-1">{t('quiz.loginForSessions')}</p>
                <p className="text-[10px] text-muted-foreground">{t('quiz.localModeHint')}</p>
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t('quiz.noSessions')}</p>
            ) : (
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id}
                    className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => { setActiveSession(s); setView('session'); }}
                  >
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
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                        onClick={e => { e.stopPropagation(); deleteSession(s); }}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
