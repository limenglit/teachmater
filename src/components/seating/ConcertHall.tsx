import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';

interface Props {
  students: { id: string; name: string }[];
}

export default function ConcertHall({ students }: Props) {
  const [seatsPerRow, setSeatsPerRow] = useState(12);
  const [rowCount, setRowCount] = useState(5);
  const [seatGap, setSeatGap] = useState(50); // radius step
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [assignment, setAssignment] = useState<string[][]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{startX:number,startY:number,origX:number,origY:number} | null>(null);

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

    const rows: string[][] = [];
    let idx = 0;
    for (let r = 0; r < rowCount && idx < names.length; r++) {
      const row: string[] = [];
      // Each row has seatsPerRow + r*2 more seats (wider as you go back)
      const count = seatsPerRow + r * 2;
      for (let c = 0; c < count && idx < names.length; c++) {
        row.push(names[idx++]);
      }
      rows.push(row);
    }
    setAssignment(rows);
  };

  const svgW = canvasWidth;
  const svgH = canvasHeight;
  const cx = svgW / 2 + offset.x;
  const stageY = 60 + offset.y;
  const stageW = 160;
  const startRadius = 100;
  const radiusStep = seatGap;
  const seatR = 14;

  // dragging logic for concert hall
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        setOffset({ x: draggingRef.current.origX + dx, y: draggingRef.current.origY + dy });
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
      origX: offset.x,
      origY: offset.y,
    };
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          每排座位
          <Input type="number" min={6} max={24} value={seatsPerRow}
            onChange={e => setSeatsPerRow(Math.max(6, Math.min(24, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          排数
          <Input type="number" min={2} max={10} value={rowCount}
            onChange={e => setRowCount(Math.max(2, Math.min(10, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          排间距
          <Input type="number" min={20} max={100} value={seatGap}
            onChange={e => setSeatGap(Math.max(20, Math.min(100, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          画布宽
          <Input type="number" min={1200} value={canvasWidth}
            onChange={e => setCanvasWidth(Math.max(1200, Number(e.target.value) || 1200))} className="w-20 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          画布高
          <Input type="number" min={800} value={canvasHeight}
            onChange={e => setCanvasHeight(Math.max(800, Number(e.target.value) || 800))} className="w-20 h-8 text-center" />
        </label>
        {assignment.length > 0 && <ExportButtons targetRef={printRef} filename="音乐厅座位" />}
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
        {assignment.length > 0 ? (
          <div className="flex justify-center overflow-auto">
            <svg
              width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
              className="font-sans" style={{ fontFamily: 'var(--font-family)' }}
              onMouseDown={startDrag}
            >
              {/* Stage */}
              <rect x={cx - stageW / 2} y={stageY - 20} width={stageW} height={36} rx={8}
                className="fill-primary/15 stroke-primary/30" strokeWidth={2} />
              <text x={cx} y={stageY} textAnchor="middle" dominantBaseline="middle" className="fill-primary text-sm font-medium">
                🎵 舞 台
              </text>

              {/* Semicircular rows */}
              {assignment.map((row, ri) => {
                const r = startRadius + ri * radiusStep;
                const seatCount = seatsPerRow + ri * 2;
                const totalAngle = Math.min(Math.PI * 0.85, Math.PI * (0.5 + ri * 0.05));
                const startAngle = Math.PI - (Math.PI - totalAngle) / 2;
                const endAngle = (Math.PI - totalAngle) / 2;

                return row.map((name, ci) => {
                  const frac = seatCount <= 1 ? 0.5 : ci / (seatCount - 1);
                  const angle = startAngle - frac * (startAngle - endAngle);
                  const sx = cx + r * Math.cos(angle);
                  const sy = stageY + 20 + r * Math.sin(angle);

                  return (
                    <g key={`${ri}-${ci}`}>
                      <circle cx={sx} cy={sy} r={seatR}
                        className="fill-card stroke-border" strokeWidth={1.5} />
                      <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xs">
                        {name.length > 2 ? name.slice(0, 2) : name}
                      </text>
                    </g>
                  );
                });
              })}
            </svg>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">半圆形音乐厅，{rowCount} 排座位围绕舞台</p>
          </div>
        )}
      </div>

      {assignment.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          💡 外排座位自动递增，后排比前排多2个座位
        </p>
      )}
    </div>
  );
}
