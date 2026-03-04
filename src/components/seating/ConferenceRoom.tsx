import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import { clampValue, splitIntoGroups, shuffleArray } from '@/lib/seatingUtils';
import SceneLandmarks from './SceneLandmarks';

interface Props {
  students: { id: string; name: string }[];
}

export default function ConferenceRoom({ students }: Props) {
  const [seatsPerSide, setSeatsPerSide] = useState(8);
  const [seatGap, setSeatGap] = useState(6);
  const [assignment, setAssignment] = useState<{ top: string[]; bottom: string[]; headLeft: string; headRight: string }>({ top: [], bottom: [], headLeft: '', headRight: '' });
  const [seated, setSeated] = useState(false);
  const [groupCount, setGroupCount] = useState(4);
  const [freeCanvasMode, setFreeCanvasMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [tableOffset, setTableOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{startX:number,startY:number,origX:number,origY:number} | null>(null);

  const autoSeat = (shuffle = false) => {
    const names = shuffle ? shuffleArray(students.map(s => s.name)) : students.map(s => s.name);

    const headLeft = names[0] || '';
    const headRight = names[1] || '';
    const rest = names.slice(2);
    const top: string[] = [];
    const bottom: string[] = [];
    rest.forEach((n, i) => {
      if (i < seatsPerSide) top.push(n);
      else if (i < seatsPerSide * 2) bottom.push(n);
    });
    setAssignment({ top, bottom, headLeft, headRight });
    setSeated(true);
  };

  const groupSeat = () => {
    const names = students.map(s => s.name);
    const groups = splitIntoGroups(names, groupCount);
    // flatten groups but keep each group contiguous on seating order
    const flat = groups.flat();
    const headLeft = flat[0] || '';
    const headRight = flat[1] || '';
    const rest = flat.slice(2);
    const top: string[] = [];
    const bottom: string[] = [];
    let idx = 0;
    for (let i = 0; i < rest.length; i++) {
      if (i < seatsPerSide) top.push(rest[i]);
      else if (i < seatsPerSide * 2) bottom.push(rest[i]);
    }
    setAssignment({ top, bottom, headLeft, headRight });
    setSeated(true);
  };

  const seatW = 64;
  const seatH = 40;
  const gap = seatGap;
  const tableW = seatsPerSide * (seatW + gap) + gap;
  const tableH = 60;
  const baseSvgW = tableW + seatW * 2 + 60;
  const baseSvgH = tableH + seatH * 2 + 80;
  const svgW = freeCanvasMode ? Math.max(baseSvgW + 520, 980) : baseSvgW;
  const svgH = freeCanvasMode ? Math.max(baseSvgH + 260, 620) : baseSvgH;
  const tableX = (svgW - tableW) / 2 + tableOffset.x;
  const tableY = (svgH - tableH) / 2 + tableOffset.y;
  const baseTableX = (svgW - tableW) / 2;
  const baseTableY = (svgH - tableH) / 2;
  const padding = 8;

  const xBounds = {
    min: (seatW + 12 + padding) - baseTableX,
    max: (svgW - padding - tableW - 12 - seatW) - baseTableX,
  };
  const yBounds = {
    min: (seatH + 8 + padding) - baseTableY,
    max: (svgH - padding - tableH - 8 - seatH) - baseTableY,
  };

  const renderSeat = (x: number, y: number, name: string, key: string) => (
    <g key={key}>
      <rect x={x} y={y} width={seatW} height={seatH} rx={6}
        className={name ? 'fill-card stroke-border' : 'fill-muted/50 stroke-border/50'} strokeWidth={1.5} />
      {name && (
        <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xs">
          {name.length > 3 ? name.slice(0, 3) : name}
        </text>
      )}
    </g>
  );

  useEffect(() => {
    if (!freeCanvasMode) {
      setTableOffset({ x: 0, y: 0 });
    }
  }, [freeCanvasMode]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        setTableOffset({
          x: clampValue(draggingRef.current.origX + dx, xBounds.min, xBounds.max),
          y: clampValue(draggingRef.current.origY + dy, yBounds.min, yBounds.max),
        });
      }
    };
    const handleMouseUp = () => { draggingRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [xBounds.max, xBounds.min, yBounds.max, yBounds.min]);

  const startDrag = (e: React.MouseEvent) => {
    if (!freeCanvasMode) return;
    e.stopPropagation();
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: tableOffset.x,
      origY: tableOffset.y,
    };
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          每边座位数
          <Input type="number" min={3} max={15} value={seatsPerSide}
            onChange={e => setSeatsPerSide(Math.max(3, Math.min(15, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          座位间距
          <Input type="number" min={2} max={20} value={seatGap}
            onChange={e => setSeatGap(Math.max(2, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          组数
          <Input type="number" min={1} max={20} value={groupCount}
            onChange={e => setGroupCount(Math.max(1, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={freeCanvasMode} onChange={e => setFreeCanvasMode(e.target.checked)} className="accent-primary" />
          自由画布
        </label>
        {seated && <ExportButtons targetRef={printRef} filename="会议室座位" />}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => autoSeat(true)} className="gap-2">
            <Shuffle className="w-4 h-4" /> 随机排座
          </Button>
          <Button onClick={() => autoSeat(false)} className="gap-2">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
          <Button variant="ghost" onClick={groupSeat} className="gap-2">分组排座</Button>
        </div>
      </div>

      <SceneLandmarks
        printRef={printRef}
        top={{ label: '投影/白板', emoji: '📽️' }}
        sides={{
          left: { label: '窗', boxStyle: true },
          right: { label: '门', emoji: '🚪' },
          swappable: true,
        }}
        bottom={{ label: '入 口', emoji: '🚶' }}
      >
        {seated ? (
          <div className="flex justify-center overflow-auto">
            <div className="inline-block border border-border rounded-lg bg-card/40 p-2 overflow-hidden">
            <div className={freeCanvasMode ? 'rounded-md border border-dashed border-border/70 bg-muted/20' : ''}>
            <svg
              width={svgW}
              height={svgH}
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="font-sans"
              style={{ fontFamily: 'var(--font-family)' }}
              onMouseDown={freeCanvasMode ? startDrag : undefined}
            >
              {/* Conference table */}
              <rect x={tableX} y={tableY} width={tableW} height={tableH} rx={10}
                className="fill-primary/10 stroke-primary/30" strokeWidth={2} />

              {/* Top row */}
              {Array.from({ length: seatsPerSide }).map((_, i) => {
                const x = tableX + gap + i * (seatW + gap);
                const y = tableY - seatH - 8;
                return renderSeat(x, y, assignment.top[i] || '', `top-${i}`);
              })}

              {/* Bottom row */}
              {Array.from({ length: seatsPerSide }).map((_, i) => {
                const x = tableX + gap + i * (seatW + gap);
                const y = tableY + tableH + 8;
                return renderSeat(x, y, assignment.bottom[i] || '', `bot-${i}`);
              })}

              {/* Head seats */}
              {renderSeat(tableX - seatW - 12, tableY + (tableH - seatH) / 2, assignment.headLeft, 'head-left')}
              {renderSeat(tableX + tableW + 12, tableY + (tableH - seatH) / 2, assignment.headRight, 'head-right')}

              {/* Labels */}
              <text x={tableX + tableW / 2} y={tableY + tableH / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="fill-primary text-sm font-medium">
                会议桌
              </text>
            </svg>
            </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">长条会议桌，每边 {seatsPerSide} 个座位</p>
          </div>
        )}
      </SceneLandmarks>

      {seated && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          💡 两端为主位 · 拖动投影/白板和门窗可调整位置
        </p>
      )}
    </div>
  );
}
