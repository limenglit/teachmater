import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle, QrCode } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';

interface Props {
  students: { id: string; name: string }[];
}

type ConferenceSeatMode = 'balanced' | 'groupCluster' | 'verticalS' | 'horizontalS';

export default function ConferenceRoom({ students }: Props) {
  const [seatsPerSide, setSeatsPerSide] = useState(8);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<ConferenceSeatMode>('balanced');
  const [seatGap, setSeatGap] = useState(6);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [assignment, setAssignment] = useState<{ top: string[]; bottom: string[]; headLeft: string; headRight: string }>({ top: [], bottom: [], headLeft: '', headRight: '' });
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [seated, setSeated] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [tableOffset, setTableOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{startX:number,startY:number,origX:number,origY:number} | null>(null);

  const splitIntoGroups = (names: string[], count: number) => {
    const groups: string[][] = Array.from({ length: count }, () => []);
    names.forEach((n, i) => groups[i % count].push(n));
    return groups;
  };

  const slotOrder = (seatMode: ConferenceSeatMode) => {
    const slots: { side: 'top' | 'bottom'; index: number }[] = [];

    if (seatMode === 'verticalS') {
      for (let c = 0; c < seatsPerSide; c++) {
        if (c % 2 === 0) {
          slots.push({ side: 'top', index: c });
          slots.push({ side: 'bottom', index: c });
        } else {
          slots.push({ side: 'bottom', index: c });
          slots.push({ side: 'top', index: c });
        }
      }
      return slots;
    }

    if (seatMode === 'horizontalS') {
      for (let c = 0; c < seatsPerSide; c++) slots.push({ side: 'top', index: c });
      for (let ci = 0; ci < seatsPerSide; ci++) slots.push({ side: 'bottom', index: seatsPerSide - 1 - ci });
      return slots;
    }

    for (let c = 0; c < seatsPerSide; c++) slots.push({ side: 'top', index: c });
    for (let c = 0; c < seatsPerSide; c++) slots.push({ side: 'bottom', index: c });
    return slots;
  };

  const getSeatValue = (data: { top: string[]; bottom: string[]; headLeft: string; headRight: string }, slot: string) => {
    if (slot === 'head-left') return data.headLeft;
    if (slot === 'head-right') return data.headRight;
    const [side, idxStr] = slot.split('-');
    const idx = Number(idxStr);
    if (side === 'top') return data.top[idx] || '';
    return data.bottom[idx] || '';
  };

  const setSeatValue = (data: { top: string[]; bottom: string[]; headLeft: string; headRight: string }, slot: string, value: string) => {
    if (slot === 'head-left') {
      data.headLeft = value;
      return;
    }
    if (slot === 'head-right') {
      data.headRight = value;
      return;
    }
    const [side, idxStr] = slot.split('-');
    const idx = Number(idxStr);
    if (side === 'top') data.top[idx] = value;
    else data.bottom[idx] = value;
  };

  const toggleSeatOpen = (slot: string) => {
    setClosedSeats(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

    const top: string[] = Array.from({ length: seatsPerSide }, () => '');
    const bottom: string[] = Array.from({ length: seatsPerSide }, () => '');
    const next = { top, bottom, headLeft: '', headRight: '' };

    const availableHeadSlots = ['head-left', 'head-right'].filter(slot => !closedSeats.has(slot));
    const sideSlots =
      mode === 'groupCluster'
        ? slotOrder('horizontalS').map(slot => `${slot.side}-${slot.index}`)
        : slotOrder(mode).map(slot => `${slot.side}-${slot.index}`);
    const availableSideSlots = sideSlots.filter(slot => !closedSeats.has(slot));
    const allSlots = [...availableHeadSlots, ...availableSideSlots];

    if (mode === 'groupCluster') {
      const groups = splitIntoGroups(names, Math.max(1, groupCount));
      let cursor = 0;
      groups.forEach(group => {
        group.forEach(n => {
          if (cursor >= allSlots.length) return;
          setSeatValue(next, allSlots[cursor++], n);
        });
      });
    } else {
      names.slice(0, allSlots.length).forEach((n, i) => {
        setSeatValue(next, allSlots[i], n);
      });
    }

    setAssignment(next);
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

  const renderSeat = (x: number, y: number, name: string, slot: string) => {
    const isClosed = closedSeats.has(slot);
    const isDragging = dragFrom === slot;
    const isOver = dropTarget === slot;
    return (
    <g
      key={slot}
      style={{ cursor: name && !isClosed ? 'grab' : 'pointer' }}
      onMouseDown={name && !isClosed ? (e) => { e.stopPropagation(); setDragFrom(slot); setDropTarget(slot); } : undefined}
      onMouseEnter={() => { if (dragFrom && !isClosed) setDropTarget(slot); }}
      onMouseUp={() => {
        if (!dragFrom || !dropTarget) return;
        const from = dragFrom;
        const to = dropTarget;
        if (from === to || closedSeats.has(from) || closedSeats.has(to)) {
          setDragFrom(null);
          setDropTarget(null);
          return;
        }
        setAssignment(prev => {
          const next = {
            top: [...prev.top],
            bottom: [...prev.bottom],
            headLeft: prev.headLeft,
            headRight: prev.headRight,
          };
          const fromVal = getSeatValue(next, from);
          const toVal = getSeatValue(next, to);
          setSeatValue(next, from, toVal);
          setSeatValue(next, to, fromVal);
          return next;
        });
        setDragFrom(null);
        setDropTarget(null);
      }}
      onClick={() => { if (!name) toggleSeatOpen(slot); }}
    >
      <rect x={x} y={y} width={seatW} height={seatH} rx={6}
        className={
          isClosed ? 'fill-muted stroke-destructive/60' :
          isDragging ? 'fill-primary/20 stroke-primary' :
          isOver ? 'fill-accent stroke-primary' :
          name ? 'fill-card stroke-border' : 'fill-muted/50 stroke-border/50'
        }
        strokeWidth={isOver ? 2.5 : 1.5}
      />
      {isClosed && (
        <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="fill-destructive text-xs">
          关
        </text>
      )}
      {name && !isDragging && (
        <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xs">
          {name.length > 3 ? name.slice(0, 3) : name}
        </text>
      )}
    </g>
  );
  };

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
    <div onMouseUp={() => { setDragFrom(null); setDropTarget(null); }} onMouseLeave={() => { setDragFrom(null); setDropTarget(null); }}>
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
          模式
          <select
            value={mode}
            onChange={e => setMode(e.target.value as ConferenceSeatMode)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="balanced">两侧平衡</option>
            <option value="groupCluster">分组同侧</option>
            <option value="verticalS">竖S分配</option>
            <option value="horizontalS">横S分配</option>
          </select>
        </label>
        {mode === 'groupCluster' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            组数
            <Input type="number" min={2} max={20} value={groupCount}
              onChange={e => setGroupCount(Math.max(2, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
          </label>
        )}
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
        {seated && <ExportButtons targetRef={printRef} filename="会议室座位" />}
        {seated && (
          <Button variant="outline" onClick={() => setCheckinOpen(true)} className="gap-2">
            <QrCode className="w-4 h-4" /> 签到
          </Button>
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
                return renderSeat(x, y, assignment.bottom[i] || '', `bottom-${i}`);
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
          💡 拖拽姓名可换座；点击空座位可关闭/开放使用
        </p>
      )}
      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={assignment}
        studentNames={students.map(s => s.name)}
        sceneType="conference"
        sceneConfig={{ seatsPerSide }}
      />
    </div>
  );
}
