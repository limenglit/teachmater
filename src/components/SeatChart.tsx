import { useState, useCallback, useRef, useEffect } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, ArrowDownUp, ArrowLeftRight, Columns, Rows, Grid3X3, Shuffle, BookOpen, X, ArrowRightLeft, Plus, Minus, PanelLeft, QrCode } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import SmartClassroom from '@/components/seating/SmartClassroom';
import ConferenceRoom from '@/components/seating/ConferenceRoom';
import ConcertHall from '@/components/seating/ConcertHall';
import BanquetHall from '@/components/seating/BanquetHall';
import ComputerLab from '@/components/seating/ComputerLab';

type SceneType = 'classroom' | 'smartClassroom' | 'conference' | 'concertHall' | 'banquet' | 'computerLab';
type SeatMode = 'verticalS' | 'horizontalS' | 'groupCol' | 'groupRow' | 'smartCluster' | 'random' | 'exam';
type StartFrom = 'door' | 'window';

const SCENES: { id: SceneType; label: string; desc: string }[] = [
  { id: 'classroom', label: '🏫 教室', desc: '传统教室网格布局' },
  { id: 'smartClassroom', label: '⭕ 智能教室', desc: '圆形桌分组讨论' },
  { id: 'conference', label: '📋 会议室', desc: '长条会议桌' },
  { id: 'concertHall', label: '🎵 音乐厅', desc: '半圆形围绕舞台' },
  { id: 'banquet', label: '🎪 宴会厅', desc: '圆桌宴会布局' },
  { id: 'computerLab', label: '💻 机房', desc: '长桌两侧对面坐' },
];

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
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [scene, setScene] = useState<SceneType>('classroom');
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
  const draggingAisleRef = useRef<{ type: 'row' | 'col'; index: number } | null>(null);
  const [pointerDraggingColAisle, setPointerDraggingColAisle] = useState<number | null>(null);
  const [pointerColDropTarget, setPointerColDropTarget] = useState<number | null>(null);

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

  const isRowFullyDisabled = useCallback((row: number) => {
    for (let c = 0; c < cols; c++) {
      if (!disabledSeats.has(seatKey(row, c))) return false;
    }
    return true;
  }, [cols, disabledSeats]);

  const isColFullyDisabled = useCallback((col: number) => {
    for (let r = 0; r < rows; r++) {
      if (!disabledSeats.has(seatKey(r, col))) return false;
    }
    return true;
  }, [rows, disabledSeats]);

  const toggleRowDisabled = useCallback((row: number) => {
    const closeAll = !isRowFullyDisabled(row);
    setDisabledSeats(prev => {
      const next = new Set(prev);
      for (let c = 0; c < cols; c++) {
        const key = seatKey(row, c);
        if (closeAll) next.add(key);
        else next.delete(key);
      }
      return next;
    });

    if (closeAll) {
      setSeats(prev => {
        const next = prev.map(r => [...r]);
        if (next[row]) {
          for (let c = 0; c < cols; c++) {
            next[row][c] = null;
          }
        }
        return next;
      });
    }
  }, [cols, isRowFullyDisabled]);

  const toggleColDisabled = useCallback((col: number) => {
    const closeAll = !isColFullyDisabled(col);
    setDisabledSeats(prev => {
      const next = new Set(prev);
      for (let r = 0; r < rows; r++) {
        const key = seatKey(r, col);
        if (closeAll) next.add(key);
        else next.delete(key);
      }
      return next;
    });

    if (closeAll) {
      setSeats(prev => {
        const next = prev.map(r => [...r]);
        for (let r = 0; r < rows; r++) {
          if (next[r]) next[r][col] = null;
        }
        return next;
      });
    }
  }, [isColFullyDisabled, rows]);

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

  const moveAisle = useCallback((type: 'row' | 'col', oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;

    if (type === 'col') {
      setColAisles(prev => {
        const next = prev.filter(a => a !== oldIndex);
        if (!next.includes(newIndex)) next.push(newIndex);
        return next.sort((a, b) => a - b);
      });
      return;
    }

    setRowAisles(prev => {
      const next = prev.filter(a => a !== oldIndex);
      if (!next.includes(newIndex)) next.push(newIndex);
      return next.sort((a, b) => a - b);
    });
  }, []);

  const pendingColAisleRef = useRef<number | null>(null);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearPointerColAisleDrag = useCallback(() => {
    pendingColAisleRef.current = null;
    pointerStartPosRef.current = null;
    setPointerDraggingColAisle(null);
    setPointerColDropTarget(null);
    draggingAisleRef.current = null;
    setDraggingAisle(null);
  }, []);

  const activateColAislePointerDrag = useCallback((index: number) => {
    pendingColAisleRef.current = null;
    const payload = { type: 'col' as const, index };
    draggingAisleRef.current = payload;
    setDraggingAisle(payload);
    setPointerDraggingColAisle(index);
    setPointerColDropTarget(index);
  }, []);

  const startColAislePointerDrag = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    pendingColAisleRef.current = index;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleColAisleDoubleClick = (e: React.MouseEvent, aisleIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    pendingColAisleRef.current = null;
    pointerStartPosRef.current = null;
    clearPointerColAisleDrag();
    removeColAisle(aisleIndex);
  };

  const finishColAislePointerDrag = useCallback((targetIndex?: number | null) => {
    if (pointerDraggingColAisle === null) {
      clearPointerColAisleDrag();
      return;
    }
    const resolvedTarget = targetIndex ?? pointerColDropTarget;
    if (resolvedTarget !== null && resolvedTarget !== undefined) {
      moveAisle('col', pointerDraggingColAisle, resolvedTarget);
    }
    clearPointerColAisleDrag();
  }, [clearPointerColAisleDrag, moveAisle, pointerColDropTarget, pointerDraggingColAisle]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (pendingColAisleRef.current !== null && pointerStartPosRef.current && pointerDraggingColAisle === null) {
        const dx = Math.abs(e.clientX - pointerStartPosRef.current.x);
        const dy = Math.abs(e.clientY - pointerStartPosRef.current.y);
        if (dx > 4 || dy > 4) {
          activateColAislePointerDrag(pendingColAisleRef.current);
        }
      }
    };
    const handleMouseUp = () => {
      if (pendingColAisleRef.current !== null && pointerDraggingColAisle === null) {
        pendingColAisleRef.current = null;
        pointerStartPosRef.current = null;
        return;
      }
      if (pointerDraggingColAisle !== null) {
        finishColAislePointerDrag();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearPointerColAisleDrag();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activateColAislePointerDrag, clearPointerColAisleDrag, finishColAislePointerDrag, pointerDraggingColAisle]);

  // Aisle drag to reposition (native drag fallback)
  const handleAisleDragStart = (e: React.DragEvent, type: 'row' | 'col', index: number) => {
    e.stopPropagation();
    const payload = { type, index };
    draggingAisleRef.current = payload;
    setDraggingAisle(payload);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${type}:${index}`);
  };

  const handleAisleDragOver = (e: React.DragEvent) => {
    if (draggingAisle || draggingAisleRef.current) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleAisleDropOnGap = (e: React.DragEvent, type: 'row' | 'col', newIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    let current = draggingAisle ?? draggingAisleRef.current;
    if (!current) {
      const raw = e.dataTransfer.getData('text/plain');
      const [dragType, dragIndex] = raw.split(':');
      if ((dragType === 'row' || dragType === 'col') && dragIndex !== undefined) {
        current = { type: dragType, index: Number(dragIndex) };
      }
    }

    if (!current || current.type !== type || Number.isNaN(current.index)) return;

    moveAisle(type, current.index, newIndex);

    draggingAisleRef.current = null;
    setDraggingAisle(null);
    if (type === 'col') {
      setPointerDraggingColAisle(null);
      setPointerColDropTarget(null);
    }
  };

  const handleAisleDragEnd = () => {
    setTimeout(() => {
      draggingAisleRef.current = null;
      setDraggingAisle(null);
      setPointerDraggingColAisle(null);
      setPointerColDropTarget(null);
    }, 0);
  };

  const needsGroupCount = ['groupCol', 'groupRow', 'smartCluster'].includes(mode);
  const isExamMode = mode === 'exam';
  const printRef = useRef<HTMLDivElement>(null);
  const sideIconClass = 'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-primary/30 bg-primary/10 text-base leading-none shadow-sm';

  // Build the visual grid with aisles inserted
  const buildVisualGrid = () => {
    if (seats.length === 0) return null;

    const elements: React.ReactNode[] = [];
    // Total visual columns = cols + colAisles.length
    const totalVisualCols = cols + colAisles.length;
    const doorOnRight = windowOnLeft;
    const seatAreaStartCol = doorOnRight ? 1 : 2;
    const rowLabelCol = doorOnRight ? totalVisualCols + 1 : 1;
    const seatAreaStartRow = 2;

    // Map real col index to visual col index
    const realToVisualCol = (realCol: number) => {
      let offset = 0;
      for (const a of colAisles) {
        if (realCol > a) offset++;
      }
      return realCol + offset;
    };

    const toGridCol = (visualCol: number) => seatAreaStartCol + visualCol;

    // Top header row: column labels
    for (let ci = 0; ci < cols; ci++) {
      const visualCol = realToVisualCol(ci);
      const displayCol = doorOnRight ? cols - ci : ci + 1;
      const colDisabled = isColFullyDisabled(ci);

      elements.push(
        <div
          key={`col-label-${ci}`}
          style={{ gridRow: 1, gridColumn: toGridCol(visualCol) }}
          className="w-16 h-12 flex items-center justify-center"
        >
          <button
            type="button"
            onClick={() => toggleColDisabled(ci)}
            className={`h-5 px-2 rounded-full text-[10px] leading-none whitespace-nowrap select-none border shadow-sm transition-colors ${colDisabled ? 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'}`}
            title={colDisabled ? '点击开放本列座位' : '点击禁用本列座位'}
          >
            第{displayCol}列
          </button>
        </div>
      );
    }

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
            onDragOver={e => {
              if (isDisabled) return;
              const raw = e.dataTransfer.getData('text/plain');
              const isAisleDrag = !!draggingAisle || !!draggingAisleRef.current || raw.startsWith('col:') || raw.startsWith('row:');
              if (isAisleDrag) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                return;
              }
              handleDragOver(e, ri, ci);
            }}
            onDrop={e => {
              if (isDisabled) return;

              const raw = e.dataTransfer.getData('text/plain');
              const [dragType, dragIndex] = raw.split(':');
              const parsedIndex = Number(dragIndex);
              const currentAisle = draggingAisle ?? draggingAisleRef.current;
              const isColAisleDrag = currentAisle?.type === 'col' || (dragType === 'col' && Number.isFinite(parsedIndex));
              const isAnyAisleDrag = !!currentAisle || dragType === 'col' || dragType === 'row';

              if (isColAisleDrag) {
                const targetIndex = Math.min(ci, cols - 2);
                handleAisleDropOnGap(e, 'col', targetIndex);
                return;
              }

              if (isAnyAisleDrag) {
                e.preventDefault();
                return;
              }

              handleDrop(e, ri, ci);
            }}
            onDragEnd={handleDragEnd}
            onClick={() => !name && toggleDisabled(ri, ci)}
            style={{ gridRow: getVisualRow(ri, rowAisles) + seatAreaStartRow, gridColumn: toGridCol(visualCol) }}
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

      const rowDisabled = isRowFullyDisabled(ri);
      elements.push(
        <div
          key={`row-label-${ri}`}
          style={{ gridRow: getVisualRow(ri, rowAisles) + seatAreaStartRow, gridColumn: rowLabelCol }}
          className="w-16 h-12 flex items-center justify-center"
        >
          <button
            type="button"
            onClick={() => toggleRowDisabled(ri)}
            className={`h-5 px-2 rounded-full text-[10px] leading-none whitespace-nowrap select-none border shadow-sm transition-colors ${rowDisabled ? 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'}`}
            title={rowDisabled ? '点击开放本行座位' : '点击禁用本行座位'}
          >
            第{ri + 1}行
          </button>
        </div>
      );

      // Render column aisle cells for this row
      for (const aisleAfterCol of colAisles) {
        const visualCol = aisleAfterCol + colAisles.filter(a => a < aisleAfterCol).length + 1;
        const isPointerDraggingThis = pointerDraggingColAisle === aisleAfterCol;

        elements.push(
          <div
            key={`col-aisle-${ri}-${aisleAfterCol}`}
            onMouseDown={e => startColAislePointerDrag(e, aisleAfterCol)}
            style={{ gridRow: getVisualRow(ri, rowAisles) + seatAreaStartRow, gridColumn: toGridCol(visualCol) }}
            className={`w-16 h-12 flex items-center justify-center transition-colors ${isPointerDraggingThis ? 'cursor-grabbing' : 'cursor-grab'} group`}
            title="按住并拖动调整过道位置，双击删除"
            onDoubleClick={e => handleColAisleDoubleClick(e, aisleAfterCol)}
          >
            <div className={`w-0.5 h-8 rounded transition-colors ${isPointerDraggingThis ? 'bg-primary' : 'bg-border group-hover:bg-primary/40'}`} />
          </div>
        );
      }

      // If there's a row aisle after this row, render the aisle row
      if (rowAisles.includes(ri)) {
        const aisleVisualRow = getVisualRow(ri, rowAisles) + seatAreaStartRow + 1;
        for (let ci = 0; ci < totalVisualCols; ci++) {
          elements.push(
            <div
              key={`row-aisle-${ri}-${ci}`}
              draggable={ci === 0}
              onDragStart={ci === 0 ? (e => handleAisleDragStart(e, 'row', ri)) : undefined}
              onDragEnd={ci === 0 ? handleAisleDragEnd : undefined}
              style={{ gridRow: aisleVisualRow, gridColumn: toGridCol(ci) }}
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
        const isPointerTarget = pointerDraggingColAisle !== null && pointerColDropTarget === ci;

        // Overlay between visualCol and visualCol+1
        elements.push(
          <div
            key={`col-drop-${ci}`}
            onDragOver={handleAisleDragOver}
            onDrop={e => handleAisleDropOnGap(e, 'col', ci)}
            onMouseEnter={() => {
              if (pointerDraggingColAisle !== null) setPointerColDropTarget(ci);
            }}
            onMouseUp={e => {
              if (pointerDraggingColAisle === null) return;
              e.preventDefault();
              finishColAislePointerDrag(ci);
            }}
            style={{
              gridRow: `${seatAreaStartRow} / -1`,
              gridColumn: toGridCol(colAisles.includes(ci) ? visualCol + 1 : visualCol),
              pointerEvents: 'all',
            }}
            className={`w-16 z-10 relative ${isPointerTarget ? 'bg-primary/20 border-2 border-dashed border-primary/60 rounded-lg' : ci === draggingAisle.index ? '' : 'bg-primary/10 border-2 border-dashed border-primary/30 rounded-lg'}`}
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
              gridRow: visualRow + seatAreaStartRow,
              gridColumn: `${seatAreaStartCol} / ${seatAreaStartCol + totalVisualCols}`,
              pointerEvents: 'all',
            }}
            className={`h-12 z-10 relative ${ri === draggingAisle.index ? '' : 'bg-primary/10 border-2 border-dashed border-primary/30 rounded-lg'}`}
          />
        );
      }
    }

    const totalVisualRows = rows + rowAisles.length + 1;

    return (
      <div
        className="inline-grid gap-1.5 relative"
        style={{
          gridTemplateColumns: `repeat(${totalVisualCols + 1}, 4rem)`,
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
        {/* Scene selector */}
        <div className="flex flex-wrap gap-2 mb-5">
          {SCENES.map(s => (
            <button
              key={s.id}
              onClick={() => setScene(s.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border
                ${scene === s.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                }`}
              title={s.desc}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Non-classroom scenes */}
        {scene === 'smartClassroom' && <SmartClassroom students={students} />}
        {scene === 'conference' && <ConferenceRoom students={students} />}
        {scene === 'concertHall' && <ConcertHall students={students} />}
        {scene === 'banquet' && <BanquetHall students={students} />}
        {scene === 'computerLab' && <ComputerLab students={students} />}

        {/* Classroom scene - original layout */}
        {scene === 'classroom' && (<>
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
          {seats.length > 0 && (
            <Button variant="outline" onClick={() => setCheckinOpen(true)} className="gap-2">
              <QrCode className="w-4 h-4" /> 签到
            </Button>
          )}
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
            <div className="cursor-default select-none" title={windowOnLeft ? '窗户' : '门'}>
              {windowOnLeft ? <span className={sideIconClass}>🪟</span> : <span className={sideIconClass}>🚪</span>}
            </div>
            <div className="bg-primary/10 text-primary px-8 py-2 rounded-lg text-sm font-medium border border-primary/20">
              🏫 讲 台
            </div>
            <div className="cursor-default select-none" title={windowOnLeft ? '门' : '窗户'}>
              {windowOnLeft ? <span className={sideIconClass}>🚪</span> : <span className={sideIconClass}>🪟</span>}
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
                <span className="[writing-mode:vertical-rl] tracking-widest">{windowOnLeft ? '▢ 窗户侧' : '🚪 门侧'}</span>
              </div>
              {buildVisualGrid()}
              <div className="flex items-center text-sm text-muted-foreground">
                <span className="[writing-mode:vertical-rl] tracking-widest">{windowOnLeft ? '🚪 门侧' : '▢ 窗户侧'}</span>
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
        <SeatCheckinDialog
          open={checkinOpen}
          onOpenChange={setCheckinOpen}
          seatData={seats}
          studentNames={students.map(s => s.name)}
          sceneType="classroom"
          sceneConfig={{
            rows,
            cols,
            windowOnLeft,
            colAisles,
            rowAisles,
          }}
        />
        </>)}
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
