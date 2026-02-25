import { useState, useRef, useCallback, useEffect } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { Play, Volume2, Mic, RotateCcw, Timer, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import SpinWheel from '@/components/SpinWheel';
import { playTick, playCelebration } from '@/lib/sounds';

export default function RandomPicker() {
  const { students } = useStudents();
  const [isRolling, setIsRolling] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [noRepeat, setNoRepeat] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [rollDuration, setRollDuration] = useState(10);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [popupEnabled, setPopupEnabled] = useState(true);
  const [popupName, setPopupName] = useState<string | null>(null);
  const rollerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const popupTimerRef = useRef<number>(0);

  const availableStudents = noRepeat
    ? students.filter(s => !usedIds.has(s.id))
    : students;

  const resetPool = useCallback(() => {
    setUsedIds(new Set());
    setSelectedStudent(null);
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

  const startRoll = useCallback(() => {
    if (availableStudents.length === 0 || isRolling) return;
    setIsRolling(true);
    setSelectedStudent(null);

    const durationMs = rollDuration * 1000;
    const startTime = Date.now();
    const minInterval = 50;

    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const randomIndex = Math.floor(Math.random() * availableStudents.length);
      setSelectedStudent(availableStudents[randomIndex].name);
      if (soundEnabled) playTick();

      if (progress < 1) {
        // Ease-out: interval grows as progress increases
        const delay = minInterval + (progress * progress * 400);
        animRef.current = window.setTimeout(step, delay);
      } else {
        // Final selection
        const finalIndex = Math.floor(Math.random() * availableStudents.length);
        const chosen = availableStudents[finalIndex];
        setSelectedStudent(chosen.name);
        setIsRolling(false);
        if (noRepeat) {
          setUsedIds(prev => new Set([...prev, chosen.id]));
        }
        if (soundEnabled) playCelebration();
        speakName(chosen.name);
        if (popupEnabled) showPopup(chosen.name);
      }
    };

    step();
  }, [availableStudents, isRolling, noRepeat, speakName, rollDuration]);

  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, []);

  // Roller display - show scrolling names
  const displayNames = availableStudents.length > 0 ? availableStudents : students;
  const useWheel = students.length <= 20 && students.length > 0;

  const handleWheelRollStart = useCallback(() => {
    setIsRolling(true);
    setSelectedStudent(null);
  }, []);

  const handleWheelRollEnd = useCallback((chosen: { id: string; name: string }) => {
    setSelectedStudent(chosen.name);
    setIsRolling(false);
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
          <Volume2 className="w-4 h-4" /> 音效
          <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mic className="w-4 h-4" /> 语音
          <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <RotateCcw className="w-4 h-4" /> 不重复
          <Switch checked={noRepeat} onCheckedChange={setNoRepeat} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4" /> 大字弹出
          <Switch checked={popupEnabled} onCheckedChange={setPopupEnabled} />
        </label>
      </div>
      {/* Duration slider */}
      <div className="flex items-center gap-3 mb-8 w-full max-w-sm">
        <Timer className="w-4 h-4 text-muted-foreground shrink-0" />
        <Slider
          value={[rollDuration]}
          onValueChange={([v]) => setRollDuration(v)}
          min={5}
          max={60}
          step={1}
          disabled={isRolling}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground tabular-nums w-10 text-right">{rollDuration}秒</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-center lg:items-start w-full max-w-4xl">
        {useWheel ? (
          <>
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <span>剩余 {availableStudents.length}/{students.length} 人</span>
                {usedIds.size > 0 && (
                  <button onClick={resetPool} className="text-primary hover:underline">重置</button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Roller for >20 students */}
            <div className="flex-1">
              <h3 className="text-lg font-medium text-foreground mb-1">随机选人</h3>
              <p className="text-sm text-muted-foreground mb-4">
                滚轮模式 ({students.length}人)
              </p>

              <div className="relative bg-card rounded-2xl border border-border shadow-card overflow-hidden">
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

                <div className="p-4 flex flex-col items-center gap-2 border-t border-border">
                  <Button
                    onClick={startRoll}
                    disabled={isRolling || availableStudents.length === 0}
                    className="gap-2"
                    size="lg"
                  >
                    <Play className="w-4 h-4" />
                    {isRolling ? '滚动中...' : '滚动'}
                  </Button>
                  {selectedStudent && !isRolling && (
                    <p className="text-sm text-muted-foreground">选中：{selectedStudent}</p>
                  )}
                  {noRepeat && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>剩余 {availableStudents.length}/{students.length} 人</span>
                      {usedIds.size > 0 && (
                        <button onClick={resetPool} className="text-primary hover:underline">重置</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Dice Panel */}
        <DicePanel soundEnabled={soundEnabled} voiceEnabled={voiceEnabled} noRepeat={noRepeat} popupEnabled={popupEnabled} showPopup={showPopup} />
      </div>

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
                点击任意处关闭
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Dice sub-component
function DicePanel({ soundEnabled, voiceEnabled, noRepeat, popupEnabled, showPopup }: { soundEnabled: boolean; voiceEnabled: boolean; noRepeat: boolean; popupEnabled: boolean; showPopup: (name: string) => void }) {
  const { students } = useStudents();
  const [isRolling, setIsRolling] = useState(false);
  const [diceValues, setDiceValues] = useState<number[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [mode, setMode] = useState<'group' | 'team'>('group');
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());

  const availableStudents = noRepeat
    ? students.filter(s => !usedIds.has(s.id))
    : students;

  // Simple dice: just pick a random student using dice visualization
  const groupCount = Math.min(6, Math.ceil(availableStudents.length / 4));
  const membersPerGroup = Math.ceil(availableStudents.length / groupCount);

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

    // Determine dice needed
    const groupDiceCount = groupCount > 6 ? 2 : 1;
    const memberDiceCount = membersPerGroup > 6 ? 2 : 1;
    const totalDice = groupDiceCount + memberDiceCount;

    // Animate
    let count = 0;
    const steps = 12;
    const interval = setInterval(() => {
      count++;
      setDiceValues(Array.from({ length: totalDice }, () => Math.floor(Math.random() * 6) + 1));
      if (soundEnabled) playTick();
      if (count >= steps) {
        clearInterval(interval);

        // Final values
        const finalValues = Array.from({ length: totalDice }, () => Math.floor(Math.random() * 6) + 1);
        setDiceValues(finalValues);

        // Map to student
        const groupIndex = ((finalValues[0] - 1) % groupCount);
        const memberIndex = ((finalValues[groupDiceCount] - 1) % membersPerGroup);
        const studentIndex = groupIndex * membersPerGroup + memberIndex;
        const chosen = availableStudents[Math.min(studentIndex, availableStudents.length - 1)];

        setResult(`第${groupIndex + 1}组 第${memberIndex + 1}人: ${chosen.name}`);
        setIsRolling(false);

        if (noRepeat) {
          setUsedIds(prev => new Set([...prev, chosen.id]));
        }

        if (soundEnabled) playCelebration();
        if (popupEnabled) showPopup(chosen.name);

        // Speak
        if (voiceEnabled) {
          const utterance = new SpeechSynthesisUtterance(chosen.name);
          utterance.lang = 'zh-CN';
          speechSynthesis.speak(utterance);
        }
      }
    }, 80);
  }, [availableStudents, isRolling, groupCount, membersPerGroup, soundEnabled, voiceEnabled, noRepeat]);

  const diceLabels = groupCount > 6
    ? ['组十位', '组个位', '成员个位']
    : ['组', '成员'];

  return (
    <div className="w-full lg:w-72">
      <h3 className="text-lg font-medium text-foreground mb-1 flex items-center gap-2">
        🎲 智能骰子
        <span className="text-xs text-muted-foreground font-normal">(基于分组/建队)</span>
      </h3>

      <div className="bg-card rounded-2xl border border-border shadow-card p-5 mt-4">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setMode('group')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'group' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            基于分组
          </button>
          <button
            onClick={() => setMode('team')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'team' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            基于建队
          </button>
        </div>

        {/* Dice display */}
        <div className="flex justify-center gap-4 mb-4">
          {(diceValues.length > 0 ? diceValues : [1, 1]).map((val, i) => (
            <div key={i} className="text-center">
              <div className={`w-24 h-24 rounded-2xl border-[3px] border-foreground bg-background flex items-center justify-center p-2
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
            🎲 投掷
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
              (组数{groupCount}→{groupCount > 6 ? '2' : '1'}个骰子定位组)
            </p>
          </motion.div>
        )}
        {noRepeat && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
            <span>剩余 {availableStudents.length}/{students.length} 人</span>
            {usedIds.size > 0 && (
              <button onClick={() => setUsedIds(new Set())} className="text-primary hover:underline">重置</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
