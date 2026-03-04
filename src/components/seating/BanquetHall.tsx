import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import { useRoundTableDrag } from './useRoundTableDrag';

interface Props {
  students: { id: string; name: string }[];
}

type BanquetSeatMode = 'tableRoundRobin' | 'tableGrouped' | 'verticalS' | 'horizontalS';

export default function BanquetHall({ students }: Props) {
  const [seatsPerTable, setSeatsPerTable] = useState(10);
  const [tableCount, setTableCount] = useState(() => Math.ceil(students.length / 10) || 3);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<BanquetSeatMode>('tableRoundRobin');
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [tableGap, setTableGap] = useState(24);
  const [tablePositions, setTablePositions] = useState<{x:number,y:number}[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{index:number,startX:number,startY:number,origX:number,origY:number} | null>(null);
  const { dragFrom, dropTarget, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useRoundTableDrag(assignment, setAssignment);

  const tableCols = Math.ceil(Math.sqrt(tableCount));

  const placeName = (tables: string[][], preferred: number, name: string) => {
    const order = [preferred, ...Array.from({ length: tableCount }, (_, i) => i).filter(i => i !== preferred)];
    const target = order.find(idx => tables[idx].length < seatsPerTable);
    if (target !== undefined) tables[target].push(name);
  };

  const splitIntoGroups = (names: string[], count: number) => {
    const groups: string[][] = Array.from({ length: count }, () => []);
    names.forEach((n, i) => groups[i % count].push(n));
    return groups;
  };

  const getTableOrder = (seatMode: BanquetSeatMode) => {
    const cols = Math.ceil(Math.sqrt(tableCount));
    const rows = Math.ceil(tableCount / cols);
    const order: number[] = [];

    if (seatMode === 'verticalS') {
      for (let c = 0; c < cols; c++) {
        for (let ri = 0; ri < rows; ri++) {
          const r = c % 2 === 0 ? ri : rows - 1 - ri;
          const idx = r * cols + c;
          if (idx < tableCount) order.push(idx);
        }
      }
      return order;
    }

    if (seatMode === 'horizontalS') {
      for (let r = 0; r < rows; r++) {
        for (let ci = 0; ci < cols; ci++) {
          const c = r % 2 === 0 ? ci : cols - 1 - ci;
          const idx = r * cols + c;
          if (idx < tableCount) order.push(idx);
        }
      }
      return order;
    }

    return Array.from({ length: tableCount }, (_, i) => i);
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);
    const tables: string[][] = Array.from({ length: tableCount }, () => []);

    if (mode === 'tableGrouped') {
      const groups = splitIntoGroups(names, Math.max(1, groupCount));
      groups.forEach((group, gi) => {
        group.forEach(n => placeName(tables, gi % tableCount, n));
      });
      setAssignment(tables);
      return;
    }

    const order = getTableOrder(mode);
    names.forEach((n, i) => placeName(tables, order[i % order.length], n));
    setAssignment(tables);
  };

  useEffect(() => {
    setTablePositions(Array(tableCount).fill({ x: 0, y: 0 }));
  }, [tableCount]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        setTablePositions(pos => pos.map((p, i) =>
          i === draggingRef.current!.index
            ? { x: draggingRef.current!.origX + dx, y: draggingRef.current!.origY + dy }
            : p
        ));
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

  const renderBanquetTable = (tableIndex: number, people: string[]) => {
    const radius = 60;
    const seatRadius = 16;
    const cx = 85, cy = 85;
    const totalSlots = seatsPerTable;
    const pos = tablePositions[tableIndex] || { x: 0, y: 0 };

    return (
      <div
        key={tableIndex}
        className="flex flex-col items-center cursor-move"
        style={{ transform: `translate(${pos.x}px,${pos.y}px)` }}
        onMouseDown={e => startTableDrag(e, tableIndex)}
      >
        <svg width={170} height={170} viewBox="0 0 170 170" className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
          <circle cx={cx} cy={cy} r={42} className="fill-primary/5 stroke-primary/20" strokeWidth={1} strokeDasharray="4 2" />
          <circle cx={cx} cy={cy} r={36} className="fill-primary/10 stroke-primary/30" strokeWidth={2} />
          <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle" className="fill-primary text-sm font-medium">
            {tableIndex + 1}桌
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" className="fill-primary/60 text-xs">
            {people.length}人
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
                <circle cx={sx} cy={sy} r={seatRadius}
                  className={
                    isDragging ? 'fill-primary/20 stroke-primary' :
                    isOver ? 'fill-accent stroke-primary' :
                    name ? 'fill-card stroke-border hover:stroke-primary/50' : 'fill-muted/30 stroke-border/30'
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
          <Input type="number" min={6} max={16} value={seatsPerTable}
            onChange={e => setSeatsPerTable(Math.max(6, Math.min(16, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          桌数
          <Input type="number" min={1} max={30} value={tableCount}
            onChange={e => setTableCount(Math.max(1, Math.min(30, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          模式
          <select
            value={mode}
            onChange={e => setMode(e.target.value as BanquetSeatMode)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="tableRoundRobin">每桌轮转</option>
            <option value="tableGrouped">每组一桌</option>
            <option value="verticalS">竖S桌序</option>
            <option value="horizontalS">横S桌序</option>
          </select>
        </label>
        {mode === 'tableGrouped' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            组数
            <Input type="number" min={2} max={30} value={groupCount}
              onChange={e => setGroupCount(Math.max(2, Math.min(30, Number(e.target.value))))} className="w-16 h-8 text-center" />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          桌子间距
          <Input type="number" min={0} max={100} value={tableGap}
            onChange={e => setTableGap(Math.max(0, Math.min(100, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <span className="text-xs text-muted-foreground">
          共可容纳 {seatsPerTable * tableCount} 人 | 当前 {students.length} 人
        </span>
        {assignment.length > 0 && <ExportButtons targetRef={printRef} filename="宴会厅座位" />}
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
        <div className="text-center mb-4">
          <div className="inline-block bg-primary/10 text-primary px-6 py-2 rounded-lg text-sm font-medium border border-primary/20">
            🎪 宴会厅
          </div>
        </div>

        {assignment.length > 0 ? (
          <div className="flex justify-center">
            <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)`, gap: `${tableGap}px` }}>
              {assignment.map((people, i) => renderBanquetTable(i, people))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">宴会厅圆桌，{seatsPerTable} 人一桌，根据人数自动分配</p>
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
