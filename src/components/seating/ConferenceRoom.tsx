import { useState, useRef, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { distributeConferenceLongTable } from '@/lib/seating';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';

interface Props {
  students: { id: string; name: string }[];
}

type RefObj = { id: string; type: 'podium' | 'door' | 'window' | 'aisle'; x: number; y: number; label?: string };

export default function ConferenceRoom({ students }: Props) {
  const { settings } = useSettings();
  const [seatsPerSide, setSeatsPerSide] = useState(8);
  const [seatGap, setSeatGap] = useState(settings.defaultSeatGap);
  const [assignment, setAssignment] = useState<{ top: string[]; bottom: string[]; headLeft: string; headRight: string }>({ top: [], bottom: [], headLeft: '', headRight: '' });
  const [seated, setSeated] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [tableOffset, setTableOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{startX:number,startY:number,origX:number,origY:number} | null>(null);
  const [refsObjs, setRefsObjs] = useState<RefObj[]>([]);
  const refDragging = useRef<{id:string,startX:number,startY:number,origX:number,origY:number} | null>(null);

  const autoSeat = (shuffle = false) => {
    const names = students.map(s => s.name);
    const { top, bottom, headLeft, headRight } = distributeConferenceLongTable(names, seatsPerSide, shuffle);
    setAssignment({ top, bottom, headLeft, headRight });
    setSeated(true);
  };

  const seatW = 64;
  const seatH = 40;
  const gap = seatGap;
  const tableW = seatsPerSide * (seatW + gap) + gap;
  const tableH = 60;
  const svgW = tableW + seatW * 2 + 60;
  const svgH = tableH + seatH * 2 + 80;
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
      origX: tableOffset.x,
      origY: tableOffset.y,
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
          每边座位数
          <Input type="number" min={3} max={15} value={seatsPerSide}
            onChange={e => setSeatsPerSide(Math.max(3, Math.min(15, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          座位间距
          <Input type="number" min={2} max={20} value={seatGap}
            onChange={e => setSeatGap(Math.max(2, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        {seated && <ExportButtons targetRef={printRef} filename="会议室座位" />}
        {seated && (
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
        {seated ? (
          <div className="flex justify-center overflow-auto">
            <div className="relative">
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
