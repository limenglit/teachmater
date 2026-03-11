import { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStudents } from '@/contexts/StudentContext';
import { Button } from '@/components/ui/button';
import { Hand, RotateCcw, UserCheck, Users, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ClassRosterPicker from '@/components/ClassRosterPicker';

interface CallRecord {
  name: string;
  calledAt: number;
}

export default function SeatRollCall() {
  const { t } = useLanguage();
  const { students } = useStudents();
  const [names, setNames] = useState<string[]>([]);
  const [calledRecords, setCalledRecords] = useState<CallRecord[]>([]);
  const [currentPick, setCurrentPick] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [showRoster, setShowRoster] = useState(false);

  // Load from student sidebar by default
  useEffect(() => {
    if (names.length === 0 && students.length > 0) {
      setNames(students.map(s => s.name));
    }
  }, [students]);

  const calledNames = new Set(calledRecords.map(r => r.name));
  const remaining = names.filter(n => !calledNames.has(n));

  const pickRandom = useCallback(() => {
    if (remaining.length === 0) return;
    setIsRolling(true);
    setCurrentPick(null);

    // Animate through names
    let count = 0;
    const total = 12 + Math.floor(Math.random() * 6);
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * remaining.length);
      setCurrentPick(remaining[idx]);
      count++;
      if (count >= total) {
        clearInterval(interval);
        const finalIdx = Math.floor(Math.random() * remaining.length);
        const picked = remaining[finalIdx];
        setCurrentPick(picked);
        setCalledRecords(prev => [...prev, { name: picked, calledAt: Date.now() }]);
        setIsRolling(false);
      }
    }, 80);
  }, [remaining]);

  const resetAll = () => {
    setCalledRecords([]);
    setCurrentPick(null);
  };

  const handleRosterSelect = (selected: string[]) => {
    setNames(selected);
    setCalledRecords([]);
    setCurrentPick(null);
    setShowRoster(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Hand className="w-4 h-4 text-primary" />
        {t('rollcall.title')}
      </h3>

      {/* Name source */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground">
          {t('rollcall.roster')}: {names.length}{t('rollcall.people')}
        </span>
        <Button variant="outline" size="sm" className="text-xs h-6 px-2" onClick={() => setShowRoster(true)}>
          <Users className="w-3 h-3 mr-1" /> {t('rollcall.selectRoster')}
        </Button>
      </div>

      {showRoster && (
        <ClassRosterPicker
          open={showRoster}
          onOpenChange={setShowRoster}
          onSelect={handleRosterSelect}
        />
      )}

      {/* Current pick display */}
      <div className="flex flex-col items-center py-4">
        <AnimatePresence mode="wait">
          {currentPick ? (
            <motion.div
              key={currentPick + (isRolling ? '-rolling' : '-final')}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={`text-2xl font-bold py-3 px-6 rounded-xl border-2 ${
                isRolling
                  ? 'text-muted-foreground border-border bg-muted/30'
                  : 'text-primary border-primary/30 bg-primary/5'
              }`}
            >
              {currentPick}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground text-sm py-5"
            >
              {names.length > 0 ? t('rollcall.clickToStart') : t('rollcall.noNames')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-center mb-3">
        <Button
          onClick={pickRandom}
          disabled={isRolling || remaining.length === 0}
          className="gap-1"
        >
          <Shuffle className="w-4 h-4" />
          {remaining.length === 0 ? t('rollcall.allCalled') : t('rollcall.pick')}
        </Button>
        {calledRecords.length > 0 && (
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t('rollcall.reset')}
          </Button>
        )}
      </div>

      {/* Progress & called list */}
      {calledRecords.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('rollcall.called')}</span>
            <span>{calledRecords.length}/{names.length}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {calledRecords.map((r, i) => (
              <span
                key={`${r.name}-${i}`}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
              >
                <UserCheck className="w-3 h-3" />
                {r.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
