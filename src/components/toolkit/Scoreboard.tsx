import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStudents } from '@/contexts/StudentContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Plus, Minus, RotateCcw, X, Users } from 'lucide-react';
import ClassRosterPicker from '@/components/ClassRosterPicker';

interface ScoreEntry {
  name: string;
  score: number;
}

const COLORS = [
  'bg-primary/10 border-primary/30',
  'bg-blue-500/10 border-blue-500/30',
  'bg-green-500/10 border-green-500/30',
  'bg-orange-500/10 border-orange-500/30',
  'bg-pink-500/10 border-pink-500/30',
  'bg-purple-500/10 border-purple-500/30',
  'bg-cyan-500/10 border-cyan-500/30',
  'bg-amber-500/10 border-amber-500/30',
];

const STORAGE_KEY = 'classroom-scoreboard';

function loadScores(): ScoreEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveScores(entries: ScoreEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function Scoreboard() {
  const { t } = useLanguage();
  const { students } = useStudents();
  const [entries, setEntries] = useState<ScoreEntry[]>(() => loadScores());
  const [newName, setNewName] = useState('');
  const [step, setStep] = useState(1);
  const [showRoster, setShowRoster] = useState(false);
  const [linkedNames, setLinkedNames] = useState<string[]>([]);

  const updateAndSave = (next: ScoreEntry[]) => {
    setEntries(next);
    saveScores(next);
  };

  const resolveRoster = () => {
    if (linkedNames.length > 0) return linkedNames;
    return students.map(s => s.name);
  };

  const applyRoster = (names: string[]) => {
    setLinkedNames(names);
    const scoreByName = new Map(entries.map(e => [e.name, e.score]));
    const next = names.map(name => ({ name, score: scoreByName.get(name) ?? 0 }));
    updateAndSave(next);
  };

  const ensureRosterReady = () => {
    const roster = resolveRoster();
    if (roster.length === 0) {
      return false;
    }
    if (entries.length === 0) {
      applyRoster(roster);
    }
    return true;
  };

  const addEntry = () => {
    if (!ensureRosterReady()) return;
    const name = newName.trim();
    if (!name || entries.find(e => e.name === name)) return;
    updateAndSave([...entries, { name, score: 0 }]);
    setNewName('');
  };

  const changeScore = (idx: number, delta: number) => {
    if (!ensureRosterReady()) return;
    const next = entries.map((e, i) => i === idx ? { ...e, score: e.score + delta } : e);
    updateAndSave(next);
  };

  const removeEntry = (idx: number) => {
    updateAndSave(entries.filter((_, i) => i !== idx));
  };

  const resetAll = () => {
    if (!ensureRosterReady()) return;
    updateAndSave(entries.map(e => ({ ...e, score: 0 })));
  };

  const sorted = [...entries].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Trophy className="w-4 h-4" /> {t('score.title')}
      </h3>

      <div className="flex items-center gap-2 mb-3">
        <Button variant={linkedNames.length > 0 ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setShowRoster(true)}>
          <Users className="w-3.5 h-3.5" />
          {linkedNames.length > 0 ? `已关联班级(${linkedNames.length}${t('sidebar.persons')})` : '关联班级'}
        </Button>
        {linkedNames.length === 0 && students.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => applyRoster(students.map(s => s.name))}>
            使用当前名单({students.length}{t('sidebar.persons')})
          </Button>
        )}
      </div>

      {/* Add entry */}
      <div className="flex gap-2 mb-3">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={t('score.addPlaceholder')}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEntry(); } }}
          className="text-sm"
        />
        <Button size="sm" onClick={addEntry} disabled={!newName.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Step selector */}
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        <span>{t('score.step')}:</span>
        {[1, 2, 5, 10].map(s => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${
              step === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Score cards */}
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t('score.empty')}</p>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-auto">
          {sorted.map((entry, i) => {
            const originalIdx = entries.findIndex(e => e.name === entry.name);
            return (
              <div key={entry.name} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${COLORS[i % COLORS.length]}`}>
                <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                <span className="flex-1 text-sm font-medium text-foreground truncate">{entry.name}</span>
                <span className="font-mono font-bold text-lg text-foreground min-w-[40px] text-center">{entry.score}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => changeScore(originalIdx, -step)}
                    className="w-7 h-7 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center text-destructive transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => changeScore(originalIdx, step)}
                    className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeEntry(originalIdx)}
                    className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {entries.length > 0 && (
        <Button variant="outline" size="sm" onClick={resetAll} className="w-full mt-3 gap-1 text-xs">
          <RotateCcw className="w-3 h-3" /> {t('score.resetAll')}
        </Button>
      )}

      <ClassRosterPicker
        open={showRoster}
        onOpenChange={setShowRoster}
        onSelect={applyRoster}
        currentCount={linkedNames.length}
        onClear={() => {
          setLinkedNames([]);
          updateAndSave([]);
        }}
      />
    </div>
  );
}
