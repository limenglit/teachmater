import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ClipboardList, Plus, Trash2, RotateCcw, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

const STORAGE_KEY = 'classroom-task-checklist';

function loadTasks(): TaskItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveTasks(tasks: TaskItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export default function TaskChecklist() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<TaskItem[]>(loadTasks);
  const [newTask, setNewTask] = useState('');

  useEffect(() => { saveTasks(tasks); }, [tasks]);

  const doneCount = tasks.filter(t => t.done).length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setTasks(prev => [...prev, { id: crypto.randomUUID(), text, done: false }]);
    setNewTask('');
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const resetAll = () => {
    setTasks([]);
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-primary" />
        {t('task.title')}
      </h3>

      {/* Add task */}
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

      {/* Progress */}
      {tasks.length > 0 && (
        <div className="mb-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('task.progress')}</span>
            <span>{doneCount}/{tasks.length} ({progress}%)</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Task list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        <AnimatePresence>
          {tasks.map(task => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 group"
            >
              <button
                onClick={() => toggleTask(task.id)}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              >
                {task.done ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </button>
              <span className={`flex-1 text-sm ${task.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {task.text}
              </span>
              <button
                onClick={() => removeTask(task.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
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
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetAll} className="text-xs">
            <RotateCcw className="w-3 h-3 mr-1" /> {t('task.reset')}
          </Button>
        </div>
      )}
    </div>
  );
}
