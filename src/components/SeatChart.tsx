import { useState, useCallback, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, ArrowDownUp, ArrowLeftRight, Columns, Rows, Grid3X3, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';

type SeatMode = 'verticalS' | 'horizontalS' | 'groupCol' | 'groupRow' | 'smartCluster' | 'random';

const MODES: { id: SeatMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'verticalS', label: '竖S形', icon: <ArrowDownUp className="w-3.5 h-3.5" />, desc: '按列蛇形排列' },
  { id: 'horizontalS', label: '横S形', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, desc: '按行蛇形排列' },
  { id: 'groupCol', label: '每组一列', icon: <Columns className="w-3.5 h-3.5" />, desc: '同组学生在同一列' },
  { id: 'groupRow', label: '每组一排', icon: <Rows className="w-3.5 h-3.5" />, desc: '同组学生在同一行' },
  { id: 'smartCluster', label: '智能集中', icon: <Grid3X3 className="w-3.5 h-3.5" />, desc: '各组紧凑相邻排列' },
  { id: 'random', label: '随机排座', icon: <Shuffle className="w-3.5 h-3.5" />, desc: '完全随机打乱' },
];

export default function SeatChart() {
  const { students } = useStudents();
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(6);
  const [seats, setSeats] = useState<(string | null)[][]>([]);
  const [mode, setMode] = useState<SeatMode>('verticalS');
  const [groupCount, setGroupCount] = useState(4);
  const [dragFrom, setDragFrom] = useState<{ r: number; c: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ r: number; c: number } | null>(null);

  const makeGrid = (): (string | null)[][] =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

  const autoSeat = useCallback(() => {
    const grid = makeGrid();
    const names = students.map(s => s.name);

    switch (mode) {
      case 'verticalS': {
        let idx = 0;
        for (let c = 0; c < cols && idx < names.length; c++) {
          for (let r = 0; r < rows && idx < names.length; r++) {
            const row = c % 2 === 0 ? r : rows - 1 - r;
            grid[row][c] = names[idx++];
          }
        }
        break;
      }
      case 'horizontalS': {
        let idx = 0;
        for (let r = 0; r < rows && idx < names.length; r++) {
          for (let c = 0; c < cols && idx < names.length; c++) {
            const col = r % 2 === 0 ? c : cols - 1 - c;
            grid[r][col] = names[idx++];
          }
        }
        break;
      }
      case 'groupCol': {
        // Split into groups then fill each group into a column
        const groups = splitIntoGroups(names, groupCount);
        groups.forEach((group, gi) => {
          const col = gi % cols;
          group.forEach((name, mi) => {
            const row = mi + Math.floor(gi / cols) * Math.ceil(names.length / groupCount);
            if (row < rows && col < cols) grid[row][col] = name;
          });
        });
        break;
      }
      case 'groupRow': {
        const groups = splitIntoGroups(names, groupCount);
        groups.forEach((group, gi) => {
          const row = gi % rows;
          group.forEach((name, mi) => {
            const col = mi + Math.floor(gi / rows) * Math.ceil(names.length / groupCount);
            if (row < rows && col < cols) grid[row][col] = name;
          });
        });
        break;
      }
      case 'smartCluster': {
        const groups = splitIntoGroups(names, groupCount);
        // Arrange groups in a grid of blocks
        const blocksPerRow = Math.ceil(Math.sqrt(groupCount));
        const blockRows = Math.ceil(groupCount / blocksPerRow);
        const blockH = Math.floor(rows / blockRows);
        const blockW = Math.floor(cols / blocksPerRow);

        groups.forEach((group, gi) => {
          const bRow = Math.floor(gi / blocksPerRow);
          const bCol = gi % blocksPerRow;
          const startR = bRow * blockH;
          const startC = bCol * blockW;
          group.forEach((name, mi) => {
            const lr = mi % blockH;
            const lc = Math.floor(mi / blockH);
            const r = startR + lr;
            const c = startC + lc;
            if (r < rows && c < cols) grid[r][c] = name;
          });
        });
        break;
      }
      case 'random': {
        const shuffled = [...names].sort(() => Math.random() - 0.5);
        let idx = 0;
        for (let r = 0; r < rows && idx < shuffled.length; r++) {
          for (let c = 0; c < cols && idx < shuffled.length; c++) {
            grid[r][c] = shuffled[idx++];
          }
        }
        break;
      }
    }

    setSeats(grid);
  }, [students, rows, cols, mode, groupCount]);

  // Drag and drop for seat swapping
  const handleDragStart = (r: number, c: number) => {
    if (!seats[r][c]) return;
    setDragFrom({ r, c });
  };

  const handleDragOver = (e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ r, c });
  };

  const handleDrop = (e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    if (!dragFrom) return;

    setSeats(prev => {
      const next = prev.map(row => [...row]);
      // Swap
      const temp = next[r][c];
      next[r][c] = next[dragFrom.r][dragFrom.c];
      next[dragFrom.r][dragFrom.c] = temp;
      return next;
    });

    setDragFrom(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragFrom(null);
    setDropTarget(null);
  };

  const needsGroupCount = ['groupCol', 'groupRow', 'smartCluster'].includes(mode);

  const printRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">座位安排</h2>
            <p className="text-sm text-muted-foreground mt-1">
              自定义教室布局，多种排座模式，支持拖拽交换座位
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              行
              <Input type="number" min={2} max={12} value={rows}
                onChange={e => setRows(Math.max(2, Math.min(12, Number(e.target.value))))} className="w-14 h-8 text-center" />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              列
              <Input type="number" min={2} max={12} value={cols}
                onChange={e => setCols(Math.max(2, Math.min(12, Number(e.target.value))))} className="w-14 h-8 text-center" />
            </label>
            {needsGroupCount && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                组数
                <Input type="number" min={2} max={10} value={groupCount}
                  onChange={e => setGroupCount(Math.max(2, Math.min(10, Number(e.target.value))))} className="w-14 h-8 text-center" />
              </label>
            )}
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex flex-wrap gap-2 mb-5">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
                ${mode === m.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                }`}
              title={m.desc}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
          {seats.length > 0 && <ExportButtons targetRef={printRef} filename="座位表" />}
          <Button onClick={autoSeat} className="gap-2 ml-auto">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
        </div>

        <div ref={printRef}>
          {/* Podium */}
          <div className="mb-4 text-center">
            <div className="inline-block bg-primary/10 text-primary px-8 py-2 rounded-lg text-sm font-medium border border-primary/20">
              🏫 讲 台
            </div>
          </div>

        {/* Seat Grid */}
        {seats.length > 0 ? (
          <div className="flex justify-center">
            <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {seats.flatMap((row, ri) =>
                row.map((name, ci) => {
                  const isDragging = dragFrom?.r === ri && dragFrom?.c === ci;
                  const isOver = dropTarget?.r === ri && dropTarget?.c === ci;
                  return (
                    <div
                      key={`${ri}-${ci}`}
                      draggable={!!name}
                      onDragStart={() => handleDragStart(ri, ci)}
                      onDragOver={e => handleDragOver(e, ri, ci)}
                      onDrop={e => handleDrop(e, ri, ci)}
                      onDragEnd={handleDragEnd}
                      className={`w-16 h-12 rounded-lg border text-xs flex items-center justify-center transition-all select-none
                        ${name
                          ? `bg-card border-border text-foreground shadow-card cursor-grab active:cursor-grabbing hover:border-primary/40
                             ${isDragging ? 'opacity-30 scale-90' : ''}
                             ${isOver ? 'ring-2 ring-primary/40 border-primary/40 scale-105' : ''}`
                          : `bg-muted/50 border-dashed border-border text-muted-foreground
                             ${isOver && dragFrom ? 'ring-2 ring-primary/30 border-primary/30' : ''}`
                        }`}
                    >
                      {name || '空'}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">选择排座模式后点击「自动排座」</p>
            <p className="text-sm">支持竖S形、横S形、按组排列、随机等多种模式，可拖拽交换座位</p>
          </div>
        )}
        </div>

        {/* Legend */}
        {seats.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            💡 拖拽任意学生到其他座位可交换位置
          </p>
        )}
      </div>
    </div>
  );
}

function splitIntoGroups(names: string[], count: number): string[][] {
  const groups: string[][] = Array.from({ length: count }, () => []);
  names.forEach((n, i) => groups[i % count].push(n));
  return groups;
}
