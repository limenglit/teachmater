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
  Square,
  Trash2,
} from 'lucide-react';

import ClassRosterPicker from '@/components/ClassRosterPicker';
import RosterQuickBind from '@/components/RosterQuickBind';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
      linkedNames: Array.isArray(raw.linkedNames) ? raw.linkedNames : [],
      tasks: Array.isArray(raw.tasks)
        ? raw.tasks
            .filter((item): item is TaskDraftItem => !!item && typeof item.id === 'string' && typeof item.text === 'string')
            .map((item) => ({ id: item.id, text: item.text }))
        : [],
    };
  } catch {
    return { title: '', linkedNames: [], tasks: [] };
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

function parseTaskSession(row: any): TaskSessionRecord {
  return {
    id: row.id,
    title: row.title,
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
    student_names: Array.isArray(row.student_names) ? row.student_names : [],
    status: row.status,
    creator_token: row.creator_token,
    created_at: row.created_at,
    user_id: row.user_id,
  };
}

function uniqNames(names: string[]) {
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
}

export default function TaskChecklist() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students } = useStudents();
  const draft = useMemo(() => loadDraft(), []);

  const [title, setTitle] = useState(draft.title);
  const [linkedNames, setLinkedNames] = useState<string[]>(draft.linkedNames);
  const [tasks, setTasks] = useState<TaskDraftItem[]>(draft.tasks);
  const [newTask, setNewTask] = useState('');
  const [sessions, setSessions] = useState<TaskSessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<TaskSessionRecord | null>(null);
  const [completions, setCompletions] = useState<TaskCompletionRecord[]>([]);
  const [showRoster, setShowRoster] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveDraft({ title, linkedNames, tasks });
  }, [title, linkedNames, tasks]);

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

  const detailSubmitUrl = activeSession ? `${window.location.origin}/task/${activeSession.id}` : '';
  const isCreator = activeSession ? Boolean(getCreatorToken(activeSession.id)) : false;

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
      <div ref={detailRef} className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-wrap relative">
          <Button variant="ghost" size="sm" onClick={() => setActiveSession(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> {t('board.back')}
          </Button>
          <h2 className="font-semibold text-foreground text-sm sm:text-base truncate">{activeSession.title}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeSession.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
            {activeSession.status === 'active' ? t('task.active') : t('task.ended')}
          </span>
          <span className="text-xs text-muted-foreground">{tFormat(t('task.rosterCount'), detailStats.roster.length)}</span>
          <span className="text-xs text-muted-foreground">{tFormat(t('task.taskTotal'), activeSession.tasks.length)}</span>

          <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
            {isCreator && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={toggleSessionStatus}>
                {activeSession.status === 'active' ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {activeSession.status === 'active' ? t('task.saveAndEnd') : t('task.reopenSession')}
              </Button>
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
        onUseSidebar={() => setLinkedNames(students.map((student) => student.name))}
      />

      <div className="space-y-4">
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
          {loading && <span className="text-xs text-muted-foreground">{t('checkinPage.loading')}</span>}
        </div>

        <div className="space-y-2">
          {!loading && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('task.noSessions')}</p>
          )}

          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => openSession(session)}
              className="w-full text-left rounded-xl border border-border p-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${session.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                  {session.status === 'active' ? t('task.active') : t('task.ended')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tFormat(t('task.historyMeta'), session.student_names.length, session.tasks.length)} · {new Date(session.created_at).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      </div>

      <ClassRosterPicker
        open={showRoster}
        onOpenChange={setShowRoster}
        onSelect={(names) => {
          setLinkedNames(uniqNames(names));
          toast({ title: t('board.classLinked'), description: tFormat(t('board.studentCount'), uniqNames(names).length) });
        }}
        currentCount={linkedNames.length}
        onClear={() => setLinkedNames([])}
      />
    </div>
  );
}
