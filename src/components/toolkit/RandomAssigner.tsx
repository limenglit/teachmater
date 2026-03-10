import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStudents } from '@/contexts/StudentContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle, Plus, X, RotateCcw } from 'lucide-react';
import ClassRosterPicker from '@/components/ClassRosterPicker';
import RosterQuickBind from '@/components/RosterQuickBind';

interface Assignment {
  task: string;
  assignee: string;
}

export default function RandomAssigner() {
  const { t } = useLanguage();
  const { students } = useStudents();
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');
  const [results, setResults] = useState<Assignment[]>([]);
  const [animating, setAnimating] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [linkedNames, setLinkedNames] = useState<string[]>([]);

  const resolvedNames = linkedNames.length > 0 ? linkedNames : students.map(s => s.name);

  const addTask = () => {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    setTasks(prev => [...prev, trimmed]);
    setNewTask('');
  };

  const removeTask = (idx: number) => {
    setTasks(prev => prev.filter((_, i) => i !== idx));
  };

  const assign = () => {
    if (tasks.length === 0 || resolvedNames.length === 0) return;
    setAnimating(true);
    
    setTimeout(() => {
      const shuffledStudents = [...resolvedNames].sort(() => Math.random() - 0.5);
      const assigned: Assignment[] = tasks.map((task, i) => ({
        task,
        assignee: shuffledStudents[i % shuffledStudents.length],
      }));
      setResults(assigned);
      setAnimating(false);
    }, 800);
  };

  const reset = () => {
    setResults([]);
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Shuffle className="w-4 h-4" /> {t('assign.title')}
      </h3>

      <RosterQuickBind
        className="mb-3 space-y-2"
        linkedCount={linkedNames.length}
        sidebarCount={students.length}
        onOpenRoster={() => setShowRoster(true)}
        onUseSidebar={() => setLinkedNames(students.map((s) => s.name))}
      />

      {/* Task input */}
      <div className="flex gap-2 mb-3">
        <Input
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          placeholder={t('assign.inputPlaceholder')}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
          className="text-sm"
        />
        <Button size="sm" onClick={addTask} disabled={!newTask.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Task list */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tasks.map((task, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-muted text-foreground text-xs px-2 py-1 rounded-full">
              {task}
              <button onClick={() => removeTask(i)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-muted-foreground mb-3">
        {t('assign.info').replace('{0}', String(tasks.length)).replace('{1}', String(resolvedNames.length))}
      </p>

      {/* Assign button */}
      <div className="flex gap-2">
        <Button
          onClick={assign}
          disabled={tasks.length === 0 || resolvedNames.length === 0 || animating}
          className="flex-1 gap-1"
        >
          <Shuffle className="w-4 h-4" />
          {animating ? t('assign.assigning') : t('assign.go')}
        </Button>
        {results.length > 0 && (
          <Button variant="outline" size="icon" onClick={reset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
              <span className="font-medium text-primary">{r.assignee}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-foreground">{r.task}</span>
            </div>
          ))}
        </div>
      )}

      <ClassRosterPicker
        open={showRoster}
        onOpenChange={setShowRoster}
        onSelect={(names) => setLinkedNames(names)}
        currentCount={linkedNames.length}
        onClear={() => setLinkedNames([])}
      />
    </div>
  );
}
