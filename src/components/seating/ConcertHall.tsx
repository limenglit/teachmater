import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle, QrCode } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';

interface Props {
  students: { id: string; name: string }[];
}

type ConcertSeatMode = 'arcBalanced' | 'groupZone' | 'verticalS' | 'horizontalS';

export default function ConcertHall({ students }: Props) {
  const [seatsPerRow, setSeatsPerRow] = useState(12);
  const [rowCount, setRowCount] = useState(5);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<ConcertSeatMode>('arcBalanced');
  const [seatGap, setSeatGap] = useState(50); // radius step
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{startX:number,startY:number,origX:number,origY:number} | null>(null);

  const splitIntoGroups = (names: string[], count: number) => {
    const groups: string[][] = Array.from({ length: count }, () => []);
    names.forEach((n, i) => groups[i % count].push(n));
    return groups;
  };

  const seatCaps = Array.from({ length: rowCount }, (_, r) => seatsPerRow + r * 2);
  const seatKey = (row: number, col: number) => `${row}-${col}`;

  const toggleSeatOpen = (row: number, col: number) => {
    const key = seatKey(row, col);
    setClosedSeats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const seatOrder = (seatMode: ConcertSeatMode) => {
    const slots: { row: number; col: number }[] = [];

    if (seatMode === 'verticalS') {
      const maxCols = Math.max(...seatCaps);
      for (let c = 0; c < maxCols; c++) {
        for (let ri = 0; ri < rowCount; ri++) {
          const r = c % 2 === 0 ? ri : rowCount - 1 - ri;
          if (c < seatCaps[r]) slots.push({ row: r, col: c });
        }
      }
      return slots;
    }

    if (seatMode === 'horizontalS') {
      for (let r = 0; r < rowCount; r++) {
        const cap = seatCaps[r];
        for (let ci = 0; ci < cap; ci++) {
          const c = r % 2 === 0 ? ci : cap - 1 - ci;
          slots.push({ row: r, col: c });
        }
      }
      return slots;
    }

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < seatCaps[r]; c++) slots.push({ row: r, col: c });
    }
    return slots;
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

    const rows: string[][] = seatCaps.map(cap => Array.from({ length: cap }, () => ''));

    if (mode === 'groupZone') {
      const groups = splitIntoGroups(names, Math.max(1, groupCount));
      const slots = seatOrder('horizontalS').filter(slot => !closedSeats.has(seatKey(slot.row, slot.col)));
      let cursor = 0;
      groups.forEach(group => {
        group.forEach(n => {
          if (cursor >= slots.length) return;
          const slot = slots[cursor++];
          rows[slot.row][slot.col] = n;
        });
      });
    } else {
      const slots = seatOrder(mode).filter(slot => !closedSeats.has(seatKey(slot.row, slot.col)));
      names.slice(0, slots.length).forEach((n, i) => {
        const slot = slots[i];
        rows[slot.row][slot.col] = n;
      });
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

  useEffect(() => {
    setClosedSeats(prev => {
      const next = new Set<string>();
      prev.forEach(key => {
        const [rStr, cStr] = key.split('-');
        const r = Number(rStr);
        const c = Number(cStr);
        if (r < rowCount && c < (seatsPerRow + r * 2)) next.add(key);
      });
      return next;
    });
  }, [rowCount, seatsPerRow]);
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
    <div onMouseUp={() => { setDragFrom(null); setDropTarget(null); }} onMouseLeave={() => { setDragFrom(null); setDropTarget(null); }}>
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
          模式
          <select
            value={mode}
            onChange={e => setMode(e.target.value as ConcertSeatMode)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="arcBalanced">扇区平衡</option>
            <option value="groupZone">分组分区</option>
            <option value="verticalS">竖S分配</option>
            <option value="horizontalS">横S分配</option>
          </select>
        </label>
        {mode === 'groupZone' && (
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

                  const slot = seatKey(ri, ci);
                  const isClosed = closedSeats.has(slot);
                  const isDragging = dragFrom === slot;
                  const isOver = dropTarget === slot;

                  return (
                    <g
                      key={`${ri}-${ci}`}
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
                          const next = prev.map(r => [...r]);
                          const [fr, fc] = from.split('-').map(Number);
                          const [tr, tc] = to.split('-').map(Number);
                          const temp = next[fr][fc];
                          next[fr][fc] = next[tr][tc];
                          next[tr][tc] = temp;
                          return next;
                        });
                        setDragFrom(null);
                        setDropTarget(null);
                      }}
                      onClick={() => { if (!name) toggleSeatOpen(ri, ci); }}
                    >
                      <circle cx={sx} cy={sy} r={seatR}
                        className={
                          isClosed ? 'fill-muted stroke-destructive/60' :
                          isDragging ? 'fill-primary/20 stroke-primary' :
                          isOver ? 'fill-accent stroke-primary' :
                          'fill-card stroke-border'
                        }
                        strokeWidth={isOver ? 2.5 : 1.5}
                      />
                      {isClosed && (
                        <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-destructive text-xs">
                          关
                        </text>
                      )}
                      {name && !isDragging && (
                        <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xs">
                          {name.length > 2 ? name.slice(0, 2) : name}
                        </text>
                      )}
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
          💡 拖拽姓名可换座；点击空座位可关闭/开放使用
        </p>
      )}
    </div>
  );
}
