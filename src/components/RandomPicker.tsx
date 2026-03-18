import { useState, useRef, useCallback, useEffect } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Play, Volume2, Mic, RotateCcw, Timer, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import SpinWheel from '@/components/SpinWheel';
import { playTick, playCelebration } from '@/lib/sounds';
import { loadLastGroups, loadLastTeams } from '@/lib/teamwork-local';

export default function RandomPicker() {
  const { students } = useStudents();
  const { t } = useLanguage();
  const [isRolling, setIsRolling] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [noRepeat, setNoRepeat] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [rollDuration, setRollDuration] = useState(3);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [popupEnabled, setPopupEnabled] = useState(true);
  const [popupName, setPopupName] = useState<string | null>(null);
  const [pickedNames, setPickedNames] = useState<string[]>([]);
  const [showPickedList, setShowPickedList] = useState(false);
  const rollerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const popupTimerRef = useRef<number>(0);
  const currentRollingRef = useRef<{ id: string; name: string } | null>(null);
  const isRollingRef = useRef(false);
  const rollStartTimeRef = useRef(0);

  const availableStudents = noRepeat
    ? students.filter(s => !usedIds.has(s.id))
    : students;

  const resetPool = useCallback(() => {
    setUsedIds(new Set());
    setSelectedStudent(null);
    setPickedNames([]);
  }, []);

  const showPopup = useCallback((name: string) => {
    setPopupName(name);
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = window.setTimeout(() => setPopupName(null), 3000);
  }, []);

  // Speak name using Web Speech API
  const speakName = useCallback((name: string) => {
    if (!voiceEnabled) return;
    const utterance = new SpeechSynthesisUtterance(name);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const finishRoll = useCallback((chosen: { id: string; name: string }) => {
    if (animRef.current) clearTimeout(animRef.current);
    animRef.current = 0;
    isRollingRef.current = false;
    setSelectedStudent(chosen.name);
    setIsRolling(false);
    setPickedNames(prev => [...prev, chosen.name]);
    if (noRepeat) {
      setUsedIds(prev => new Set([...prev, chosen.id]));
    }
    if (soundEnabled) playCelebration();
    speakName(chosen.name);
    if (popupEnabled) showPopup(chosen.name);
  }, [noRepeat, speakName, soundEnabled, popupEnabled, showPopup]);

  const startRoll = useCallback(() => {
    if (availableStudents.length === 0 || isRolling) return;
    setIsRolling(true);
    isRollingRef.current = true;
    const rollStartTime = Date.now();
    rollStartTimeRef.current = rollStartTime;
    setSelectedStudent(null);

    const durationMs = rollDuration * 1000;
    const startTime = Date.now();
    const minInterval = 50;

    const step = () => {
      if (!isRollingRef.current) return;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const randomIndex = Math.floor(Math.random() * availableStudents.length);
      const current = availableStudents[randomIndex];
      currentRollingRef.current = current;
      setSelectedStudent(current.name);
      if (soundEnabled) playTick();

      if (progress < 1) {
        const delay = minInterval + (progress * progress * 400);
        animRef.current = window.setTimeout(step, delay);
      } else {
        const finalIndex = Math.floor(Math.random() * availableStudents.length);
        const chosen = availableStudents[finalIndex];
        finishRoll(chosen);
      }
    };

    step();
  }, [availableStudents, isRolling, noRepeat, speakName, rollDuration, finishRoll, soundEnabled]);

  // Press any key or click to stop immediately
  useEffect(() => {
    const stopNow = () => {
      if (!isRollingRef.current) return;
      if (Date.now() - rollStartTimeRef.current < 300) return;
      const chosen = currentRollingRef.current;
      if (chosen) finishRoll(chosen);
    };
    const onKey = (e: KeyboardEvent) => { if (isRollingRef.current && Date.now() - rollStartTimeRef.current > 300) { e.preventDefault(); stopNow(); } };
    const onClick = () => stopNow();
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick, true);
    };
  }, [finishRoll]);

  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, []);

  const displayNames = availableStudents.length > 0 ? availableStudents : students;
  const useWheel = students.length <= 20 && students.length > 0;

  const handleWheelRollStart = useCallback(() => {
    setIsRolling(true);
    setSelectedStudent(null);
  }, []);

  const handleWheelRollEnd = useCallback((chosen: { id: string; name: string }) => {
    setSelectedStudent(chosen.name);
    setIsRolling(false);
    setPickedNames(prev => [...prev, chosen.name]);
    if (noRepeat) {
      setUsedIds(prev => new Set([...prev, chosen.id]));
    }
    if (soundEnabled) playCelebration();
    speakName(chosen.name);
    if (popupEnabled) showPopup(chosen.name);
  }, [noRepeat, speakName, soundEnabled, popupEnabled, showPopup]);

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-8 overflow-auto">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-6 mb-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Volume2 className="w-4 h-4" /> {t('random.sound')}
          <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mic className="w-4 h-4" /> {t('random.voice')}
          <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <RotateCcw className="w-4 h-4" /> {t('random.noRepeat')}
          <Switch checked={noRepeat} onCheckedChange={setNoRepeat} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4" /> {t('random.popup')}
          <Switch checked={popupEnabled} onCheckedChange={setPopupEnabled} />
        </label>
      </div>
      {/* Duration slider */}
      <div className="flex items-center gap-3 mb-8 w-full max-w-sm">
        <Timer className="w-4 h-4 text-muted-foreground shrink-0" />
        <Slider
          value={[rollDuration]}
          onValueChange={([v]) => setRollDuration(v)}
          min={1}
          max={10}
          step={1}
          disabled={isRolling}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground tabular-nums w-10 text-right">{rollDuration}{t('random.seconds')}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch w-full max-w-4xl">
        {useWheel ? (
          <div className="flex-1 flex flex-col">
            <SpinWheel
              students={students}
              availableStudents={availableStudents}
              isRolling={isRolling}
              rollDuration={rollDuration}
              noRepeat={noRepeat}
              soundEnabled={soundEnabled}
              onRollStart={handleWheelRollStart}
              onRollEnd={handleWheelRollEnd}
            />
            {noRepeat && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                {pickedNames.length > 0 && (
                  <button onClick={() => setShowPickedList(true)} className="text-primary hover:underline font-medium">
                    {t('random.picked')} {pickedNames.length} {t('random.persons')}
                  </button>
                )}
                <span>{t('random.remaining')} {availableStudents.length}/{students.length} {t('random.persons')}</span>
                {usedIds.size > 0 && (
                  <button onClick={resetPool} className="text-primary hover:underline">{t('random.reset')}</button>
                )}
              </div>
            )}
            {!noRepeat && pickedNames.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <button onClick={() => setShowPickedList(true)} className="text-primary hover:underline font-medium">
                  {t('random.picked')} {pickedNames.length} {t('random.persons')}
                </button>
                <button onClick={() => setPickedNames([])} className="text-primary hover:underline">{t('random.clearList')}</button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
              <h3 className="text-lg font-medium text-foreground mb-1">{t('random.title')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('random.rollerMode')} ({students.length}{t('random.persons')})
              </p>

              <div className="relative bg-card rounded-2xl border border-border shadow-card overflow-hidden flex-1 flex flex-col">
                <div className="h-64 overflow-hidden relative" ref={rollerRef}>
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent z-10 pointer-events-none" />
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-14 bg-highlight-soft rounded-xl z-5 border border-primary/20" />

                  <div className="flex flex-col items-center justify-center h-full gap-1 py-4">
                    <AnimatePresence mode="popLayout">
                      {isRolling ? (
                        <motion.div
                          key="rolling"
                          className="text-2xl font-semibold text-primary"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 0.15, repeat: Infinity }}
                        >
                          {selectedStudent || '...'}
                        </motion.div>
                      ) : selectedStudent ? (
                        <motion.div
                          key="selected"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-center"
                        >
                          <div className="text-3xl font-bold text-primary mb-2">{selectedStudent}</div>
                        </motion.div>
                      ) : (
                        displayNames.slice(0, 5).map((s) => (
                          <div key={s.id} className="text-lg text-muted-foreground py-1.5">
                            {s.name}
                          </div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="p-4 flex flex-col items-center gap-2 border-t border-border mt-auto">
                  <Button
                    onClick={startRoll}
                    disabled={isRolling || availableStudents.length === 0}
                    className="gap-2"
                    size="lg"
                  >
                    <Play className="w-4 h-4" />
                    {isRolling ? t('random.pressToStop') : t('random.roll')}
                  </Button>
                  {selectedStudent && !isRolling && (
                    <p className="text-sm text-muted-foreground">{t('random.selected')}：{selectedStudent}</p>
                  )}
                  {noRepeat && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {pickedNames.length > 0 && (
                        <button onClick={() => setShowPickedList(true)} className="text-primary hover:underline font-medium">
                          {t('random.picked')} {pickedNames.length} {t('random.persons')}
                        </button>
                      )}
                      <span>{t('random.remaining')} {availableStudents.length}/{students.length} {t('random.persons')}</span>
                      {usedIds.size > 0 && (
                        <button onClick={resetPool} className="text-primary hover:underline">{t('random.reset')}</button>
                      )}
                    </div>
                  )}
                  {!noRepeat && pickedNames.length > 0 && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <button onClick={() => setShowPickedList(true)} className="text-primary hover:underline font-medium">
                        {t('random.picked')} {pickedNames.length} {t('random.persons')}
                      </button>
                      <button onClick={() => setPickedNames([])} className="text-primary hover:underline">{t('random.clearList')}</button>
                    </div>
                  )}
                </div>
              </div>
          </div>
        )}

        {/* Dice Panel */}
        <DicePanel soundEnabled={soundEnabled} voiceEnabled={voiceEnabled} noRepeat={noRepeat} popupEnabled={popupEnabled} showPopup={showPopup} pickedNames={pickedNames} onPick={(name) => setPickedNames(prev => [...prev, name])} onShowList={() => setShowPickedList(true)} />
      </div>

      {/* Picked students list overlay */}
      <AnimatePresence>
        {showPickedList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/40 backdrop-blur-sm cursor-pointer"
            onClick={() => setShowPickedList(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowPickedList(false); }}
            tabIndex={0}
            ref={(el) => el?.focus()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl border border-border shadow-elevated p-6 max-w-sm w-full mx-4 max-h-[70vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground mb-3">{t('random.pickedList')} ({pickedNames.length}{t('random.persons')})</h3>
              <div className="flex flex-wrap gap-2">
                {pickedNames.map((name, i) => (
                  <span key={i} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium">
                    {i + 1}. {name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">{t('random.clickToClose')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen name popup */}
      <AnimatePresence>
        {popupName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 backdrop-blur-sm"
            onClick={() => setPopupName(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="text-center"
            >
              <div
                className="text-7xl sm:text-8xl md:text-9xl font-bold text-background drop-shadow-lg"
                style={{ fontFamily: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif' }}
              >
                {popupName}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4 text-background/60 text-sm"
              >
                {t('random.clickAnywhereClose')}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Dice sub-component
function DicePanel({ soundEnabled, voiceEnabled, noRepeat, popupEnabled, showPopup, pickedNames, onPick, onShowList }: { soundEnabled: boolean; voiceEnabled: boolean; noRepeat: boolean; popupEnabled: boolean; showPopup: (name: string) => void; pickedNames: string[]; onPick: (name: string) => void; onShowList: () => void }) {
  const { students } = useStudents();
  const { t } = useLanguage();
  const [isRolling, setIsRolling] = useState(false);
  const [diceValues, setDiceValues] = useState<number[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [mode, setMode] = useState<'group' | 'team'>('group');
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());

  const availableStudents = noRepeat
    ? students.filter(s => !usedIds.has(s.id))
    : students;

  const diceBuckets = useCallback(() => {
    const availableIdSet = new Set(availableStudents.map(s => s.id));

    if (mode === 'group') {
      const groups = loadLastGroups()
        .map(group => ({
          name: group.name,
          members: group.members.filter(member => availableIdSet.has(member.id)),
        }))
        .filter(group => group.members.length > 0);

      if (groups.length > 0) return groups;
    }

    if (mode === 'team') {
      const teams = loadLastTeams()
        .map(team => ({
          name: team.name,
          members: team.members.filter(member => availableIdSet.has(member.id)),
        }))
        .filter(team => team.members.length > 0);

      if (teams.length > 0) return teams;
    }

    const fallbackCount = Math.min(6, Math.max(1, Math.ceil(availableStudents.length / 4)));
    const fallbackBuckets = Array.from({ length: fallbackCount }, (_, i) => ({
      name: mode === 'group' ? `${i + 1}` : `${i + 1}`,
      members: [] as { id: string; name: string }[],
    }));

    availableStudents.forEach((student, i) => {
      fallbackBuckets[i % fallbackCount].members.push({ id: student.id, name: student.name });
    });

    return fallbackBuckets.filter(bucket => bucket.members.length > 0);
  }, [availableStudents, mode]);

  const buckets = diceBuckets();
  const groupCount = Math.max(1, buckets.length);
  const maxMembersInBucket = Math.max(1, ...buckets.map(bucket => bucket.members.length));

  // Dot positions for each dice face (relative to a 100x100 viewBox)
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
  };

  const DiceFace = ({ value }: { value: number }) => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {(dotPositions[value] || dotPositions[1]).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={9} className="fill-foreground" />
      ))}
    </svg>
  );

  const rollDice = useCallback(() => {
    if (availableStudents.length === 0 || isRolling) return;
    setIsRolling(true);
    setResult(null);

    const groupDiceCount = groupCount > 6 ? 2 : 1;
    const memberDiceCount = maxMembersInBucket > 6 ? 2 : 1;
    const totalDice = groupDiceCount + memberDiceCount;

    let count = 0;
    const steps = 12;
    const interval = setInterval(() => {
      count++;
      setDiceValues(Array.from({ length: totalDice }, () => Math.floor(Math.random() * 6) + 1));
      if (soundEnabled) playTick();
      if (count >= steps) {
        clearInterval(interval);

        const finalValues = Array.from({ length: totalDice }, () => Math.floor(Math.random() * 6) + 1);
        setDiceValues(finalValues);

        const groupIndex = ((finalValues[0] - 1) % groupCount);
        const chosenGroup = buckets[groupIndex];
        const memberIndex = ((finalValues[groupDiceCount] - 1) % chosenGroup.members.length);
        const chosen = chosenGroup.members[memberIndex];

        setResult(t('dice.groupResult').replace('{0}', String(groupIndex + 1)).replace('{1}', String(memberIndex + 1)) + `: ${chosen.name}`);
        setIsRolling(false);
        onPick(chosen.name);

        if (noRepeat) {
          setUsedIds(prev => new Set([...prev, chosen.id]));
        }

        if (soundEnabled) playCelebration();
        if (popupEnabled) showPopup(chosen.name);

        if (voiceEnabled) {
          const utterance = new SpeechSynthesisUtterance(chosen.name);
          utterance.lang = 'zh-CN';
          speechSynthesis.speak(utterance);
        }
      }
    }, 80);
  }, [availableStudents.length, isRolling, groupCount, maxMembersInBucket, soundEnabled, voiceEnabled, noRepeat, t, buckets, onPick, popupEnabled, showPopup]);

  const diceLabels = groupCount > 6
    ? [t('dice.groupTens'), t('dice.groupOnes'), t('dice.memberOnes')]
    : [t('dice.group'), t('dice.member')];

  return (
    <div className="w-full lg:flex-1 flex flex-col">
      <h3 className="text-lg font-medium text-foreground mb-1 flex items-center gap-2">
        {t('dice.title')}
        <span className="text-xs text-muted-foreground font-normal">{t('dice.subtitle')}</span>
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t('dice.mode')}
      </p>

      <div className="bg-card rounded-2xl border border-border shadow-card p-5 flex-1 flex flex-col">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setMode('group')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'group' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t('dice.basedOnGroup')}
          </button>
          <button
            onClick={() => setMode('team')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'team' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t('dice.basedOnTeam')}
          </button>
        </div>

        {/* Dice display */}
        <div className="flex justify-center gap-4 mb-4">
          {(diceValues.length > 0 ? diceValues : [1, 1]).map((val, i) => (
            <div key={i} className="text-center">
              <div className={`w-12 h-12 rounded-xl border-2 border-foreground bg-background flex items-center justify-center p-1
                ${isRolling ? 'animate-dice-shake' : ''}`}>
                <DiceFace value={val || 1} />
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {diceLabels[i] || ''}
              </span>
            </div>
          ))}
        </div>

        {/* Roll button */}
        <div className="flex justify-center mb-3">
          <Button onClick={rollDice} disabled={isRolling || availableStudents.length === 0} variant="outline" className="gap-2">
            {t('dice.throw')}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <p className="font-semibold text-foreground">{result}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('dice.groupDice').replace('{0}', String(groupCount)).replace('{1}', groupCount > 6 ? '2' : '1')}
            </p>
          </motion.div>
        )}
        {noRepeat && (
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mt-2">
            <span>{t('random.remaining')} {availableStudents.length}/{students.length} {t('random.persons')}</span>
            {usedIds.size > 0 && (
              <button onClick={() => setUsedIds(new Set())} className="text-primary hover:underline">{t('random.reset')}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
