import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import { useRoundTableDrag } from './useRoundTableDrag';

interface Props {
  students: { id: string; name: string }[];
}

export default function SmartClassroom({ students }: Props) {
  const [seatsPerTable, setSeatsPerTable] = useState(6);
  const [tableCount, setTableCount] = useState(() => Math.ceil(students.length / 6) || 4);
  const [assignment, setAssignment] = useState<string[][]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const { dragFrom, dropTarget, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useRoundTableDrag(assignment, setAssignment);

  const autoSeat = () => {
    const names = students.map(s => s.name);
    const tables: string[][] = Array.from({ length: tableCount }, () => []);
    names.forEach((n, i) => {
      const ti = i % tableCount;
      if (tables[ti].length < seatsPerTable) tables[ti].push(n);
    });
    setAssignment(tables);
  };

  const shuffleSeat = () => {
    const names = [...students.map(s => s.name)].sort(() => Math.random() - 0.5);
    const tables: string[][] = Array.from({ length: tableCount }, () => []);
    names.forEach((n, i) => {
      const ti = i % tableCount;
      if (tables[ti].length < seatsPerTable) tables[ti].push(n);
    });
    setAssignment(tables);
  };

  const tableCols = Math.ceil(Math.sqrt(tableCount));

  const renderRoundTable = (tableIndex: number, people: string[]) => {
    const radius = 52;
    const seatRadius = 16;
    const cx = 80, cy = 80;
    const totalSlots = Math.max(seatsPerTable, people.length);

    return (
      <div key={tableIndex} className="flex flex-col items-center gap-1">
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
        {assignment.length > 0 && <ExportButtons targetRef={printRef} filename="智能教室座位" />}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={shuffleSeat} className="gap-2">
            <Shuffle className="w-4 h-4" /> 随机排座
          </Button>
          <Button onClick={autoSeat} className="gap-2">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
        </div>
      </div>

      <div ref={printRef}>
        {assignment.length > 0 ? (
          <div className="flex justify-center">
            <div className="inline-grid gap-4" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)` }}>
              {assignment.map((people, i) => renderRoundTable(i, people))}
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
