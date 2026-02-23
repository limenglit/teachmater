import { useState, useRef, useCallback, useEffect } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { playTick } from '@/lib/sounds';

interface Student {
  id: string;
  name: string;
}

// Warm distinct colors for wheel segments
const SEGMENT_COLORS = [
  'hsl(var(--primary) / 0.85)',
  'hsl(var(--primary) / 0.55)',
  'hsl(var(--accent))',
  'hsl(var(--primary) / 0.7)',
  'hsl(var(--primary) / 0.4)',
  'hsl(var(--accent) / 0.8)',
];

interface SpinWheelProps {
  students: Student[];
  availableStudents: Student[];
  isRolling: boolean;
  rollDuration: number;
  noRepeat: boolean;
  soundEnabled: boolean;
  onRollStart: () => void;
  onRollEnd: (chosen: Student) => void;
}

export default function SpinWheel({
  students,
  availableStudents,
  isRolling,
  rollDuration,
  noRepeat,
  soundEnabled,
  onRollStart,
  onRollEnd,
}: SpinWheelProps) {
  const displayStudents = availableStudents.length > 0 ? availableStudents : students;
  const count = displayStudents.length;
  const anglePerSlice = 360 / count;
  const [rotation, setRotation] = useState(0);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const chosenRef = useRef<{ student: Student; winnerIndex: number } | null>(null);
  const timerRef = useRef<number>(0);
  const tickRef = useRef<number>(0);

  const spin = useCallback(() => {
    if (count === 0 || isRolling) return;
    onRollStart();
    setSelectedName(null);
    setSpinning(true);

    // Pick winner
    const winnerIndex = Math.floor(Math.random() * availableStudents.length);
    const chosen = availableStudents[winnerIndex];
    chosenRef.current = { student: chosen, winnerIndex };

    // Calculate final rotation
    const targetAngle = 360 - (winnerIndex * anglePerSlice + anglePerSlice / 2);
    const fullSpins = Math.floor(rollDuration / 2) * 360;
    const finalRotation = rotation + fullSpins + targetAngle + (360 - (rotation % 360));

    setRotation(finalRotation);

    // Tick sound during spinning
    if (soundEnabled) {
      let tickInterval = 80;
      const tickLoop = () => {
        if (chosenRef.current) {
          playTick();
          tickInterval = Math.min(tickInterval + 8, 300);
          tickRef.current = window.setTimeout(tickLoop, tickInterval);
        }
      };
      tickLoop();
    }

    // Auto-stop after duration
    timerRef.current = window.setTimeout(() => {
      stopWheel();
    }, rollDuration * 1000);
  }, [count, isRolling, availableStudents, anglePerSlice, rotation, rollDuration, onRollStart, onRollEnd, soundEnabled]);

  const stopWheel = useCallback(() => {
    if (!spinning || !chosenRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tickRef.current) clearTimeout(tickRef.current);
    const { student } = chosenRef.current;
    setSelectedName(student.name);
    setSpinning(false);
    onRollEnd(student);
    chosenRef.current = null;
  }, [spinning, onRollEnd]);

  const handleWheelClick = useCallback(() => {
    if (spinning) {
      stopWheel();
    }
  }, [spinning, stopWheel]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tickRef.current) clearTimeout(tickRef.current);
    };
  }, []);

  const wheelSize = 320;
  const radius = wheelSize / 2;

  return (
    <div className="flex-1 flex flex-col items-center">
      <h3 className="text-lg font-medium text-foreground mb-1">随机选人</h3>
      <p className="text-sm text-muted-foreground mb-2">
        大转盘 ({students.length}人)
      </p>

      {/* Selected name display above wheel */}
      <div className="h-10 mb-2 flex items-center justify-center">
        {selectedName && !spinning ? (
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-2xl font-bold text-primary"
          >
            🎉 {selectedName}
          </motion.p>
        ) : spinning ? (
          <p className="text-sm text-muted-foreground animate-pulse">点击转盘停止...</p>
        ) : null}
      </div>

      <div className="relative" style={{ width: wheelSize, height: wheelSize }}>
        {/* Pointer triangle at top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20">
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderTop: '20px solid hsl(var(--primary))',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
            }}
          />
        </div>

        {/* Wheel */}
        <motion.div
          ref={wheelRef}
          className={`w-full h-full rounded-full border-4 border-border shadow-lg overflow-hidden relative ${spinning ? 'cursor-pointer' : ''}`}
          style={{ transformOrigin: 'center center' }}
          animate={{ rotate: rotation }}
          transition={{
            duration: spinning ? rollDuration : 0.3,
            ease: spinning ? [0.2, 0.8, 0.3, 1] : 'easeOut',
          }}
          onClick={handleWheelClick}
        >
          {/* SVG wheel segments */}
          <svg viewBox={`0 0 ${wheelSize} ${wheelSize}`} className="w-full h-full">
            {displayStudents.map((student, i) => {
              const startAngle = i * anglePerSlice - 90;
              const endAngle = startAngle + anglePerSlice;
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              const largeArc = anglePerSlice > 180 ? 1 : 0;

              const x1 = radius + radius * Math.cos(startRad);
              const y1 = radius + radius * Math.sin(startRad);
              const x2 = radius + radius * Math.cos(endRad);
              const y2 = radius + radius * Math.sin(endRad);

              const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
              const textR = radius * 0.65;
              const tx = radius + textR * Math.cos(midAngle);
              const ty = radius + textR * Math.sin(midAngle);
              const textRotation = (startAngle + endAngle) / 2 + 90;

              const colorIndex = i % SEGMENT_COLORS.length;

              return (
                <g key={student.id}>
                  <path
                    d={`M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={SEGMENT_COLORS[colorIndex]}
                    stroke="hsl(var(--background))"
                    strokeWidth="1.5"
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                    className="fill-primary-foreground"
                    style={{
                      fontSize: count > 15 ? '12px' : count > 8 ? '14px' : '16px',
                      fontWeight: 700,
                    }}
                  >
                    {student.name.length > 3 ? student.name.slice(0, 3) + '..' : student.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Center circle */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card border-2 border-border shadow-md flex items-center justify-center"
            style={{ width: wheelSize * 0.18, height: wheelSize * 0.18 }}
          >
            <span className="text-xs font-bold text-primary">{spinning ? 'STOP' : 'GO'}</span>
          </div>
        </motion.div>
      </div>

      {/* Controls below wheel */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <Button
          onClick={spin}
          disabled={spinning || availableStudents.length === 0}
          className="gap-2"
          size="lg"
        >
          <Play className="w-4 h-4" />
          {spinning ? '旋转中（点击转盘停止）' : '旋转'}
        </Button>
      </div>
    </div>
  );
}
