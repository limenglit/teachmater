import { useState, useRef, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle, QrCode, Save, RotateCcw, Trash2, Pencil } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import { useSeatExportQr } from './useSeatExportQr';
import ZoomControls, { useSceneZoom, useZoomGestures } from './ZoomControls';
import { toast } from 'sonner';
import {
  loadComputerLabSnapshot,
  saveComputerLabSnapshot,
  loadComputerLabHistory,
  saveComputerLabHistory,
  type ComputerLabHistoryItem,
  type ComputerLabRowAssignment,
  deleteSeatHistoryLocal,
  renameSeatHistoryLocal,
} from '@/lib/teamwork-local';
import { saveCloudSeatHistory, fetchCloudSeatHistory, migrateLocalToCloudOnce, deleteCloudSeatHistory, renameCloudSeatHistory } from '@/lib/seat-history-cloud';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  students: { id: string; name: string }[];
}

type LabSeatMode = 'balanced' | 'groupRow' | 'verticalS' | 'horizontalS';
type LabSeatSide = 'top' | 'bottom' | 'both';
type RefKey = 'window' | 'door' | 'blackboard';
type RefPositions = Record<RefKey, { x: number; y: number }>;
type RefVisible = Record<RefKey, boolean>;
const REF_BLACKBOARD_TOP = 12;

function getAutoRowCount(totalStudents: number, seatsPerSide: number, tableCols: number = 1, seatSide: LabSeatSide = 'both') {
  const sidesCount = seatSide === 'both' ? 2 : 1;
  const capacityPerRow = Math.max(1, seatsPerSide * sidesCount) * tableCols;
  return Math.max(1, Math.ceil(totalStudents / capacityPerRow));
}

function buildDefaultRefPositions(roomWidth: number, roomHeight: number): RefPositions {
  const badgeW = 90;
  const rightX = Math.max(24, roomWidth - badgeW - 24);
  const midY = Math.max(20, Math.round((roomHeight - 32) / 2));
  const centerX = Math.max(24, Math.round((roomWidth - badgeW) / 2));
  return {
    blackboard: { x: centerX, y: REF_BLACKBOARD_TOP },
    window: { x: 24, y: midY },
    door: { x: rightX, y: Math.max(140, roomHeight - 64) },
  };
}

export default function ComputerLab({ students }: Props) {
  const { t } = useLanguage();
  const [tableCols, setTableCols] = useState(1);
  const [rowCount, setRowCount] = useState(() => getAutoRowCount(students.length, 8, 1));
  const [seatsPerSide, setSeatsPerSide] = useState(8);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<LabSeatMode>('balanced');
  const [seatSide, setSeatSide] = useState<LabSeatSide>('both');
  const [autoRowCount, setAutoRowCount] = useState(true);
  const [tableGap, setTableGap] = useState(80);
  const [assignment, setAssignment] = useState<ComputerLabRowAssignment[]>([]);
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [recordName, setRecordName] = useState('');
  const [historyItems, setHistoryItems] = useState<ComputerLabHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [rowTransforms, setRowTransforms] = useState<{ x: number; y: number; rotation: number }[]>([]);
  const [seated, setSeated] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const [refVisible, setRefVisible] = useState<RefVisible>({
    blackboard: true,
    window: true,
    door: true,
  });
  const [refLocked, setRefLocked] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const refDraggingRef = useRef<{ key: RefKey; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const rowDraggingRef = useRef<{ row: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const seatDraggingRef = useRef(false);
  const restoredOnceRef = useRef(false);

  const seatW = 56;
  const seatH = 36;
  const gap = 4;
  const tableMargin = 20;
  const tableW = seatsPerSide * (seatW + gap) + gap;

  const colGap = 40;
  const allTableW = tableW * tableCols + colGap * (tableCols - 1);

  const dualSide = seatSide === 'both';
  const showTop = seatSide === 'top' || seatSide === 'both';
  const showBottom = seatSide === 'bottom' || seatSide === 'both';
  const minRowGap = dualSide ? 128 : 188;
  const rowGap = Math.max(tableGap, minRowGap);
  const maxRows = Math.max(...assignment.map(a => a.rowIndex), -1) + 1 || rowCount;

  const roomWidth = Math.max(980, allTableW + tableMargin * 2 + 220);
  const roomHeight = Math.max(760, maxRows * rowGap + 220);
  const zoom = useSceneZoom({ contentWidth: roomWidth, contentHeight: roomHeight });
  useZoomGestures({ setScale: zoom.setScale, targetRef: zoom.containerRef });
  const defaultRefPositions = useMemo(() => buildDefaultRefPositions(roomWidth, roomHeight), [roomWidth, roomHeight]);
  const [refPositions, setRefPositions] = useState<RefPositions>(() => buildDefaultRefPositions(980, 760));

  // Determine door position quadrant for student navigation
  const doorQuadrant = useMemo(() => {
    const doorPos = refPositions.door;
    const midX = roomWidth / 2;
    const midY = roomHeight / 2;
    const vPos = doorPos.y < midY ? 'top' : 'bottom';
    const hPos = doorPos.x < midX ? 'left' : 'right';
    return `${vPos}-${hPos}`;
  }, [refPositions.door, roomWidth, roomHeight]);

  const exportSceneConfig = { rowCount, seatsPerSide, dualSide, seatSide, tableCols, doorPosition: doorQuadrant };
  const { className: exportClassName, resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: assignment,
    studentNames: students.map(s => s.name),
    seatAssignmentReady: seated,
    sceneConfig: exportSceneConfig,
    sceneType: 'computerLab',
  });

  const refBadgeClass = 'absolute h-8 pl-2 pr-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm cursor-move select-none inline-flex items-center gap-1.5';
  const refIconClass = 'inline-flex items-center justify-center w-5 h-5 rounded-md border border-primary/30 bg-background/80 text-[11px] leading-none';
  const refTextClass = 'text-[11px] font-medium leading-none tracking-wide';

  const totalSeatsPerSide = seatsPerSide * tableCols;
  const seatKey = (row: number, side: 'top' | 'bottom', col: number) => `${row}-${side}-${col}`;

  const toggleSeatOpen = (row: number, side: 'top' | 'bottom', col: number) => {
    const key = seatKey(row, side, col);
    setClosedSeats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const splitIntoGroups = (names: string[], count: number) => {
    const groups: string[][] = Array.from({ length: count }, () => []);
    names.forEach((n, i) => groups[i % count].push(n));
    return groups;
  };

  const getSeatOrder = (seatMode: LabSeatMode) => {
    const slots: { row: number; side: 'top' | 'bottom'; col: number }[] = [];

    const pushSide = (row: number, side: 'top' | 'bottom', col: number) => {
      if (side === 'top' && !showTop) return;
      if (side === 'bottom' && !showBottom) return;
      slots.push({ row, side, col });
    };

    if (seatMode === 'verticalS') {
      for (let c = 0; c < totalSeatsPerSide; c++) {
        for (let ri = 0; ri < rowCount; ri++) {
          const row = c % 2 === 0 ? ri : rowCount - 1 - ri;
          if ((row + c) % 2 === 0) {
            pushSide(row, 'top', c);
            pushSide(row, 'bottom', c);
          } else {
            pushSide(row, 'bottom', c);
            pushSide(row, 'top', c);
          }
        }
      }
      return slots;
    }

    if (seatMode === 'horizontalS') {
      for (let r = 0; r < rowCount; r++) {
        if (showTop) {
          for (let ci = 0; ci < totalSeatsPerSide; ci++) {
            const c = r % 2 === 0 ? ci : totalSeatsPerSide - 1 - ci;
            slots.push({ row: r, side: 'top', col: c });
          }
        }
        if (showBottom) {
          for (let ci = 0; ci < totalSeatsPerSide; ci++) {
            const c = r % 2 === 0 ? totalSeatsPerSide - 1 - ci : ci;
            slots.push({ row: r, side: 'bottom', col: c });
          }
        }
      }
      return slots;
    }

    for (let r = 0; r < rowCount; r++) {
      if (showTop) for (let c = 0; c < totalSeatsPerSide; c++) slots.push({ row: r, side: 'top', col: c });
      if (showBottom) for (let c = 0; c < totalSeatsPerSide; c++) slots.push({ row: r, side: 'bottom', col: c });
    }
    return slots;
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

    const result: typeof assignment = [];
    const matrix = Array.from({ length: rowCount }, (_, rowIndex) => ({
      rowIndex,
      top: Array.from({ length: totalSeatsPerSide }, () => ''),
      bottom: Array.from({ length: totalSeatsPerSide }, () => ''),
    }));

    if (mode === 'groupRow') {
      const groups = splitIntoGroups(names, Math.max(1, groupCount));
      groups.forEach((group, gi) => {
        const row = gi % rowCount;
        const rowSlots: { side: 'top' | 'bottom'; col: number }[] = [];
        if (showTop) {
          for (let c = 0; c < totalSeatsPerSide; c++) {
            if (!closedSeats.has(seatKey(row, 'top', c))) rowSlots.push({ side: 'top', col: c });
          }
        }
        if (showBottom) {
          for (let c = 0; c < totalSeatsPerSide; c++) {
            if (!closedSeats.has(seatKey(row, 'bottom', c))) rowSlots.push({ side: 'bottom', col: c });
          }
        }

        group.forEach(n => {
          const slot = rowSlots.shift();
          if (!slot) return;
          if (slot.side === 'top') matrix[row].top[slot.col] = n;
          else matrix[row].bottom[slot.col] = n;
        });
      });
    } else {
      const slots = getSeatOrder(mode).filter(slot => !closedSeats.has(seatKey(slot.row, slot.side, slot.col)));
      names.slice(0, slots.length).forEach((n, i) => {
        const slot = slots[i];
        if (slot.side === 'top') matrix[slot.row].top[slot.col] = n;
        else matrix[slot.row].bottom[slot.col] = n;
      });
    }

    matrix.forEach(row => {
      result.push({ rowIndex: row.rowIndex, side: 'top', students: row.top });
      result.push({ rowIndex: row.rowIndex, side: 'bottom', students: row.bottom });
    });

    setAssignment(result);
    setSeated(true);
  };

  const buildSnapshot = () => ({
    rowCount,
    seatsPerSide,
    tableCols,
    autoRowCount,
    groupCount,
    mode,
    dualSide,
    seatSide,
    tableGap,
    assignment,
    closedSeats: Array.from(closedSeats),
    rowTransforms,
    seated,
    updatedAt: new Date().toISOString(),
  });

  const sanitizeAssignment = (rawAssignment: ComputerLabRowAssignment[], nextRows: number, nextSeatsPerSide: number) => {
    const validNames = new Set(students.map(s => s.name));
    const output: ComputerLabRowAssignment[] = [];

    for (let row = 0; row < nextRows; row++) {
      const topRow = rawAssignment.find(item => item.rowIndex === row && item.side === 'top');
      const bottomRow = rawAssignment.find(item => item.rowIndex === row && item.side === 'bottom');
      output.push({
        rowIndex: row,
        side: 'top',
        students: Array.from({ length: nextSeatsPerSide }, (_, i) => {
          const name = topRow?.students?.[i] || '';
          return validNames.has(name) ? name : '';
        }),
      });
      output.push({
        rowIndex: row,
        side: 'bottom',
        students: Array.from({ length: nextSeatsPerSide }, (_, i) => {
          const name = bottomRow?.students?.[i] || '';
          return validNames.has(name) ? name : '';
        }),
      });
    }

    return output;
  };

  const saveToHistory = async () => {
    if (!seated) {
      toast.error(t('seat.editor.common.noSeatsToSave'));
      return;
    }
    const name = recordName.trim() || `${t('seat.editor.scene.lab')}-${new Date().toLocaleString()}`;
    const item = saveComputerLabHistory(name, buildSnapshot());
    let savedItem: ComputerLabHistoryItem = item;
    const cloud = await saveCloudSeatHistory('computer_lab', name, item.snapshot);
    if (cloud) savedItem = { id: cloud.id, name: cloud.name, createdAt: cloud.createdAt, snapshot: cloud.snapshot } as ComputerLabHistoryItem;
    const nextItems = [savedItem, ...historyItems].slice(0, 50);
    setHistoryItems(nextItems);
    setSelectedHistoryId(savedItem.id);
    setRecordName(name);
    saveComputerLabSnapshot(item.snapshot);
    toast.success(cloud ? t('seat.editor.common.savedHistoryCloud') : t('seat.editor.common.savedHistoryLocal'));
  };

  const restoreFromHistory = () => {
    const item = historyItems.find(history => history.id === selectedHistoryId);
    if (!item) {
      toast.error(t('seat.editor.common.noHistorySelected'));
      return;
    }

    const snapshot = item.snapshot;
    const nextSeatsPerSide = Math.max(3, Math.min(16, snapshot.seatsPerSide));
    const nextRowCount = Math.max(1, snapshot.rowCount);
    const nextTableCols = Math.max(1, Math.min(6, snapshot.tableCols || 1));

    setSeatsPerSide(nextSeatsPerSide);
    setRowCount(nextRowCount);
    setTableCols(nextTableCols);
    setAutoRowCount(snapshot.autoRowCount !== false);
    setGroupCount(Math.max(2, Math.min(20, snapshot.groupCount)));
    setMode(snapshot.mode);
    setSeatSide(snapshot.seatSide || (snapshot.dualSide !== false ? 'both' : 'both'));
    setTableGap(Math.max(80, Math.min(260, snapshot.tableGap)));
    setSeated(!!snapshot.seated);
    setRecordName(item.name);

    const nextAssignment = sanitizeAssignment(snapshot.assignment || [], nextRowCount, nextSeatsPerSide * nextTableCols);
    setAssignment(nextAssignment);
    setClosedSeats(new Set(snapshot.closedSeats || []));
    setRowTransforms(
      Array.from({ length: nextRowCount }, (_, i) => snapshot.rowTransforms?.[i] || { x: 0, y: 0, rotation: 0 })
    );

    saveComputerLabSnapshot({
      ...snapshot,
      assignment: nextAssignment,
      rowTransforms: Array.from({ length: nextRowCount }, (_, i) => snapshot.rowTransforms?.[i] || { x: 0, y: 0, rotation: 0 }),
      closedSeats: snapshot.closedSeats || [],
    });
    toast.success(t('seat.editor.common.restoredHistory'));
  };

  useEffect(() => {
    if (!autoRowCount) return;
    const nextRows = getAutoRowCount(students.length, seatsPerSide, tableCols, seatSide);
    setRowCount(prev => (prev === nextRows ? prev : nextRows));
  }, [students.length, seatsPerSide, tableCols, autoRowCount, seatSide]);

  useEffect(() => {
    setHistoryItems(loadComputerLabHistory());
    (async () => {
      await migrateLocalToCloudOnce('computer_lab');
      const cloud = await fetchCloudSeatHistory<ComputerLabHistoryItem['snapshot']>('computer_lab');
      if (cloud) setHistoryItems(cloud.map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt, snapshot: r.snapshot })) as ComputerLabHistoryItem[]);
    })();
  }, []);

  useEffect(() => {
    if (restoredOnceRef.current) return;
    const snapshot = loadComputerLabSnapshot();
    if (!snapshot) {
      restoredOnceRef.current = true;
      return;
    }

    const nextSeatsPerSide = Math.max(3, Math.min(16, snapshot.seatsPerSide));
    const nextRowCount = Math.max(1, snapshot.rowCount);
    const nextTableCols = Math.max(1, Math.min(6, snapshot.tableCols || 1));

    setSeatsPerSide(nextSeatsPerSide);
    setRowCount(nextRowCount);
    setTableCols(nextTableCols);
    setAutoRowCount(snapshot.autoRowCount !== false);
    setGroupCount(Math.max(2, Math.min(20, snapshot.groupCount)));
    setMode(snapshot.mode);
    setSeatSide(snapshot.seatSide || (snapshot.dualSide !== false ? 'both' : 'both'));
    setTableGap(Math.max(80, Math.min(260, snapshot.tableGap)));
    setSeated(!!snapshot.seated);

    const nextAssignment = sanitizeAssignment(snapshot.assignment || [], nextRowCount, nextSeatsPerSide * nextTableCols);
    setAssignment(nextAssignment);
    setClosedSeats(new Set(snapshot.closedSeats || []));
    setRowTransforms(
      Array.from({ length: nextRowCount }, (_, i) => snapshot.rowTransforms?.[i] || { x: 0, y: 0, rotation: 0 })
    );
    restoredOnceRef.current = true;
  }, [students]);

  useEffect(() => {
    if (!restoredOnceRef.current) return;
    saveComputerLabSnapshot(buildSnapshot());
  }, [assignment, rowCount, seatsPerSide, tableCols, autoRowCount, groupCount, mode, seatSide, tableGap, closedSeats, rowTransforms, seated]);

  useEffect(() => {
    setRefPositions(defaultRefPositions);
  }, [defaultRefPositions]);

  useEffect(() => {
    setClosedSeats(prev => {
      const next = new Set<string>();
      prev.forEach(key => {
        const [rowStr, side, colStr] = key.split('-');
        const row = Number(rowStr);
        const col = Number(colStr);
        if (row < rowCount && (side === 'top' || side === 'bottom') && col < totalSeatsPerSide) next.add(key);
      });
      return next;
    });
  }, [rowCount, seatsPerSide]);

  useEffect(() => {
    setRowTransforms(prev =>
      Array.from({ length: rowCount }, (_, i) => prev[i] || { x: 0, y: 0, rotation: 0 })
    );
  }, [rowCount]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (refDraggingRef.current) {
        const dx = e.clientX - refDraggingRef.current.startX;
        const dy = e.clientY - refDraggingRef.current.startY;
        const key = refDraggingRef.current.key;
        setRefPositions(prev => ({
          ...prev,
          [key]: {
            x: refDraggingRef.current!.origX + dx,
            y: key === 'blackboard' ? REF_BLACKBOARD_TOP : refDraggingRef.current!.origY + dy,
          },
        }));
      }

      if (rowDraggingRef.current) {
        const dx = e.clientX - rowDraggingRef.current.startX;
        const dy = e.clientY - rowDraggingRef.current.startY;
        setRowTransforms(prev => prev.map((t, i) =>
          i === rowDraggingRef.current!.row
            ? { ...t, x: rowDraggingRef.current!.origX + dx, y: rowDraggingRef.current!.origY + dy }
            : t
        ));
      }
    };

    const handleMouseUp = () => {
      refDraggingRef.current = null;
      rowDraggingRef.current = null;
      seatDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const toggleRefVisible = (key: RefKey) => {
    setRefVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const startRefDrag = (e: ReactMouseEvent, key: RefKey) => {
    if (refLocked) return;
    e.preventDefault();
    e.stopPropagation();
    refDraggingRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      origX: refPositions[key].x,
      origY: refPositions[key].y,
    };
  };

  const startRowDrag = (e: ReactMouseEvent, row: number) => {
    if (seatDraggingRef.current) return;
    e.stopPropagation();
    const current = rowTransforms[row] || { x: 0, y: 0, rotation: 0 };
    rowDraggingRef.current = {
      row,
      startX: e.clientX,
      startY: e.clientY,
      origX: current.x,
      origY: current.y,
    };
  };

  const rotateRow = (row: number) => {
    setRowTransforms(prev => prev.map((t, i) =>
      i === row ? { ...t, rotation: ((t.rotation + 90) % 360 + 360) % 360 } : t
    ));
  };

  const resetRowTransforms = () => {
    setRowTransforms(Array.from({ length: rowCount }, () => ({ x: 0, y: 0, rotation: 0 })));
  };

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
            const next = prev.map(group => ({ ...group, students: [...group.students] }));
            const [fr, fs, fc] = from.split('-');
            const [tr, ts, tc] = to.split('-');
            const fromRow = Number(fr);
            const toRow = Number(tr);
            const fromCol = Number(fc);
            const toCol = Number(tc);

            const fromGroup = next.find(g => g.rowIndex === fromRow && g.side === fs);
            const toGroup = next.find(g => g.rowIndex === toRow && g.side === ts);
            if (!fromGroup || !toGroup) return prev;

            const temp = fromGroup.students[fromCol] || '';
            fromGroup.students[fromCol] = toGroup.students[toCol] || '';
            toGroup.students[toCol] = temp;
            return next;
          });

          setDragFrom(null);
          setDropTarget(null);
        }}
        onClick={() => {
          if (!name) {
            const [rStr, side, cStr] = slot.split('-');
            toggleSeatOpen(Number(rStr), side as 'top' | 'bottom', Number(cStr));
          }
        }}
      >
        <rect x={x} y={y} width={seatW} height={seatH} rx={4}
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

  return (
    <div onMouseUp={() => { setDragFrom(null); setDropTarget(null); }} onMouseLeave={() => { setDragFrom(null); setDropTarget(null); }}>
      <div className="flex flex-wrap items-start gap-2 sm:items-center sm:gap-3 mb-5 rounded-lg border border-border/60 bg-muted/20 p-3">
        <label className="flex w-full sm:w-auto items-center gap-2 text-sm text-muted-foreground">
          名称
          <Input
            type="text"
            value={recordName}
            onChange={e => setRecordName(e.target.value)}
            placeholder="输入名称（用于保存历史和导出文件名）"
            className="h-8 w-full sm:w-72"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          排数
          <Input type="number" min={1} max={30} value={rowCount}
            onChange={e => { setRowCount(Math.max(1, Math.min(30, Number(e.target.value)))); setAutoRowCount(false); }}
            className="w-14 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          列数（桌组）
          <Input type="number" min={1} max={6} value={tableCols}
            onChange={e => setTableCols(Math.max(1, Math.min(6, Number(e.target.value))))}
            className="w-14 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          每桌座位数
          <Input type="number" min={3} max={16} value={seatsPerSide}
            onChange={e => setSeatsPerSide(Math.max(3, Math.min(16, Number(e.target.value))))} className="w-14 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          模式
          <select
            value={mode}
            onChange={e => setMode(e.target.value as LabSeatMode)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="balanced">行列平衡</option>
            <option value="groupRow">每组同排</option>
            <option value="verticalS">竖S分配</option>
            <option value="horizontalS">横S分配</option>
          </select>
        </label>
        {mode === 'groupRow' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            组数
            <Input type="number" min={2} max={20} value={groupCount}
              onChange={e => setGroupCount(Math.max(2, Math.min(20, Number(e.target.value))))} className="w-14 h-8 text-center" />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          行间距
          <Input type="number" min={80} max={260} value={tableGap}
            onChange={e => setTableGap(Math.max(80, Math.min(260, Number(e.target.value))))} className="w-14 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          学生位置
          <select
            value={seatSide}
            onChange={e => setSeatSide(e.target.value as LabSeatSide)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="both">两侧</option>
            <option value="top">仅上侧</option>
            <option value="bottom">仅下侧</option>
          </select>
        </label>
        <div className="flex w-full sm:w-auto sm:min-w-[24rem] items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1">
          <Button variant="outline" onClick={saveToHistory} className="gap-2 h-8" disabled={!seated}>
            <Save className="w-4 h-4" /> 保存历史
          </Button>
          <select
            value={selectedHistoryId}
            onChange={e => setSelectedHistoryId(e.target.value)}
            className="h-8 min-w-0 flex-1 sm:max-w-72 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="">选择历史记录</option>
            {historyItems.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}（{new Date(item.createdAt).toLocaleString()}）
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={restoreFromHistory} disabled={!selectedHistoryId} className="gap-2 h-8">
            <RotateCcw className="w-4 h-4" /> 恢复历史
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!selectedHistoryId}
            title="重命名该历史记录"
            onClick={async () => {
              const id = selectedHistoryId;
              const current = historyItems.find(h => h.id === id);
              if (!id || !current) return;
              const next = window.prompt('请输入新名称', current.name)?.trim();
              if (!next || next === current.name) return;
              await renameCloudSeatHistory(id, next);
              renameSeatHistoryLocal('computer_lab', id, next);
              setHistoryItems(prev => prev.map(h => (h.id === id ? { ...h, name: next } : h)));
              toast.success('已重命名');
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={!selectedHistoryId}
            title="删除该历史记录"
            onClick={async () => {
              const id = selectedHistoryId;
              if (!id) return;
              if (!window.confirm('确定要删除这条历史记录吗？该操作不可恢复。')) return;
              await deleteCloudSeatHistory(id);
              deleteSeatHistoryLocal('computer_lab', id);
              setHistoryItems(prev => prev.filter(h => h.id !== id));
              setSelectedHistoryId('');
              toast.success('已删除该历史记录');
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={() => setRefPositions(defaultRefPositions)}>
          重置参照物
        </Button>
        <Button variant="outline" onClick={resetRowTransforms}>
          重置桌位位置
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.blackboard} onChange={() => toggleRefVisible('blackboard')} className="accent-primary" /> 前黑板
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.window} onChange={() => toggleRefVisible('window')} className="accent-primary" /> 窗
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.door} onChange={() => toggleRefVisible('door')} className="accent-primary" /> 门
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refLocked} onChange={e => setRefLocked(e.target.checked)} className="accent-primary" /> 锁定参照物
          </label>
        </div>
        <span className="text-xs text-muted-foreground">可容纳 {rowCount * totalSeatsPerSide * (dualSide ? 2 : 1)} 人 | 当前 {students.length} 人</span>
        {seated && (
          <ExportButtons
            targetRef={printRef}
            filename={recordName.trim() || '机房座位'}
            resolveQrCode={resolveQrCode}
            titleValue={recordName}
            onTitleChange={setRecordName}
            hideTitleInput
          />
        )}
        {seated && (
          <Button variant="outline" onClick={() => setCheckinOpen(true)} className="gap-2">
            <QrCode className="w-4 h-4" /> 签到
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => autoSeat(true)} className="gap-2">
            <Shuffle className="w-4 h-4" /> 随机排座
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!window.confirm('确定要清空当前所有座位安排吗？此操作不可撤销。')) return;
              const blank: typeof assignment = [];
              for (let r = 0; r < rowCount; r++) {
                blank.push({ rowIndex: r, side: 'top', students: Array.from({ length: totalSeatsPerSide }, () => '') });
                blank.push({ rowIndex: r, side: 'bottom', students: Array.from({ length: totalSeatsPerSide }, () => '') });
              }
              setAssignment(blank);
              setSeated(true);
            }}
            className="gap-2"
            title="清空所有座位（保留机房容量）"
          >
            <Trash2 className="w-4 h-4" /> 清空
          </Button>
          <Button onClick={() => autoSeat(false)} className="gap-2">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
        </div>
      </div>

      <div ref={printRef}>
        {seated ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <ZoomControls scale={zoom.scale} onZoomIn={zoom.zoomIn} onZoomOut={zoom.zoomOut} onFit={zoom.fitToScreen} onReset={zoom.reset} />
            </div>
            <div ref={zoom.containerRef} className="overflow-auto pb-[max(0.5rem,env(safe-area-inset-bottom))] max-h-[80vh]">
              <div className="mx-auto" style={{ width: roomWidth * zoom.scale, height: roomHeight * zoom.scale }}>
                <div className="relative rounded-xl border border-border bg-card/40" style={{ width: roomWidth, height: roomHeight, transform: `scale(${zoom.scale})`, transformOrigin: 'top left' }}>
              {refVisible.blackboard && (
                <div className={refBadgeClass} style={{ left: refPositions.blackboard.x, top: refPositions.blackboard.y }} onMouseDown={e => startRefDrag(e, 'blackboard')}>
                  <span className={refIconClass}>🖥️</span>
                  <span className={refTextClass}>前黑板</span>
                </div>
              )}
              {refVisible.window && (
                <div className={refBadgeClass} style={{ left: refPositions.window.x, top: refPositions.window.y }} onMouseDown={e => startRefDrag(e, 'window')}>
                  <span className={refIconClass}>🪟</span>
                  <span className={refTextClass}>窗</span>
                </div>
              )}
              {refVisible.door && (
                <div className={refBadgeClass} style={{ left: refPositions.door.x, top: refPositions.door.y }} onMouseDown={e => startRefDrag(e, 'door')}>
                  <span className={refIconClass}>🚪</span>
                  <span className={refTextClass}>门</span>
                </div>
              )}

              <svg width={roomWidth} height={roomHeight} viewBox={`0 0 ${roomWidth} ${roomHeight}`} className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
                {Array.from({ length: maxRows }).map((_, rowIdx) => {
                  const baseY = 120 + rowIdx * rowGap;
                  const centerX = roomWidth / 2;
                  const allTableStartX = (roomWidth - allTableW) / 2;
                  const transform = rowTransforms[rowIdx] || { x: 0, y: 0, rotation: 0 };
                  const rowCenterY = dualSide ? baseY + 20 : baseY + 52;

                  const topGroup = assignment.find(a => a.rowIndex === rowIdx && a.side === 'top');
                  const bottomGroup = assignment.find(a => a.rowIndex === rowIdx && a.side === 'bottom');

                  return (
                    <g
                      key={`row-${rowIdx}`}
                      transform={`translate(${transform.x} ${transform.y})`}
                      onMouseDown={e => startRowDrag(e, rowIdx)}
                      style={{ cursor: 'move' }}
                    >
                      <g transform={`rotate(${transform.rotation} ${centerX} ${rowCenterY})`}>
                      {Array.from({ length: tableCols }).map((_, tci) => {
                        const tableX = allTableStartX + tci * (tableW + colGap);
                        const seatOffset = tci * seatsPerSide;
                        return (
                          <g key={`tc-${tci}`}>
                            {/* Table bar */}
                            <rect x={tableX} y={baseY} width={tableW} height={24} rx={6}
                              className="fill-primary/8 stroke-primary/30" strokeWidth={1.5} />
                            <text x={tableX + tableW / 2} y={baseY + 12} textAnchor="middle" dominantBaseline="middle" className="fill-primary/50 text-[10px]">
                              {tableCols > 1 ? `长桌${tci + 1}` : '━━━ 长桌 ━━━'}
                            </text>

                            {/* Top seats */}
                            {showTop && topGroup && Array.from({ length: seatsPerSide }).map((_, ci) => {
                              const x = tableX + gap + ci * (seatW + gap);
                              const y = baseY - seatH - 8;
                              const globalCol = seatOffset + ci;
                              const name = topGroup.students[globalCol] || '';
                              return renderSeat(x, y, name, seatKey(rowIdx, 'top', globalCol));
                            })}

                            {/* Bottom seats */}
                            {showBottom && bottomGroup && (
                              <>
                                {Array.from({ length: seatsPerSide }).map((_, ci) => {
                                  const x = tableX + gap + ci * (seatW + gap);
                                  const y = dualSide ? baseY + 28 : baseY + 24 + 8;
                                  const globalCol = seatOffset + ci;
                                  const name = bottomGroup.students[globalCol] || '';
                                  return renderSeat(x, y, name, seatKey(rowIdx, 'bottom', globalCol));
                                })}
                              </>
                            )}
                          </g>
                        );
                      })}

                      <g onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); rotateRow(rowIdx); }} style={{ cursor: 'pointer' }}>
                        <rect x={allTableStartX + allTableW + 12} y={baseY + 2} width={30} height={20} rx={5} className="fill-card stroke-border hover:stroke-primary/60" strokeWidth={1.2} />
                        <text x={allTableStartX + allTableW + 27} y={baseY + 12} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">90°</text>
                      </g>
                      </g>
                    </g>
                  );
                })}
              </svg>
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">
              {`${rowCount} 排 × ${tableCols} 列桌组，每桌每侧 ${seatsPerSide} 座位（${seatSide === 'both' ? '两侧' : seatSide === 'top' ? '仅上侧' : '仅下侧'}）`}
            </p>
          </div>
        )}
      </div>

      {seated && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          拖拽姓名可换座；点击空座位可关闭/开放使用；每排长桌可拖拽与旋转90°；前黑板/门窗支持显隐与拖拽
        </p>
      )}
      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={assignment}
        studentNames={students.map(s => s.name)}
        seatAssignmentReady={seated}
        sceneType="computerLab"
        sceneConfig={exportSceneConfig}
        className={recordName.trim() || exportClassName}
        pngFileName={recordName.trim() || '机房座位'}
        onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)}
      />
    </div>
  );
}
