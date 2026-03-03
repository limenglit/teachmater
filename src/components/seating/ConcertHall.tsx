import { useState, useRef, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { distributeConcertHall } from '@/lib/seating';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';

interface Props {
  students: { id: string; name: string }[];
}

type RefObj = { id: string; type: 'podium' | 'door' | 'window' | 'aisle'; x: number; y: number; label?: string };

export default function ConcertHall({ students }: Props) {
  const { settings } = useSettings();
  const [seatsPerRow, setSeatsPerRow] = useState(12);
  const [rowCount, setRowCount] = useState(5);
  const [seatGap, setSeatGap] = useState(settings.defaultRowGap); // radius step
  const [assignment, setAssignment] = useState<string[][]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{startX:number,startY:number,origX:number,origY:number} | null>(null);
  const [refsObjs, setRefsObjs] = useState<RefObj[]>([]);
  const refDragging = useRef<{id:string,startX:number,startY:number,origX:number,origY:number} | null>(null);

  const autoSeat = (shuffle = false) => {
    const names = students.map(s => s.name);
    const rows = distributeConcertHall(names, seatsPerRow, rowCount, shuffle);
    setAssignment(rows);
  };

  const svgW = 700;
  const svgH = 420;
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
      if (refDragging.current) {
        const dx = e.clientX - refDragging.current.startX;
        const dy = e.clientY - refDragging.current.startY;
        setRefsObjs(rs => rs.map(r => r.id === refDragging.current!.id ? { ...r, x: refDragging.current!.origX + dx, y: refDragging.current!.origY + dy } : r));
      }
    };
    const handleMouseUp = () => { draggingRef.current = null; refDragging.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  const startDrag = (e: React.MouseEvent) => {
    if (!settings.enableDragging) return;
    e.stopPropagation();
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const startRefDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const found = refsObjs.find(r => r.id === id);
    refDragging.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: found?.x || 0,
      origY: found?.y || 0,
    };
  };

  const addRef = (type: RefObj['type']) => {
    const id = `${type}-${Date.now()}`;
    setRefsObjs(rs => [...rs, { id, type, x: 0, y: 0, label: type }]);
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
        {assignment.length > 0 && <ExportButtons targetRef={printRef} filename="音乐厅座位" />}
        {assignment.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => addRef('podium')}>添加讲台</Button>
            <Button variant="ghost" size="sm" onClick={() => addRef('door')}>添加门</Button>
            <Button variant="ghost" size="sm" onClick={() => addRef('window')}>添加窗</Button>
            <Button variant="ghost" size="sm" onClick={() => addRef('aisle')}>添加过道</Button>
          </div>
        )}
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
            <div className="relative">
              <svg
                width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
                className="font-sans" style={{ fontFamily: 'var(--font-family)' }}
                {...(settings.enableDragging ? { onMouseDown: startDrag } : {})}
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

            <div className="absolute inset-0 pointer-events-none">
              {refsObjs.map(r => (
                <div
                  key={r.id}
                  className="absolute pointer-events-auto bg-white/80 border rounded px-2 py-1 text-xs shadow"
                  style={{ left: r.x, top: r.y, transform: 'translate(-50%,-50%)' }}
                  onMouseDown={(e) => startRefDrag(e, r.id)}
                  onDoubleClick={() => setRefsObjs(rs => rs.filter(x => x.id !== r.id))}
                >
                  {r.label}
                </div>
              ))}
            </div>
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
