import { useState, useMemo } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react';

export default function SeatChart() {
  const { students } = useStudents();
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(6);
  const [seats, setSeats] = useState<(string | null)[][]>([]);

  const autoSeat = () => {
    const grid: (string | null)[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => null)
    );
    // S-shape vertical fill
    let idx = 0;
    for (let c = 0; c < cols && idx < students.length; c++) {
      const isEven = c % 2 === 0;
      for (let r = 0; r < rows && idx < students.length; r++) {
        const row = isEven ? r : rows - 1 - r;
        grid[row][c] = students[idx].name;
        idx++;
      }
    }
    setSeats(grid);
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">座位安排</h2>
            <p className="text-sm text-muted-foreground mt-1">自定义教室布局，自动排座</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              行
              <Input type="number" min={2} max={12} value={rows}
                onChange={e => setRows(Number(e.target.value))} className="w-14 h-8 text-center" />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              列
              <Input type="number" min={2} max={12} value={cols}
                onChange={e => setCols(Number(e.target.value))} className="w-14 h-8 text-center" />
            </label>
            <Button onClick={autoSeat} className="gap-2">
              <LayoutGrid className="w-4 h-4" /> 自动排座
            </Button>
          </div>
        </div>

        {/* Podium */}
        <div className="mb-4 text-center">
          <div className="inline-block bg-primary/10 text-primary px-8 py-2 rounded-lg text-sm font-medium border border-primary/20">
            🏫 讲 台
          </div>
        </div>

        {/* Seat Grid */}
        {seats.length > 0 ? (
          <div className="flex justify-center">
            <div className="inline-grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {seats.flatMap((row, ri) =>
                row.map((name, ci) => (
                  <div
                    key={`${ri}-${ci}`}
                    className={`w-16 h-12 rounded-lg border text-xs flex items-center justify-center transition-colors
                      ${name
                        ? 'bg-card border-border text-foreground shadow-card hover:border-primary/40'
                        : 'bg-muted/50 border-dashed border-border text-muted-foreground'
                      }`}
                  >
                    {name || '空'}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">设置行列后点击「自动排座」</p>
            <p className="text-sm">支持竖S形排列</p>
          </div>
        )}
      </div>
    </div>
  );
}
