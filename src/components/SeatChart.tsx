import { useState, useCallback, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, ArrowDownUp, ArrowLeftRight, Columns, Rows, Grid3X3, Shuffle, BookOpen, X, ArrowRightLeft, Plus, Minus } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';

type SeatMode = 'verticalS' | 'horizontalS' | 'groupCol' | 'groupRow' | 'smartCluster' | 'random' | 'exam';
type StartFrom = 'door' | 'window';

const MODES: { id: SeatMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'verticalS', label: '竖S形', icon: <ArrowDownUp className="w-3.5 h-3.5" />, desc: '按列蛇形排列' },
  { id: 'horizontalS', label: '横S形', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, desc: '按行蛇形排列' },
  { id: 'groupCol', label: '每组一列', icon: <Columns className="w-3.5 h-3.5" />, desc: '同组学生在同一列' },
  { id: 'groupRow', label: '每组一排', icon: <Rows className="w-3.5 h-3.5" />, desc: '同组学生在同一行' },
  { id: 'smartCluster', label: '智能集中', icon: <Grid3X3 className="w-3.5 h-3.5" />, desc: '各组紧凑相邻排列' },
  { id: 'random', label: '随机排座', icon: <Shuffle className="w-3.5 h-3.5" />, desc: '完全随机打乱' },
  { id: 'exam', label: '考试座位', icon: <BookOpen className="w-3.5 h-3.5" />, desc: '按名单竖S形隔行入座' },
];

export default function SeatChart() {
  const { students } = useStudents();
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(8);
  const [seats, setSeats] = useState<(string | null)[][]>([]);
  const [mode, setMode] = useState<SeatMode>('verticalS');
  const [groupCount, setGroupCount] = useState(4);
  const [disabledSeats, setDisabledSeats] = useState<Set<string>>(new Set());
  const [examSkipRow, setExamSkipRow] = useState(true);
  const [examSkipCol, setExamSkipCol] = useState(false);
  const [dragFrom, setDragFrom] = useState<{ r: number; c: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ r: number; c: number } | null>(null);
  const [windowOnLeft, setWindowOnLeft] = useState(true);
  const [startFrom, setStartFrom] = useState<StartFrom>('door');

  // Aisle state: indices after which an aisle is inserted
  const [colAisles, setColAisles] = useState<number[]>([]);
  const [rowAisles, setRowAisles] = useState<number[]>([]);
  const [draggingAisle, setDraggingAisle] = useState<{ type: 'row' | 'col'; index: number } | null>(null);

  const seatKey = (r: number, c: number) => `${r}-${c}`;

  const toggleDisabled = (r: number, c: number) => {
    const key = seatKey(r, c);
    setDisabledSeats(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setSeats(s => {
          const g = s.map(row => [...row]);
          if (g[r]) g[r][c] = null;
          return g;
        });
      }
      return next;
    });
  };

  const makeGrid = (): (string | null)[][] =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

  const getColOrder = useCallback(() => {
    const doorOnRight = windowOnLeft;
    const startFromRight = (startFrom === 'door' && doorOnRight) || (startFrom === 'window' && !doorOnRight);
    if (startFromRight) {
      return Array.from({ length: cols }, (_, i) => cols - 1 - i);
    }
    return Array.from({ length: cols }, (_, i) => i);
  }, [cols, startFrom, windowOnLeft]);

  const autoSeat = useCallback(() => {
    const grid = makeGrid();
    const names = students.map(s => s.name);
    const isAvailable = (r: number, c: number) => !disabledSeats.has(seatKey(r, c));
    const colOrder = getColOrder();

    switch (mode) {
      case 'verticalS': {
        let idx = 0;
        for (let ci = 0; ci < cols && idx < names.length; ci++) {
          const c = colOrder[ci];
          for (let r = 0; r < rows && idx < names.length; r++) {
            const row = ci % 2 === 0 ? r : rows - 1 - r;
            if (isAvailable(row, c)) grid[row][c] = names[idx++];
          }
        }
        break;
      }
      case 'horizontalS': {
        let idx = 0;
        for (let r = 0; r < rows && idx < names.length; r++) {
          for (let ci = 0; ci < cols && idx < names.length; ci++) {
            const rawCol = r % 2 === 0 ? ci : cols - 1 - ci;
            const c = colOrder[rawCol];
            if (isAvailable(r, c)) grid[r][c] = names[idx++];
          }
        }
        break;
      }
      case 'exam': {
        let idx = 0;
        for (let ci = 0; ci < cols && idx < names.length; ci++) {
          const c = colOrder[ci];
          if (examSkipCol && ci % 2 !== 0) continue;
          for (let r = 0; r < rows && idx < names.length; r++) {
            const row = ci % 2 === 0 ? r : rows - 1 - r;
            if (examSkipRow && row % 2 !== 0) continue;
            if (isAvailable(row, c)) grid[row][c] = names[idx++];
          }
        }
        break;
      }
      case 'groupCol': {
        const groups = splitIntoGroups(names, groupCount);
        groups.forEach((group, gi) => {
          const colIdx = gi % cols;
          const c = colOrder[colIdx];
          let placed = 0;
          for (let r = 0; r < rows && placed < group.length; r++) {
            const row = r + Math.floor(gi / cols) * Math.ceil(names.length / groupCount);
            if (row < rows && isAvailable(row, c)) {
              grid[row][c] = group[placed++];
            }
          }
        });
        break;
      }
      case 'groupRow': {
        const groups = splitIntoGroups(names, groupCount);
        groups.forEach((group, gi) => {
          const row = gi % rows;
          let placed = 0;
          for (let ci = 0; ci < cols && placed < group.length; ci++) {
            const c = colOrder[ci];
            const colShift = ci + Math.floor(gi / rows) * Math.ceil(names.length / groupCount);
            if (row < rows && colShift < cols && isAvailable(row, c)) {
              grid[row][c] = group[placed++];
            }
          }
        });
        break;
      }
      case 'smartCluster': {
        const groups = splitIntoGroups(names, groupCount);
        const blocksPerRow = Math.ceil(Math.sqrt(groupCount));
        const blockRows = Math.ceil(groupCount / blocksPerRow);
        const blockH = Math.floor(rows / blockRows);
        const blockW = Math.floor(cols / blocksPerRow);

        groups.forEach((group, gi) => {
          const bRow = Math.floor(gi / blocksPerRow);
          const bCol = gi % blocksPerRow;
          const startR = bRow * blockH;
          const startC = bCol * blockW;
          let placed = 0;
          for (let mi = 0; placed < group.length; mi++) {
            const lr = mi % blockH;
            const lc = Math.floor(mi / blockH);
            const r = startR + lr;
            const c = startC + lc;
            if (r >= rows || c >= cols) break;
            if (isAvailable(r, c)) grid[r][c] = group[placed++];
          }
        });
        break;
      }
      case 'random': {
        const shuffled = [...names].sort(() => Math.random() - 0.5);
        let idx = 0;
        for (let r = 0; r < rows && idx < shuffled.length; r++) {
          for (let c = 0; c < cols && idx < shuffled.length; c++) {
            if (isAvailable(r, c)) grid[r][c] = shuffled[idx++];
          }
        }
        break;
      }
    }

    setSeats(grid);
  }, [students, rows, cols, mode, groupCount, disabledSeats, examSkipRow, examSkipCol, getColOrder]);

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

  // Aisle management
  const addColAisle = () => {
    // Add aisle after the middle column by default
    const mid = Math.floor(cols / 2) - 1;
    const candidate = colAisles.includes(mid) ? findNextFree(mid, cols - 1, colAisles) : mid;
    if (candidate !== null) setColAisles(prev => [...prev, candidate].sort((a, b) => a - b));
  };

  const addRowAisle = () => {
    const mid = Math.floor(rows / 2) - 1;
    const candidate = rowAisles.includes(mid) ? findNextFree(mid, rows - 1, rowAisles) : mid;
    if (candidate !== null) setRowAisles(prev => [...prev, candidate].sort((a, b) => a - b));
  };

  const removeColAisle = (idx: number) => {
    setColAisles(prev => prev.filter(a => a !== idx));
  };

  const removeRowAisle = (idx: number) => {
    setRowAisles(prev => prev.filter(a => a !== idx));
  };

  // Aisle drag to reposition
  const handleAisleDragStart = (e: React.DragEvent, type: 'row' | 'col', index: number) => {
    e.stopPropagation();
    setDraggingAisle({ type, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAisleDragOver = (e: React.DragEvent) => {
    if (draggingAisle) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleAisleDropOnGap = (e: React.DragEvent, type: 'row' | 'col', newIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingAisle || draggingAisle.type !== type) return;
    const oldIndex = draggingAisle.index;
    if (oldIndex === newIndex) { setDraggingAisle(null); return; }

    if (type === 'col') {
      setColAisles(prev => {
        const next = prev.filter(a => a !== oldIndex);
        if (!next.includes(newIndex)) next.push(newIndex);
        return next.sort((a, b) => a - b);
      });
    } else {
      setRowAisles(prev => {
        const next = prev.filter(a => a !== oldIndex);
        if (!next.includes(newIndex)) next.push(newIndex);
        return next.sort((a, b) => a - b);
      });
    }
    setDraggingAisle(null);
  };

  const handleAisleDragEnd = () => {
    setDraggingAisle(null);
  };

  const needsGroupCount = ['groupCol', 'groupRow', 'smartCluster'].includes(mode);
  const isExamMode = mode === 'exam';
  const printRef = useRef<HTMLDivElement>(null);

  // Build the visual grid with aisles inserted
  const buildVisualGrid = () => {
    if (seats.length === 0) return null;

    const elements: React.ReactNode[] = [];
    // Total visual columns = cols + colAisles.length
    const totalVisualCols = cols + colAisles.length;

    // Map real col index to visual col index
    const realToVisualCol = (realCol: number) => {
      let offset = 0;
      for (const a of colAisles) {
        if (realCol > a) offset++;
      }
      return realCol + offset;
    };

    // Render rows with row aisles
    for (let ri = 0; ri < rows; ri++) {
      // Render seat cells for this row
      for (let ci = 0; ci < cols; ci++) {
        const visualCol = realToVisualCol(ci);
        const name = seats[ri]?.[ci] ?? null;
        const isDragging = dragFrom?.r === ri && dragFrom?.c === ci;
        const isOver = dropTarget?.r === ri && dropTarget?.c === ci;
        const isDisabled = disabledSeats.has(seatKey(ri, ci));

        elements.push(
          <div
            key={`seat-${ri}-${ci}`}
            draggable={!!name && !isDisabled}
            onDragStart={() => handleDragStart(ri, ci)}
            onDragOver={e => !isDisabled && handleDragOver(e, ri, ci)}
            onDrop={e => !isDisabled && handleDrop(e, ri, ci)}
            onDragEnd={handleDragEnd}
            onClick={() => !name && toggleDisabled(ri, ci)}
            style={{ gridRow: getVisualRow(ri, rowAisles) + 1, gridColumn: visualCol + 1 }}
            className={`w-16 h-12 rounded-lg border text-xs flex items-center justify-center transition-all select-none
              ${isDisabled
                ? 'bg-destructive/10 border-destructive/30 text-destructive cursor-pointer'
                : name
                  ? `bg-card border-border text-foreground shadow-card cursor-grab active:cursor-grabbing hover:border-primary/40
                     ${isDragging ? 'opacity-30 scale-90' : ''}
                     ${isOver ? 'ring-2 ring-primary/40 border-primary/40 scale-105' : ''}`
                  : `bg-muted/50 border-dashed border-border text-muted-foreground cursor-pointer hover:border-destructive/40
                     ${isOver && dragFrom ? 'ring-2 ring-primary/30 border-primary/30' : ''}`
              }`}
          >
            {isDisabled ? <X className="w-4 h-4" /> : name || '空'}
          </div>
        );
      }

      // Render column aisle cells for this row
      for (const aisleAfterCol of colAisles) {
        const visualCol = aisleAfterCol + colAisles.filter(a => a < aisleAfterCol).length + 1;
        elements.push(
          <div
            key={`col-aisle-${ri}-${aisleAfterCol}`}
            draggable
            onDragStart={e => handleAisleDragStart(e, 'col', aisleAfterCol)}
            onDragEnd={handleAisleDragEnd}
            style={{ gridRow: getVisualRow(ri, rowAisles) + 1, gridColumn: visualCol + 1 }}
            className="w-16 h-12 flex items-center justify-center cursor-grab active:cursor-grabbing group"
            title="拖动调整过道位置，双击删除"
            onDoubleClick={() => removeColAisle(aisleAfterCol)}
          >
            <div className="w-0.5 h-8 bg-border group-hover:bg-primary/40 rounded transition-colors" />
          </div>
        );
      }

      // If there's a row aisle after this row, render the aisle row
      if (rowAisles.includes(ri)) {
        const aisleVisualRow = getVisualRow(ri, rowAisles) + 2; // +1 for current row, +1 for 1-indexed
        for (let ci = 0; ci < totalVisualCols; ci++) {
          elements.push(
            <div
              key={`row-aisle-${ri}-${ci}`}
              draggable={ci === 0}
              onDragStart={ci === 0 ? (e => handleAisleDragStart(e, 'row', ri)) : undefined}
              onDragEnd={ci === 0 ? handleAisleDragEnd : undefined}
              style={{ gridRow: aisleVisualRow, gridColumn: ci + 1 }}
              className={`w-16 h-12 flex items-center justify-center ${ci === 0 ? 'cursor-grab active:cursor-grabbing' : ''} group`}
              title={ci === 0 ? '拖动调整过道位置，双击删除' : undefined}
              onDoubleClick={ci === 0 ? () => removeRowAisle(ri) : undefined}
            >
              <div className="w-8 h-0.5 bg-border group-hover:bg-primary/40 rounded transition-colors" />
            </div>
          );
        }
      }
    }

    // Drop zones for repositioning aisles
    if (draggingAisle?.type === 'col') {
      for (let ci = 0; ci < cols - 1; ci++) {
        if (colAisles.includes(ci) && ci !== draggingAisle.index) continue;
        const visualCol = realToVisualCol(ci);
        // Overlay between visualCol and visualCol+1
        elements.push(
          <div
            key={`col-drop-${ci}`}
            onDragOver={handleAisleDragOver}
            onDrop={e => handleAisleDropOnGap(e, 'col', ci)}
            style={{
              gridRow: `1 / -1`,
              gridColumn: colAisles.includes(ci) ? visualCol + 2 : visualCol + 1,
              pointerEvents: 'all',
            }}
            className={`w-16 z-10 ${ci === draggingAisle.index ? '' : 'bg-primary/10 border-2 border-dashed border-primary/30 rounded-lg'}`}
          />
        );
      }
    }

    if (draggingAisle?.type === 'row') {
      for (let ri = 0; ri < rows - 1; ri++) {
        if (rowAisles.includes(ri) && ri !== draggingAisle.index) continue;
        const visualRow = getVisualRow(ri, rowAisles);
        elements.push(
          <div
            key={`row-drop-${ri}`}
            onDragOver={handleAisleDragOver}
            onDrop={e => handleAisleDropOnGap(e, 'row', ri)}
            style={{
              gridRow: visualRow + 1,
              gridColumn: `1 / -1`,
              pointerEvents: 'all',
            }}
            className={`h-12 z-10 ${ri === draggingAisle.index ? '' : 'bg-primary/10 border-2 border-dashed border-primary/30 rounded-lg'}`}
          />
        );
      }
    }

    const totalVisualRows = rows + rowAisles.length;

    return (
      <div
        className="inline-grid gap-1.5 relative"
        style={{
          gridTemplateColumns: `repeat(${totalVisualCols}, 4rem)`,
          gridTemplateRows: `repeat(${totalVisualRows}, 3rem)`,
        }}
      >
        {elements}
      </div>
    );
  };

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">座位安排</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              自定义教室布局，多种排座模式，支持拖拽交换座位和过道设置
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
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
            {isExamMode && (
              <>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={examSkipRow} onChange={e => setExamSkipRow(e.target.checked)} className="accent-primary" />
                  隔行
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={examSkipCol} onChange={e => setExamSkipCol(e.target.checked)} className="accent-primary" />
                  隔列
                </label>
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              起始
              <select
                value={startFrom}
                onChange={e => setStartFrom(e.target.value as StartFrom)}
                className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
              >
                <option value="door">靠门开始</option>
                <option value="window">靠窗开始</option>
              </select>
            </label>
          </div>
        </div>

        {/* Mode selector + Aisle buttons */}
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

          <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
            <Button variant="outline" size="sm" onClick={addColAisle} className="gap-1 text-xs h-8" title="添加列过道">
              <Plus className="w-3 h-3" /> 列过道
            </Button>
            <Button variant="outline" size="sm" onClick={addRowAisle} className="gap-1 text-xs h-8" title="添加行过道">
              <Plus className="w-3 h-3" /> 行过道
            </Button>
          </div>

          {seats.length > 0 && <ExportButtons targetRef={printRef} filename="座位表" />}
          <Button onClick={autoSeat} className="gap-2 ml-auto">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
        </div>

        {/* Aisle indicators */}
        {(colAisles.length > 0 || rowAisles.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {colAisles.map(a => (
              <span key={`ca-${a}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                列过道 (第{a + 1}列后)
                <button onClick={() => removeColAisle(a)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {rowAisles.map(a => (
              <span key={`ra-${a}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                行过道 (第{a + 1}行后)
                <button onClick={() => removeRowAisle(a)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}

        <div ref={printRef}>
          {/* Podium with window/door */}
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="text-lg cursor-default select-none" title={windowOnLeft ? '窗户' : '门'}>
              {windowOnLeft ? '🪟' : '🚪'}
            </div>
            <div className="bg-primary/10 text-primary px-8 py-2 rounded-lg text-sm font-medium border border-primary/20">
              🏫 讲 台
            </div>
            <div className="text-lg cursor-default select-none" title={windowOnLeft ? '门' : '窗户'}>
              {windowOnLeft ? '🚪' : '🪟'}
            </div>
            <button
              onClick={() => setWindowOnLeft(prev => !prev)}
              className="ml-1 p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="对换门窗位置"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Seat Grid with side markers */}
          {seats.length > 0 ? (
            <div className="flex justify-center items-stretch gap-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <span className="[writing-mode:vertical-rl] tracking-widest">{windowOnLeft ? '🪟 窗户侧' : '🚪 门侧'}</span>
              </div>
              {buildVisualGrid()}
              <div className="flex items-center text-sm text-muted-foreground">
                <span className="[writing-mode:vertical-rl] tracking-widest">{windowOnLeft ? '🚪 门侧' : '🪟 窗户侧'}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg mb-2">选择排座模式后点击「自动排座」</p>
              <p className="text-sm">支持竖S形、横S形、按组排列、考试隔行等多种模式，可拖拽交换座位</p>
            </div>
          )}
        </div>

        {/* Legend */}
        {seats.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            💡 拖拽学生交换座位 · 点击空座位可禁用/启用 · 拖动过道线可调整位置 · 双击过道线可删除
          </p>
        )}
      </div>
    </div>
  );
}

function getVisualRow(realRow: number, rowAisles: number[]): number {
  let offset = 0;
  for (const a of rowAisles) {
    if (realRow > a) offset++;
  }
  return realRow + offset;
}

function findNextFree(start: number, max: number, existing: number[]): number | null {
  for (let i = start; i < max; i++) {
    if (!existing.includes(i)) return i;
  }
  for (let i = 0; i < start; i++) {
    if (!existing.includes(i)) return i;
  }
  return null;
}

function splitIntoGroups(names: string[], count: number): string[][] {
  const groups: string[][] = Array.from({ length: count }, () => []);
  names.forEach((n, i) => groups[i % count].push(n));
  return groups;
}
