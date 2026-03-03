import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';

interface Props {
  students: { id: string; name: string }[];
}

export default function BanquetHall({ students }: Props) {
  const [seatsPerTable, setSeatsPerTable] = useState(10);
  const [tableCount, setTableCount] = useState(() => Math.ceil(students.length / 10) || 3);
  const [assignment, setAssignment] = useState<string[][]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

    const tables: string[][] = Array.from({ length: tableCount }, () => []);
    names.forEach((n, i) => {
      const ti = i % tableCount;
      if (tables[ti].length < seatsPerTable) tables[ti].push(n);
    });
    setAssignment(tables);
  };

  const tableCols = Math.ceil(Math.sqrt(tableCount));

  const renderBanquetTable = (tableIndex: number, people: string[]) => {
    const radius = 60;
    const seatRadius = 16;
    const cx = 85, cy = 85;
    const totalSlots = seatsPerTable;

    return (
      <div key={tableIndex} className="flex flex-col items-center">
        <svg width={170} height={170} viewBox="0 0 170 170">
          {/* Tablecloth decoration */}
          <circle cx={cx} cy={cy} r={42} className="fill-primary/5 stroke-primary/20" strokeWidth={1} strokeDasharray="4 2" />
          <circle cx={cx} cy={cy} r={36} className="fill-primary/10 stroke-primary/30" strokeWidth={2} />
          <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle" className="fill-primary text-[10px] font-medium">
            {tableIndex + 1}桌
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" className="fill-primary/60 text-[8px]">
            {people.length}人
          </text>
          {/* Seats */}
          {Array.from({ length: totalSlots }).map((_, i) => {
            const angle = (2 * Math.PI * i) / totalSlots - Math.PI / 2;
            const sx = cx + radius * Math.cos(angle);
            const sy = cy + radius * Math.sin(angle);
            const name = people[i] || '';
            return (
              <g key={i}>
                <circle cx={sx} cy={sy} r={seatRadius}
                  className={name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                  strokeWidth={1.5} />
                {name && (
                  <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[7px]">
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
    <div>
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
        {/* Banquet hall header */}
        <div className="text-center mb-4">
          <div className="inline-block bg-primary/10 text-primary px-6 py-2 rounded-lg text-sm font-medium border border-primary/20">
            🎪 宴会厅
          </div>
        </div>

        {assignment.length > 0 ? (
          <div className="flex justify-center">
            <div
              className="inline-grid gap-3"
              style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)` }}
            >
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
          💡 调整桌数和每桌人数后重新排座 · 桌数会根据总人数自动建议
        </p>
      )}
    </div>
  );
}
