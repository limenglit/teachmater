import { useState, useRef, useCallback, useEffect } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

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
  onRollStart: () => void;
  onRollEnd: (chosen: Student) => void;
}

export default function SpinWheel({
  students,
  availableStudents,
  isRolling,
  rollDuration,
  noRepeat,
  onRollStart,
  onRollEnd,
}: SpinWheelProps) {
  const displayStudents = availableStudents.length > 0 ? availableStudents : students;
  const count = displayStudents.length;
  const anglePerSlice = 360 / count;
  const [rotation, setRotation] = useState(0);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  const spin = useCallback(() => {
    if (count === 0 || isRolling) return;
    onRollStart();
    setSelectedName(null);

    // Pick winner
    const winnerIndex = Math.floor(Math.random() * availableStudents.length);
    const chosen = availableStudents[winnerIndex];

    // Calculate final rotation: pointer is at top (0°/360°)
    // Each segment center is at index * anglePerSlice
    // We want the chosen segment to land under the pointer (top)
    // Wheel rotates clockwise, so we need to rotate so that the segment's center aligns with 0°
    const targetAngle = 360 - (winnerIndex * anglePerSlice + anglePerSlice / 2);
    const fullSpins = Math.floor(rollDuration / 2) * 360; // More spins for longer duration
    const finalRotation = rotation + fullSpins + targetAngle + (360 - (rotation % 360));

    setRotation(finalRotation);

    // After animation completes
    setTimeout(() => {
      setSelectedName(chosen.name);
      onRollEnd(chosen);
    }, rollDuration * 1000);
  }, [count, isRolling, availableStudents, anglePerSlice, rotation, rollDuration, onRollStart, onRollEnd]);

  const wheelSize = 320;
  const radius = wheelSize / 2;

  return (
    <div className="flex-1 flex flex-col items-center">
      <h3 className="text-lg font-medium text-foreground mb-1">随机选人</h3>
      <p className="text-sm text-muted-foreground mb-4">
        大转盘 ({students.length}人)
      </p>

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
          className="w-full h-full rounded-full border-4 border-border shadow-lg overflow-hidden relative"
          style={{ transformOrigin: 'center center' }}
          animate={{ rotate: rotation }}
          transition={{
            duration: rollDuration,
            ease: [0.2, 0.8, 0.3, 1], // Custom ease-out curve
          }}
        >
          {/* SVG wheel segments */}
          <svg viewBox={`0 0 ${wheelSize} ${wheelSize}`} className="w-full h-full">
            {displayStudents.map((student, i) => {
              const startAngle = i * anglePerSlice - 90; // -90 to start from top
              const endAngle = startAngle + anglePerSlice;
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              const largeArc = anglePerSlice > 180 ? 1 : 0;

              const x1 = radius + radius * Math.cos(startRad);
              const y1 = radius + radius * Math.sin(startRad);
              const x2 = radius + radius * Math.cos(endRad);
              const y2 = radius + radius * Math.sin(endRad);

              // Text position at midpoint, slightly inside
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
                      fontSize: count > 12 ? '10px' : '12px',
                      fontWeight: 600,
                    }}
                  >
                    {student.name.length > 4 ? student.name.slice(0, 4) + '..' : student.name}
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
            <span className="text-xs font-bold text-primary">GO</span>
          </div>
        </motion.div>
      </div>

      {/* Controls below wheel */}
      <div className="mt-5 flex flex-col items-center gap-2">
        <Button
          onClick={spin}
          disabled={isRolling || availableStudents.length === 0}
          className="gap-2"
          size="lg"
        >
          <Play className="w-4 h-4" />
          {isRolling ? '旋转中...' : '旋转'}
        </Button>
        {selectedName && !isRolling && (
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-lg font-bold text-primary"
          >
            🎉 选中：{selectedName}
          </motion.p>
        )}
      </div>
    </div>
  );
}
