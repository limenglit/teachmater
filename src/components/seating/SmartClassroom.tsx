import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import { useRoundTableDrag } from './useRoundTableDrag';
import { clampValue, splitIntoGroups, shuffleArray } from '@/lib/seatingUtils';

interface Props {
  students: { id: string; name: string }[];
}

export default function SmartClassroom({ students }: Props) {
  const [seatsPerTable, setSeatsPerTable] = useState(6);
  const [tableCount, setTableCount] = useState(() => Math.ceil(students.length / 6) || 4);
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [tableGap, setTableGap] = useState(20);
  const [groupCount, setGroupCount] = useState(4);
  const [freeCanvasMode, setFreeCanvasMode] = useState(false);
  const [tablePositions, setTablePositions] = useState<{x:number,y:number}[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{index:number,startX:number,startY:number,origX:number,origY:number} | null>(null);
  const { dragFrom, dropTarget, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useRoundTableDrag(assignment, setAssignment);

  const autoSeat = () => {
    const names = students.map(s => s.name);
    const groups = splitIntoGroups(names, tableCount);
    const tables = groups.map(g => g.slice(0, seatsPerTable));
    setAssignment(tables);
  };

  const shuffleSeat = () => {
    const names = shuffleArray(students.map(s => s.name));
    const groups = splitIntoGroups(names, tableCount);
    const tables = groups.map(g => g.slice(0, seatsPerTable));
    setAssignment(tables);
  };

  const groupSeat = () => {
    const names = students.map(s => s.name);
    const groups = splitIntoGroups(names, groupCount);
    const tables = groups.map(g => g.slice(0, seatsPerTable));
    while (tables.length < tableCount) tables.push([]);
    setAssignment(tables.slice(0, tableCount));
  };

  const tableCols = Math.ceil(Math.sqrt(tableCount));
  const tableRows = Math.ceil(tableCount / tableCols);
  const tableSize = 160;
  const canvasPadding = 16;
  const canvasWidth = Math.max(720, tableCols * tableSize + Math.max(0, tableCols - 1) * tableGap + canvasPadding * 2);
  const canvasHeight = Math.max(460, tableRows * tableSize + Math.max(0, tableRows - 1) * tableGap + canvasPadding * 2);

  // initialize positions when layout mode or table count changes
  useEffect(() => {
    if (freeCanvasMode) {
      setTablePositions(
        Array.from({ length: tableCount }, (_, index) => {
          const col = index % tableCols;
          const row = Math.floor(index / tableCols);
          return {
            x: canvasPadding + col * (tableSize + tableGap),
            y: canvasPadding + row * (tableSize + tableGap),
          };
        }),
      );
      return;
    }
    setTablePositions(Array.from({ length: tableCount }, () => ({ x: 0, y: 0 })));
  }, [canvasPadding, freeCanvasMode, tableCols, tableCount, tableGap, tableSize]);

  // drag listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        setTablePositions(pos => pos.map((p, i) => {
          if (i !== draggingRef.current!.index) return p;
          const nextX = draggingRef.current!.origX + dx;
          const nextY = draggingRef.current!.origY + dy;
          if (freeCanvasMode) {
            return {
              x: clampValue(nextX, 0, canvasWidth - tableSize),
              y: clampValue(nextY, 0, canvasHeight - tableSize),
            };
          }
          const maxOffset = 100;
          return {
            x: clampValue(nextX, -maxOffset, maxOffset),
            y: clampValue(nextY, -maxOffset, maxOffset),
          };
        }));
      }
    };
    const handleMouseUp = () => { draggingRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [canvasHeight, canvasWidth, freeCanvasMode, tableSize]);

  const startTableDrag = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    draggingRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      origX: tablePositions[index]?.x || 0,
      origY: tablePositions[index]?.y || 0,
    };
  };

  const renderRoundTable = (tableIndex: number, people: string[]) => {
    const radius = 52;
    const seatRadius = 16;
    const cx = 80, cy = 80;
    const totalSlots = Math.max(seatsPerTable, people.length);
    const pos = tablePositions[tableIndex] || { x: 0, y: 0 };

    return (
      <div
        key={tableIndex}
        className="flex flex-col items-center gap-1 cursor-move"
        style={
          freeCanvasMode
            ? { position: 'absolute', left: `${pos.x}px`, top: `${pos.y}px` }
            : { transform: `translate(${pos.x}px,${pos.y}px)` }
        }
        onMouseDown={e => startTableDrag(e, tableIndex)}
      >
        <svg width={160} height={160} viewBox="0 0 160 160" className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
          <circle cx={cx} cy={cy} r={36} className="fill-primary/10 stroke-primary/30" strokeWidth={2} />
          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-primary text-xs font-medium">
            {tableIndex + 1}桌
          </text>
          {Array.from({ length: totalSlots }).map((_, i) => {
            const angle = (2 * Math.PI * i) / totalSlots - Math.PI / 2;
            const sx = cx + radius * Math.cos(angle);
            const sy = cy + radius * Math.sin(angle);
            const name = people[i] || '';
            const isDragging = dragFrom?.table === tableIndex && dragFrom?.seat === i;
            const isOver = dropTarget?.table === tableIndex && dropTarget?.seat === i;
            return (
              <g
                key={i}
                style={{ cursor: name ? 'grab' : 'default' }}
                onMouseDown={name ? (e) => { e.preventDefault(); handleDragStart(tableIndex, i); } : undefined}
                onMouseEnter={() => { if (dragFrom) handleDragOver(tableIndex, i); }}
                onMouseUp={() => { if (dragFrom) handleDrop(tableIndex, i); }}
              >
                <circle
                  cx={sx} cy={sy} r={seatRadius}
                  className={
                    isDragging ? 'fill-primary/20 stroke-primary' :
                    isOver ? 'fill-accent stroke-primary' :
                    name ? 'fill-card stroke-border hover:stroke-primary/50' : 'fill-muted/50 stroke-border/50'
                  }
                  strokeWidth={isOver ? 2.5 : 1.5}
                  style={{ transition: 'all 0.15s' }}
                />
                {name && !isDragging && (
                  <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xs pointer-events-none">
                    {name.length > 3 ? name.slice(0, 3) : name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          每桌人数
          <Input type="number" min={3} max={12} value={seatsPerTable}
            onChange={e => setSeatsPerTable(Math.max(3, Math.min(12, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          桌数
          <Input type="number" min={1} max={20} value={tableCount}
            onChange={e => setTableCount(Math.max(1, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          桌子间距
          <Input type="number" min={0} max={100} value={tableGap}
            onChange={e => setTableGap(Math.max(0, Math.min(100, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        {assignment.length > 0 && <ExportButtons targetRef={printRef} filename="智能教室座位" />}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          组数
          <Input type="number" min={1} max={20} value={groupCount}
            onChange={e => setGroupCount(Math.max(1, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={freeCanvasMode} onChange={e => setFreeCanvasMode(e.target.checked)} className="accent-primary" />
          自由画布
        </label>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={shuffleSeat} className="gap-2">
            <Shuffle className="w-4 h-4" /> 随机排座
          </Button>
          <Button onClick={autoSeat} className="gap-2">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
          <Button variant="ghost" onClick={groupSeat} className="gap-2">
            分组排座
          </Button>
        </div>
      </div>

      <div ref={printRef}>
        {assignment.length > 0 ? (
          <div className="flex justify-center">
            <div className="border border-border rounded-lg bg-card/40 p-3 overflow-hidden" style={{ width: freeCanvasMode ? `${canvasWidth + 24}px` : 'auto' }}>
              {freeCanvasMode ? (
                <div className="relative mx-auto rounded-md border border-dashed border-border/70 bg-muted/20" style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}>
                  {assignment.map((people, i) => renderRoundTable(i, people))}
                </div>
              ) : (
                <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)`, gap: `${tableGap}px` }}>
                  {assignment.map((people, i) => renderRoundTable(i, people))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">圆形桌智能教室，每桌 {seatsPerTable} 人，共 {tableCount} 桌</p>
          </div>
        )}
      </div>

      {assignment.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          💡 点击并拖拽学生姓名可交换座位（支持跨桌交换）
        </p>
      )}
    </div>
  );
}
