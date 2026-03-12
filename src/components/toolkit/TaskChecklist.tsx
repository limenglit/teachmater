import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Copy,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
} from 'lucide-react';

import ClassRosterPicker from '@/components/ClassRosterPicker';
import RosterQuickBind from '@/components/RosterQuickBind';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';
import { useStudents } from '@/contexts/StudentContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TaskDraftItem {
  id: string;
  text: string;
}

interface TaskSessionRecord {
  id: string;
  title: string;
  tasks: string[];
  student_names: string[];
  class_name: string;
  status: string;
  creator_token: string;
  created_at: string;
  user_id: string | null;
}

interface TaskCompletionRecord {
  id: string;
  session_id: string;
  student_name: string;
  task_index: number;
  completed_at: string;
}

interface StoredDraft {
  title: string;
  className: string;
  linkedNames: string[];
  tasks: TaskDraftItem[];
}

const DRAFT_KEY = 'task-checklist-draft-v2';
const TOKEN_KEY = 'task-session-creator-tokens';

function loadDraft(): StoredDraft {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') as Partial<StoredDraft>;
    return {
      title: raw.title || '',
      className: raw.className || '',
      linkedNames: Array.isArray(raw.linkedNames) ? raw.linkedNames : [],
      tasks: Array.isArray(raw.tasks)
        ? raw.tasks
            .filter((item): item is TaskDraftItem => !!item && typeof item.id === 'string' && typeof item.text === 'string')
            .map((item) => ({ id: item.id, text: item.text }))
        : [],
    };
  } catch {
    return { title: '', className: '', linkedNames: [], tasks: [] };
  }
}

function saveDraft(draft: StoredDraft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function getCreatorTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCreatorToken(sessionId: string, token: string) {
  const next = getCreatorTokens();
  next[sessionId] = token;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
}

function getCreatorToken(sessionId: string): string | null {
  return getCreatorTokens()[sessionId] || null;
}

function getSessionManageToken(session: Pick<TaskSessionRecord, 'id' | 'creator_token'>): string | null {
  const localToken = getCreatorToken(session.id);
  if (localToken) return localToken;

  const rowToken = session.creator_token?.trim();
  if (rowToken) return rowToken;

  return null;
}

function parseTaskSession(row: any): TaskSessionRecord {
  return {
    id: row.id,
    title: row.title,
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
    student_names: Array.isArray(row.student_names) ? row.student_names : [],
    class_name: typeof row.class_name === 'string' ? row.class_name : '',
    status: row.status,
    creator_token: row.creator_token,
    created_at: row.created_at,
    user_id: row.user_id,
  };
}

function uniqNames(names: string[]) {
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
}

function getSessionClassLabel(session: Pick<TaskSessionRecord, 'class_name'>, fallback: string) {
  return session.class_name.trim() || fallback;
}

export default function TaskChecklist() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students } = useStudents();
  const draft = useMemo(() => loadDraft(), []);

  const [title, setTitle] = useState(draft.title);
  const [className, setClassName] = useState(draft.className);
  const [linkedNames, setLinkedNames] = useState<string[]>(draft.linkedNames);
  const [tasks, setTasks] = useState<TaskDraftItem[]>(draft.tasks);
  const [newTask, setNewTask] = useState('');
  const [sessions, setSessions] = useState<TaskSessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<TaskSessionRecord | null>(null);
  const [completions, setCompletions] = useState<TaskCompletionRecord[]>([]);
  const [showRoster, setShowRoster] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyClassFilter, setHistoryClassFilter] = useState('__all__');
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveDraft({ title, className, linkedNames, tasks });
  }, [title, className, linkedNames, tasks]);

  useEffect(() => {
    loadSessions();
  }, [user?.id]);

  useEffect(() => {
    if (!activeSession) return;

    const channel = supabase
      .channel(`task-completions-${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_completions',
          filter: `session_id=eq.${activeSession.id}`,
        },
        (payload) => {
          const next = payload.new as TaskCompletionRecord;
          setCompletions((prev) => {
            if (prev.some((item) => item.id === next.id)) {
              return prev;
            }
            return [...prev, next];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const tokens = Object.values(getCreatorTokens());
      let merged: TaskSessionRecord[] = [];

      if (user) {
        const { data, error } = await supabase
          .from('task_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        merged = (data || []).map(parseTaskSession);
      }

      if (tokens.length > 0) {
        const { data, error } = await supabase
          .from('task_sessions')
          .select('*')
          .in('creator_token', tokens)
          .order('created_at', { ascending: false });
        if (error) throw error;

        for (const row of data || []) {
          const session = parseTaskSession(row);
          if (!merged.some((item) => item.id === session.id)) {
            merged.push(session);
          }
        }
      }

      for (const session of merged) {
        const rowToken = session.creator_token?.trim();
        if (rowToken) {
          saveCreatorToken(session.id, rowToken);
        }
      }

      merged.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
      setSessions(merged);
    } catch (error: any) {
      toast({ title: error.message || t('task.loadFailed'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openSession = async (session: TaskSessionRecord) => {
    setActiveSession(session);
    try {
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('session_id', session.id)
        .order('completed_at', { ascending: true });
      if (error) throw error;
      setCompletions((data || []) as TaskCompletionRecord[]);
    } catch (error: any) {
      setCompletions([]);
      toast({ title: error.message || t('task.loadFailed'), variant: 'destructive' });
    }
  };

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), text }]);
    setNewTask('');
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const clearDraft = () => {
    setTitle('');
    setClassName('');
    setTasks([]);
    setNewTask('');
    setLinkedNames([]);
  };

  const publishSession = async () => {
    const trimmedTitle = title.trim();
    const taskList = tasks.map((task) => task.text.trim()).filter(Boolean);
    const roster = linkedNames.length > 0 ? uniqNames(linkedNames) : uniqNames(students.map((student) => student.name));

    if (!trimmedTitle) {
      toast({ title: t('task.needTitle'), variant: 'destructive' });
      return;
    }

    if (taskList.length === 0) {
      toast({ title: t('task.needTasks'), variant: 'destructive' });
      return;
    }

    if (roster.length === 0) {
      toast({ title: t('board.requireRosterFirst'), variant: 'destructive' });
      return;
    }

    setPublishing(true);
    try {
      const insertData: Record<string, any> = {
        title: trimmedTitle,
        tasks: taskList,
        student_names: roster,
        class_name: className.trim(),
      };
      if (user) insertData.user_id = user.id;

      const { data, error } = await supabase.from('task_sessions').insert(insertData).select('*').single();
      if (error) throw error;

      const session = parseTaskSession(data);
      saveCreatorToken(session.id, session.creator_token);
      setSessions((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
      setLinkedNames(roster);
      clearDraft();
      await openSession(session);
      toast({
        title: t('task.publishSuccess'),
        description: tFormat(t('task.publishSuccessDesc'), roster.length, taskList.length),
      });
    } catch (error: any) {
      toast({ title: error.message || t('task.publishFailed'), variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const toggleSessionStatus = async () => {
    if (!activeSession) return;
    const token = getCreatorToken(activeSession.id);
    if (!token) return;

    const nextStatus = activeSession.status === 'active' ? 'ended' : 'active';

    try {
      const { error } = await supabase.rpc('update_task_session', {
        p_session_id: activeSession.id,
        p_token: token,
        p_status: nextStatus,
      });
      if (error) throw error;

      const updated = { ...activeSession, status: nextStatus };
      setActiveSession(updated);
      setSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast({ title: nextStatus === 'ended' ? t('task.savedEnded') : t('task.reopened') });
    } catch (error: any) {
      toast({ title: error.message || t('task.updateFailed'), variant: 'destructive' });
    }
  };

  const confirmDeleteSession = async () => {
    if (!deleteSessionId) return;
    const targetSession = sessions.find((session) => session.id === deleteSessionId)
      || (activeSession?.id === deleteSessionId ? activeSession : null);
    const token = targetSession ? getSessionManageToken(targetSession) : getCreatorToken(deleteSessionId);
    if (!token) {
      toast({ title: t('task.actionDenied'), variant: 'destructive' });
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_task_session', {
        p_session_id: deleteSessionId,
        p_token: token,
      });
      if (error) throw error;

      setSessions((prev) => prev.filter((session) => session.id !== deleteSessionId));
      setActiveSession((prev) => (prev?.id === deleteSessionId ? null : prev));
      setDeleteSessionId(null);
      toast({ title: t('task.deleteSuccess') });
    } catch (error: any) {
      toast({ title: error.message || t('task.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const detailSubmitUrl = activeSession ? `${window.location.origin}/task/${activeSession.id}` : '';
  const isCreator = activeSession ? Boolean(getSessionManageToken(activeSession)) : false;
  const uncategorizedLabel = t('task.uncategorized');

  const historyClassOptions = useMemo(() => {
    const names = Array.from(new Set(sessions.map((session) => session.class_name.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
    return names;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    return sessions.filter((session) => {
      const matchesClass = historyClassFilter === '__all__'
        ? true
        : historyClassFilter === '__uncategorized__'
          ? !session.class_name.trim()
          : session.class_name === historyClassFilter;
      if (!matchesClass) return false;
      if (!query) return true;

      const haystacks = [
        session.title,
        session.class_name,
        ...session.tasks,
        ...session.student_names,
      ];
      return haystacks.some((value) => value.toLowerCase().includes(query));
    });
  }, [historyClassFilter, historyQuery, sessions]);

  const recentSessions = useMemo(() => sessions.slice(0, 3), [sessions]);

  const dedupedCompletions = useMemo(() => {
    const unique = new Map<string, TaskCompletionRecord>();
    for (const row of completions) {
      const key = `${row.student_name}::${row.task_index}`;
      if (!unique.has(key)) {
        unique.set(key, row);
      }
    }
    return Array.from(unique.values());
  }, [completions]);

  const detailStats = useMemo(() => {
    if (!activeSession) {
      return {
        roster: [] as string[],
        completedStudents: [] as string[],
        pendingStudents: [] as string[],
        studentProgress: [] as Array<{ name: string; completedCount: number; doneAll: boolean; doneTaskIndexes: number[] }>,
        taskStats: [] as Array<{ task: string; count: number; completedStudents: string[] }>,
        overallProgress: 0,
      };
    }

    const roster = uniqNames(activeSession.student_names);
    const doneMap = new Map<string, Set<number>>();

    for (const row of dedupedCompletions) {
      if (!doneMap.has(row.student_name)) {
        doneMap.set(row.student_name, new Set<number>());
      }
      doneMap.get(row.student_name)?.add(row.task_index);
    }

    const studentProgress = roster.map((name) => {
      const doneTaskIndexes = Array.from(doneMap.get(name) || []).sort((left, right) => left - right);
      const completedCount = doneTaskIndexes.length;
      return {
        name,
        completedCount,
        doneAll: activeSession.tasks.length > 0 && completedCount >= activeSession.tasks.length,
        doneTaskIndexes,
      };
    });

    const completedStudents = studentProgress.filter((item) => item.doneAll).map((item) => item.name);
    const pendingStudents = studentProgress.filter((item) => !item.doneAll).map((item) => item.name);
    const taskStats = activeSession.tasks.map((task, index) => ({
      task,
      count: studentProgress.filter((item) => item.doneTaskIndexes.includes(index)).length,
      completedStudents: studentProgress.filter((item) => item.doneTaskIndexes.includes(index)).map((item) => item.name),
    }));
    const overallProgress = roster.length > 0 ? Math.round((completedStudents.length / roster.length) * 100) : 0;

    return { roster, completedStudents, pendingStudents, studentProgress, taskStats, overallProgress };
  }, [activeSession, dedupedCompletions]);

  if (activeSession) {
    return (
      <>
        <div ref={detailRef} className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-wrap relative">
          <Button variant="ghost" size="sm" onClick={() => setActiveSession(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> {t('board.back')}
          </Button>
          <h2 className="font-semibold text-foreground text-sm sm:text-base truncate">{activeSession.title}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {getSessionClassLabel(activeSession, uncategorizedLabel)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeSession.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
            {activeSession.status === 'active' ? t('task.active') : t('task.ended')}
          </span>
          <span className="text-xs text-muted-foreground">{tFormat(t('task.rosterCount'), detailStats.roster.length)}</span>
          <span className="text-xs text-muted-foreground">{tFormat(t('task.taskTotal'), activeSession.tasks.length)}</span>

          <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
            {isCreator && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={toggleSessionStatus}>
                  {activeSession.status === 'active' ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {activeSession.status === 'active' ? t('task.saveAndEnd') : t('task.reopenSession')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive" onClick={() => setDeleteSessionId(activeSession.id)}>
                  <Trash2 className="w-3 h-3" />
                  {t('task.delete')}
                </Button>
              </>
            )}
          </div>

          </div>

          <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:min-h-0">
              <div className="space-y-4 min-w-0">
                <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-foreground">{t('task.scanToReport')}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      navigator.clipboard.writeText(detailSubmitUrl);
                      toast({ title: t('common.copied') });
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex justify-center mb-3">
                  <QRCodeSVG value={detailSubmitUrl} size={180} level="M" />
                </div>
                <p className="text-xs text-muted-foreground break-all">{detailSubmitUrl}</p>
              </div>

                <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t('task.classCompletion')}</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-bold text-foreground">{detailStats.overallProgress}%</p>
                      <p className="text-xs text-muted-foreground">{detailStats.completedStudents.length}/{detailStats.roster.length}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{tFormat(t('task.completedCount'), detailStats.completedStudents.length)}</p>
                      <p>{tFormat(t('task.pendingCount'), detailStats.pendingStudents.length)}</p>
                    </div>
                  </div>
                  <Progress value={detailStats.overallProgress} className="h-2 mt-3" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                    <p className="text-xs text-muted-foreground mb-1">{t('task.completedStudents')}</p>
                    <p className="text-lg font-semibold text-foreground">{detailStats.completedStudents.length}</p>
                  </div>
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
                    <p className="text-xs text-muted-foreground mb-1">{t('task.pendingStudents')}</p>
                    <p className="text-lg font-semibold text-foreground">{detailStats.pendingStudents.length}</p>
                  </div>
                </div>
                </div>
              </div>

              <div className="space-y-4 min-w-0">
                <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
                <h3 className="text-sm font-semibold text-foreground mb-3">{t('task.byTask')}</h3>
                <div className="space-y-3">
                  {detailStats.taskStats.map((item, index) => {
                    const pct = detailStats.roster.length > 0 ? Math.round((item.count / detailStats.roster.length) * 100) : 0;
                    return (
                      <div key={`${item.task}-${index}`} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground break-words">{index + 1}. {item.task}</p>
                            <p className="text-xs text-muted-foreground">{item.count}/{detailStats.roster.length}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2 mb-2" />
                        <div className="flex flex-wrap gap-1.5">
                          {item.completedStudents.length > 0 ? item.completedStudents.map((name) => (
                            <span key={`${item.task}-${name}`} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                              {name}
                            </span>
                          )) : (
                            <p className="text-xs text-muted-foreground">{t('task.noReportsYet')}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <details className="bg-card border border-border rounded-2xl p-4 shadow-card">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{t('task.completedStudents')}</h3>
                  <span className="text-xs text-muted-foreground">{detailStats.completedStudents.length}</span>
                </summary>
                <div className="flex flex-wrap gap-2 mt-3">
                  {detailStats.completedStudents.length > 0 ? detailStats.completedStudents.map((name) => (
                    <span key={name} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm">
                      {name}
                    </span>
                  )) : (
                    <p className="text-sm text-muted-foreground">{t('task.noneCompletedYet')}</p>
                  )}
                </div>
              </details>

              <details className="bg-card border border-border rounded-2xl p-4 shadow-card">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{t('task.pendingStudents')}</h3>
                  <span className="text-xs text-muted-foreground">{detailStats.pendingStudents.length}</span>
                </summary>
                <div className="flex flex-wrap gap-2 mt-3">
                  {detailStats.pendingStudents.length > 0 ? detailStats.pendingStudents.map((name) => (
                    <span key={name} className="px-2.5 py-1 rounded-full bg-muted text-foreground text-sm">
                      {name}
                    </span>
                  )) : (
                    <p className="text-sm text-muted-foreground">{t('task.everyoneCompleted')}</p>
                  )}
                </div>
              </details>

              <details className="bg-card border border-border rounded-2xl p-4 shadow-card">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{t('task.byStudent')}</h3>
                  <span className="text-xs text-muted-foreground">{detailStats.studentProgress.length}</span>
                </summary>
                <div className="space-y-3 mt-3">
                  {detailStats.studentProgress.map((student) => {
                    const studentProgress = activeSession.tasks.length > 0
                      ? Math.round((student.completedCount / activeSession.tasks.length) * 100)
                      : 0;
                    return (
                      <div key={student.name} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.completedCount}/{activeSession.tasks.length}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${student.doneAll ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {student.doneAll ? t('task.completed') : t('task.inProgress')}
                          </span>
                        </div>
                        <Progress value={studentProgress} className="h-2 mb-2" />
                        <div className="flex flex-wrap gap-1.5">
                          {activeSession.tasks.map((task, index) => {
                            const done = student.doneTaskIndexes.includes(index);
                            return (
                              <span
                                key={`${student.name}-${index}`}
                                className={`text-xs px-2 py-1 rounded-full border ${done ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-background border-border text-muted-foreground'}`}
                              >
                                {index + 1}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </details>
              </div>
            </div>
          </div>
        </div>

        <AlertDialog open={Boolean(deleteSessionId)} onOpenChange={(open) => { if (!open) setDeleteSessionId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('task.deleteDialogTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('task.deleteDialogDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting}>
                {deleting ? t('common.deleting') : t('task.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          {t('task.title')}
        </h3>
        <Button variant="ghost" size="sm" className="gap-1" onClick={clearDraft}>
          <RotateCcw className="w-3.5 h-3.5" /> {t('task.reset')}
        </Button>
      </div>

      <RosterQuickBind
        className="mb-4 space-y-2"
        linkedCount={linkedNames.length}
        sidebarCount={students.length}
        onOpenRoster={() => setShowRoster(true)}
        onUseSidebar={() => {
          setLinkedNames(students.map((student) => student.name));
          setClassName('');
        }}
      />

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('task.archiveClass')}</p>
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {className.trim() || t('task.archiveUncategorized')}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('task.sessionTitle')}</p>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('task.titlePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('task.tasksLabel')}</p>
          <div className="flex gap-2">
            <Input
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              placeholder={t('task.addPlaceholder')}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTask();
                }
              }}
            />
            <Button size="sm" onClick={addTask} disabled={!newTask.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 max-h-[min(45vh,24rem)] overflow-y-auto pr-1">
          {tasks.map((task, index) => (
            <div key={task.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
              <span className="text-xs text-muted-foreground w-5">{index + 1}</span>
              <span className="flex-1 text-sm text-foreground break-words">{task.text}</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeTask(task.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-center py-6 text-muted-foreground text-sm">{t('task.empty')}</p>
          )}
        </div>

        <Button className="w-full gap-2" onClick={publishSession} disabled={publishing || !title.trim() || tasks.length === 0}>
          <Play className="w-4 h-4" />
          {publishing ? t('task.publishing') : t('task.publish')}
        </Button>
      </div>

      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-semibold text-foreground">{t('task.recentSessions')}</h4>
          <div className="flex items-center gap-2">
            {loading && <span className="text-xs text-muted-foreground">{t('checkinPage.loading')}</span>}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowHistory(true)}>
              {t('task.viewAllHistory')}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {!loading && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('task.noSessions')}</p>
          )}

          {recentSessions.map((session) => {
            const canManage = Boolean(getSessionManageToken(session));
            return (
              <div key={session.id} className="rounded-xl border border-border p-3">
                <button
                  onClick={() => openSession(session)}
                  className="w-full text-left hover:bg-accent/50 transition-colors rounded-lg"
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {getSessionClassLabel(session, uncategorizedLabel)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${session.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {session.status === 'active' ? t('task.active') : t('task.ended')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tFormat(t('task.historyMeta'), session.student_names.length, session.tasks.length)} · {new Date(session.created_at).toLocaleString()}
                  </p>
                </button>
                {canManage && (
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs text-destructive" onClick={() => setDeleteSessionId(session.id)}>
                      <Trash2 className="w-3 h-3" />
                      {t('task.delete')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {!loading && sessions.length > 3 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              {tFormat(t('task.moreHistoryHint'), sessions.length - 3)}
            </p>
          )}
        </div>
      </div>

      <ClassRosterPicker
        open={showRoster}
        onOpenChange={setShowRoster}
        onSelect={(names, meta) => {
          setLinkedNames(uniqNames(names));
          setClassName(meta?.className || '');
          toast({ title: t('board.classLinked'), description: tFormat(t('board.studentCount'), uniqNames(names).length) });
        }}
        currentCount={linkedNames.length}
        onClear={() => {
          setLinkedNames([]);
          setClassName('');
        }}
      />

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('task.historyTitle')}</DialogTitle>
            <DialogDescription>{t('task.historyDesc')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder={t('task.searchPlaceholder')}
                className="pl-9"
              />
            </div>

            <Select value={historyClassFilter} onValueChange={setHistoryClassFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('task.filterByClass')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('task.allClasses')}</SelectItem>
                <SelectItem value="__uncategorized__">{uncategorizedLabel}</SelectItem>
                {historyClassOptions.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-h-0 overflow-y-auto pr-1 space-y-3">
            {filteredSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">{t('task.noSearchResults')}</p>
            ) : filteredSessions.map((session) => {
              const canManage = Boolean(getSessionManageToken(session));
              return (
                <div key={session.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => { void openSession(session); setShowHistory(false); }} className="flex-1 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{session.title}</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {getSessionClassLabel(session, uncategorizedLabel)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${session.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {session.status === 'active' ? t('task.active') : t('task.ended')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {tFormat(t('task.historyMeta'), session.student_names.length, session.tasks.length)} · {new Date(session.created_at).toLocaleString()}
                      </p>
                    </button>

                    {canManage && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="h-8 text-xs text-destructive" onClick={() => setDeleteSessionId(session.id)}>
                          <Trash2 className="w-3 h-3" />
                          {t('task.delete')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistory(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteSessionId)} onOpenChange={(open) => { if (!open) setDeleteSessionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('task.deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('task.deleteDialogDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting}>
              {deleting ? t('common.deleting') : t('task.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
