import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';

interface Props {
  students: { id: string; name: string }[];
}

export default function ConferenceRoom({ students }: Props) {
  const [seatsPerSide, setSeatsPerSide] = useState(8);
  const [seatGap, setSeatGap] = useState(6);
  const [canvasWidth, setCanvasWidth] = useState(2200);
  const [canvasHeight, setCanvasHeight] = useState(1400);
  const [assignment, setAssignment] = useState<{ top: string[]; bottom: string[]; headLeft: string; headRight: string }>({ top: [], bottom: [], headLeft: '', headRight: '' });
  const [seated, setSeated] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [tableOffset, setTableOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{startX:number,startY:number,origX:number,origY:number} | null>(null);

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

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

  const seatW = 64;
  const seatH = 40;
  const gap = seatGap;
  const tableW = seatsPerSide * (seatW + gap) + gap;
  const tableH = 60;
  const svgW = canvasWidth;
  const svgH = canvasHeight;
  const tableX = (svgW - tableW) / 2 + tableOffset.x;
  const tableY = (svgH - tableH) / 2 + tableOffset.y;

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

  // dragging for table
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        setTableOffset({
          x: draggingRef.current.origX + dx,
          y: draggingRef.current.origY + dy,
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
  }, []);

  const startDrag = (e: React.MouseEvent) => {
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
          画布宽
          <Input type="number" min={800} value={canvasWidth}
            onChange={e => setCanvasWidth(Math.max(800, Number(e.target.value) || 800))} className="w-20 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          画布高
          <Input type="number" min={500} value={canvasHeight}
            onChange={e => setCanvasHeight(Math.max(500, Number(e.target.value) || 500))} className="w-20 h-8 text-center" />
        </label>
        {seated && <ExportButtons targetRef={printRef} filename="会议室座位" />}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => autoSeat(true)} className="gap-2">
            <Shuffle className="w-4 h-4" /> 随机排座
          </Button>
          <Button onClick={() => autoSeat(false)} className="gap-2">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
        </div>
      </div>

      <div ref={printRef}>
        {seated ? (
          <div className="flex justify-center overflow-auto">
            <svg
  width={svgW}
  height={svgH}
  viewBox={`0 0 ${svgW} ${svgH}`}
  className="font-sans"
  style={{ fontFamily: 'var(--font-family)' }}
  onMouseDown={startDrag}
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
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">长条会议桌，每边 {seatsPerSide} 个座位</p>
          </div>
        )}
      </div>

      {seated && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          💡 两端为主位，调整每边座位数后重新排座
        </p>
      )}
    </div>
  );
}
