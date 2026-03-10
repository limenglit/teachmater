import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/contexts/StudentContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ClipboardList, Plus, Trash2, Maximize2, Minimize2, Users, QrCode, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import ClassRosterPicker from '@/components/ClassRosterPicker';

interface TaskSession {
  id: string;
  title: string;
  tasks: string[];
  student_names: string[];
  creator_token: string;
  status: string;
}

interface TaskCompletion {
  student_name: string;
  task_index: number;
}

export default function TaskChecklist() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students: sidebarStudents } = useStudents();

  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [studentNames, setStudentNames] = useState<string[]>([]);
  const [rosterOpen, setRosterOpen] = useState(false);

  // Published session
  const [session, setSession] = useState<TaskSession | null>(null);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [fullscreen, setFullscreen] = useState(false);

  const sessionUrl = session ? `${window.location.origin}/task/${session.id}` : '';

  // Load completions realtime
  useEffect(() => {
    if (!session) return;
    const loadCompletions = async () => {
      const { data } = await supabase
        .from('task_completions')
        .select('student_name, task_index')
        .eq('session_id', session.id);
      if (data) setCompletions(data);
    };
    loadCompletions();

    const channel = supabase
      .channel(`task-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'task_completions',
        filter: `session_id=eq.${session.id}`,
      }, (payload) => {
        const rec = payload.new as { student_name: string; task_index: number };
        setCompletions(prev => [...prev, { student_name: rec.student_name, task_index: rec.task_index }]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id]);

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setTasks(prev => [...prev, text]);
    setNewTask('');
  };

  const removeTask = (idx: number) => {
    setTasks(prev => prev.filter((_, i) => i !== idx));
  };

  const publishSession = async () => {
    if (tasks.length === 0) return;
    const names = studentNames.length > 0 ? studentNames : sidebarStudents.map(s => s.name);
    const { data, error } = await supabase
      .from('task_sessions')
      .insert({
        title: sessionTitle || t('task.title'),
        tasks: JSON.stringify(tasks),
        student_names: JSON.stringify(names),
        user_id: user?.id || null,
      } as any)
      .select()
      .single();
    if (error || !data) return;
    setSession({
      id: (data as any).id,
      title: (data as any).title,
      tasks,
      student_names: names,
      creator_token: (data as any).creator_token,
      status: 'active',
    });
  };

  const endSession = async () => {
    if (!session) return;
    await supabase.rpc('update_task_session', {
      p_session_id: session.id,
      p_token: session.creator_token,
      p_status: 'ended',
    });
    setSession(null);
    setCompletions([]);
    setTasks([]);
    setSessionTitle('');
    setStudentNames([]);
  };

  const getTaskCompletionCount = (taskIdx: number) => {
    return new Set(completions.filter(c => c.task_index === taskIdx).map(c => c.student_name)).size;
  };

  const totalStudents = session?.student_names?.length || 0;

  // Select roster callback
  const onSelectRoster = useCallback((names: string[]) => {
    setStudentNames(names);
  }, []);

  // --- EDITING MODE (no session published) ---
  if (!session) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          {t('task.title')}
        </h3>

        <Input
          value={sessionTitle}
          onChange={e => setSessionTitle(e.target.value)}
          placeholder={t('task.sessionTitle')}
          className="mb-2"
        />

        {/* Roster selector */}
        <button
          onClick={() => setRosterOpen(true)}
          className="w-full text-left p-2 mb-2 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-2"
        >
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm text-foreground">
            {studentNames.length > 0
              ? `${t('task.classLinked')} (${studentNames.length}${t('rollcall.people')})`
              : t('task.selectClass')}
          </span>
        </button>

        <ClassRosterPicker
          open={rosterOpen}
          onOpenChange={setRosterOpen}
          onSelect={onSelectRoster}
          currentCount={studentNames.length}
          onClear={() => setStudentNames([])}
        />

        {/* Task input */}
        <div className="flex gap-2 mb-3">
          <Input
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            placeholder={t('task.addPlaceholder')}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
          />
          <Button size="sm" onClick={addTask} disabled={!newTask.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Task list */}
        <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
          <AnimatePresence>
            {tasks.map((task, idx) => (
              <motion.div
                key={`${task}-${idx}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 group"
              >
                <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                <span className="flex-1 text-sm text-foreground">{task}</span>
                <button onClick={() => removeTask(idx)} className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {tasks.length === 0 && (
          <p className="text-center py-4 text-muted-foreground text-sm">{t('task.empty')}</p>
        )}

        {tasks.length > 0 && (
          <Button onClick={publishSession} className="w-full" size="sm">
            <Send className="w-4 h-4 mr-1" /> {t('task.publish')}
          </Button>
        )}
      </div>
    );
  }

  // --- PUBLISHED SESSION VIEW ---
  const overallDone = completions.length;
  const overallTotal = tasks.length * Math.max(totalStudents, 1);
  const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;

  const sessionContent = (
    <>
      <div className="space-y-3">
        {session.tasks.map((task, idx) => {
          const done = getTaskCompletionCount(idx);
          const pct = totalStudents > 0 ? Math.round((done / totalStudents) * 100) : 0;
          return (
            <div key={idx}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">{idx + 1}. {task}</span>
                <span className="text-muted-foreground">{done}/{totalStudents} ({pct}%)</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>{t('task.progress')}: {overallPct}%</span>
        <span>{t('task.students')}: {new Set(completions.map(c => c.student_name)).size}/{totalStudents}</span>
      </div>
    </>
  );

  // --- FULLSCREEN MODE ---
  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col p-6 sm:p-10"
      >
        {/* QR in top-left */}
        <div className="absolute top-4 left-4 flex flex-col items-center gap-1">
          <div className="bg-background p-2 rounded-lg border border-border shadow-md">
            <QRCodeSVG value={sessionUrl} size={100} level="M" />
          </div>
          <p className="text-xs text-muted-foreground">{t('task.scanToComplete')}</p>
        </div>

        {/* Exit fullscreen */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={endSession}>
            {t('task.end')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)}>
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full">
          <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-8">{session.title}</h2>
          <div className="w-full">{sessionContent}</div>
        </div>
      </motion.div>
    );
  }

  // --- NORMAL PUBLISHED VIEW ---
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          {session.title}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setFullscreen(true)}>
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={endSession}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-2 mb-4">
        <div className="bg-background p-3 rounded-xl border border-border">
          <QRCodeSVG value={sessionUrl} size={120} level="M" />
        </div>
        <p className="text-xs text-muted-foreground">{t('task.scanToComplete')}</p>
      </div>

      {sessionContent}
    </div>
  );
}
