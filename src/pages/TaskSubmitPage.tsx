import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Circle, ClipboardList } from 'lucide-react';

const NAME_KEY = 'task-student-name';

interface TaskSessionData {
  id: string;
  title: string;
  tasks: string[];
  status: string;
  student_names: string[];
}

export default function TaskSubmitPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useLanguage();
  const [session, setSession] = useState<TaskSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [joined, setJoined] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [nameQuery, setNameQuery] = useState(() => localStorage.getItem(NAME_KEY) || '');

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    if (!sessionId) return;
    const { data } = await supabase
      .from('task_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (data) {
      const tasks = typeof (data as any).tasks === 'string'
        ? JSON.parse((data as any).tasks)
        : (data as any).tasks;
      const names = typeof (data as any).student_names === 'string'
        ? JSON.parse((data as any).student_names)
        : ((data as any).student_names || []);
      setSession({
        id: (data as any).id,
        title: (data as any).title,
        tasks,
        status: (data as any).status,
        student_names: names,
      });
    }
    setLoading(false);
  };

  const joinSession = async () => {
    const name = (nameQuery || studentName).trim();
    if (!name || !session) return;
    setStudentName(name);
    localStorage.setItem(NAME_KEY, name);

    // Load existing completions for this student
    const { data } = await supabase
      .from('task_completions')
      .select('task_index')
      .eq('session_id', session.id)
      .eq('student_name', name);
    if (data) {
      setCompletedTasks(new Set(data.map(d => d.task_index)));
    }
    setJoined(true);
  };

  const toggleTask = async (taskIdx: number) => {
    if (!session || submitting) return;
    if (completedTasks.has(taskIdx)) return; // Already completed, no undo
    setSubmitting(true);
    const { error } = await supabase
      .from('task_completions')
      .insert({
        session_id: session.id,
        student_name: studentName.trim(),
        task_index: taskIdx,
      });
    if (!error) {
      setCompletedTasks(prev => new Set([...prev, taskIdx]));
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t('checkinPage.loading')}</p>
      </div>
    );
  }

  if (!session || session.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">{t('task.sessionEnded')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('task.sessionEndedDesc')}</p>
        </div>
      </div>
    );
  }

  if (!joined) {
    const hasNameList = session.student_names && session.student_names.length > 0;
    const filteredNames = hasNameList
      ? session.student_names.filter(name => name.toLowerCase().includes(nameQuery.trim().toLowerCase()))
      : [];
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            {session.title}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {session.tasks.length} {t('task.taskCount')}
          </p>

          {hasNameList ? (
            <div className="mb-4 space-y-2">
              <Input
                value={nameQuery}
                onChange={e => setNameQuery(e.target.value)}
                placeholder={t('board.searchName')}
                onKeyDown={e => { if (e.key === 'Enter') joinSession(); }}
              />
              <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredNames.map(name => (
                <button
                  key={name}
                  onClick={() => {
                    setStudentName(name);
                    setNameQuery(name);
                  }}
                  className={`w-full text-left p-2 rounded-lg border transition-colors text-sm ${
                    (nameQuery || studentName) === name
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                >
                  {name}
                </button>
              ))}
              </div>

              {filteredNames.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('board.nameNotFound')}</p>
              )}
            </div>
          ) : (
            <Input
              value={nameQuery}
              onChange={e => setNameQuery(e.target.value)}
              placeholder={t('quiz.enterName')}
              className="mb-4"
              onKeyDown={e => { if (e.key === 'Enter') joinSession(); }}
            />
          )}

          <Button onClick={joinSession} disabled={!(nameQuery || studentName).trim()} className="w-full">
            {t('task.joinSession')}
          </Button>
        </div>
      </div>
    );
  }

  // Task checklist for student
  const progress = session.tasks.length > 0
    ? Math.round((completedTasks.size / session.tasks.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-card rounded-2xl border border-border shadow-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">{session.title}</h2>
          <p className="text-sm text-muted-foreground mb-4">{studentName}</p>

          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{t('task.progress')}</span>
              <span>{completedTasks.size}/{session.tasks.length} ({progress}%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            {session.tasks.map((task, idx) => {
              const done = completedTasks.has(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggleTask(idx)}
                  disabled={done || submitting}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    done
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task}
                  </span>
                </button>
              );
            })}
          </div>

          {progress === 100 && (
            <div className="mt-4 text-center">
              <p className="text-primary font-medium">{t('task.allDone')} 🎉</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
