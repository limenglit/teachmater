import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle, QrCode, Save, RotateCcw, Users } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import { useRoundTableDrag } from './useRoundTableDrag';
import { useSeatExportQr } from './useSeatExportQr';
import { toast } from 'sonner';
import {
  loadLastGroups,
  saveLastGroups,
  loadSmartClassroomSnapshot,
  saveSmartClassroomSnapshot,
  groupsFromSeatAssignment,
  loadSmartClassroomHistory,
  saveSmartClassroomHistory,
  SmartClassroomHistoryItem,
} from '@/lib/teamwork-local';

interface Props {
  students: { id: string; name: string }[];
}

type SmartSeatMode = 'tableRoundRobin' | 'tableGrouped' | 'verticalS' | 'horizontalS';
type RefKey = 'screen' | 'podium' | 'frontDoor' | 'backDoor' | 'window';
type RefPositions = Record<RefKey, { x: number; y: number }>;
type RefVisible = Record<RefKey, boolean>;

function getDefaultRefPositions(roomWidth: number, roomHeight: number): RefPositions {
  const badgeW = 94;
  const centeredX = Math.round((roomWidth - badgeW) / 2);
  const rightX = Math.max(24, roomWidth - badgeW - 24);
  const centerY = Math.max(20, Math.round((roomHeight - 32) / 2));
  return {
    screen: { x: centeredX, y: 22 },
    podium: { x: centeredX, y: 74 },
    frontDoor: { x: rightX, y: 120 },
    backDoor: { x: rightX, y: Math.max(160, roomHeight - 56) },
    window: { x: 24, y: centerY },
  };
}

export default function SmartClassroom({ students }: Props) {
  const initialTableCount = Math.max(1, Math.ceil(students.length / 6));
  const initialTableCols = Math.max(1, Math.ceil(Math.sqrt(initialTableCount)));
  const initialTableRows = Math.max(1, Math.ceil(initialTableCount / initialTableCols));

  const [seatsPerTable, setSeatsPerTable] = useState(6);
  const [tableCols, setTableCols] = useState(initialTableCols);
  const [tableRows, setTableRows] = useState(initialTableRows);
  const [tableCount, setTableCount] = useState(initialTableCount);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<SmartSeatMode>('tableRoundRobin');
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [reservedTables, setReservedTables] = useState<Set<number>>(new Set());
  const [tableGap, setTableGap] = useState(20);
  const [tablePositions, setTablePositions] = useState<{ x: number; y: number }[]>([]);
  const [refPositions, setRefPositions] = useState<RefPositions>(() => getDefaultRefPositions(920, 640));
  const [refVisible, setRefVisible] = useState<RefVisible>({
    screen: true,
    podium: true,
    frontDoor: true,
    backDoor: true,
    window: true,
  });
  const [refLocked, setRefLocked] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [linkedGroupNames, setLinkedGroupNames] = useState<string[]>([]);
  const [recordName, setRecordName] = useState('');
  const [historyItems, setHistoryItems] = useState<SmartClassroomHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');

  const printRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ index: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const refDraggingRef = useRef<{ key: RefKey; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const seatDraggingRef = useRef(false);
  const restoredOnceRef = useRef(false);

  const { dragFrom, dropTarget, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useRoundTableDrag(assignment, setAssignment);

  const seatKey = (tableIndex: number, seatIndex: number) => `${tableIndex}-${seatIndex}`;

  const toggleSeatOpen = (tableIndex: number, seatIndex: number) => {
    const key = seatKey(tableIndex, seatIndex);
    setClosedSeats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTableReserved = (tableIndex: number) => {
    setReservedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableIndex)) {
        next.delete(tableIndex);
      } else {
        next.add(tableIndex);
        setAssignment(current => {
          const copied = current.map(row => [...row]);
          if (!copied[tableIndex]) return copied;
          copied[tableIndex] = copied[tableIndex].map(() => '');
          return copied;
        });
      }
      return next;
    });
  };

  const toggleRefVisible = (key: RefKey) => {
    setRefVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const placeName = (tables: string[][], preferred: number, name: string) => {
    const order = [preferred, ...Array.from({ length: tableCount }, (_, i) => i).filter(i => i !== preferred)]
      .filter(tableIdx => !reservedTables.has(tableIdx));
    for (const tableIdx of order) {
      for (let seatIdx = 0; seatIdx < seatsPerTable; seatIdx++) {
        if (closedSeats.has(seatKey(tableIdx, seatIdx))) continue;
        if (!tables[tableIdx][seatIdx]) {
          tables[tableIdx][seatIdx] = name;
          return;
        }
      }
    }
  };

  const splitIntoGroups = (names: string[], count: number) => {
    const groups: string[][] = Array.from({ length: count }, () => []);
    names.forEach((n, i) => groups[i % count].push(n));
    return groups;
  };

  const toPositiveInt = (value: number, fallback = 1) => {
    if (!Number.isFinite(value)) return fallback;
    const normalized = Math.floor(value);
    return normalized > 0 ? normalized : fallback;
  };

  const applyGridSize = (nextRows: number, nextCols: number) => {
    setTableRows(nextRows);
    setTableCols(nextCols);
    setTableCount(nextRows * nextCols);
  };

  const handleRowsChange = (raw: string) => {
    const nextRows = toPositiveInt(Number(raw), tableRows);
    applyGridSize(nextRows, tableCols);
  };

  const handleColsChange = (raw: string) => {
    const nextCols = toPositiveInt(Number(raw), tableCols);
    applyGridSize(tableRows, nextCols);
  };

  const handleTableCountChange = (raw: string) => {
    const nextCount = toPositiveInt(Number(raw), tableCount);
    setTableCount(nextCount);
    setTableRows(Math.max(1, Math.ceil(nextCount / tableCols)));
  };

  const getTableOrder = (seatMode: SmartSeatMode) => {
    const cols = tableCols;
    const rows = tableRows;
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

  const applyGroupsToSeat = (fromGroups: ReturnType<typeof loadLastGroups>) => {
    const availableNames = new Set(students.map(s => s.name));
    const filteredGroups = fromGroups
      .map(group => ({
        ...group,
        members: group.members.filter(member => availableNames.has(member.name)),
      }))
      .filter(group => group.members.length > 0);

    if (filteredGroups.length === 0) {
      toast.error('没有可用分组数据');
      return false;
    }

    const nextTableCount = filteredGroups.length;
    const maxGroupSize = Math.max(...filteredGroups.map(group => group.members.length));
    const nextSeatsPerTable = Math.max(3, maxGroupSize);
    const nextTableCols = Math.max(1, Math.min(tableCols, nextTableCount));
    const nextTableRows = Math.max(1, Math.ceil(nextTableCount / nextTableCols));
    const nextAssignment = Array.from({ length: nextTableCount }, (_, index) => {
      const row = filteredGroups[index]?.members.map(member => member.name) ?? [];
      if (row.length >= nextSeatsPerTable) return row.slice(0, nextSeatsPerTable);
      return [...row, ...Array.from({ length: nextSeatsPerTable - row.length }, () => '')];
    });

    setSeatsPerTable(nextSeatsPerTable);
    setTableCount(nextTableCount);
    setTableCols(nextTableCols);
    setTableRows(nextTableRows);
    setGroupCount(nextTableCount);
    setMode('tableGrouped');
    setLinkedGroupNames(filteredGroups.map(group => group.name));
    setAssignment(nextAssignment);
    setReservedTables(new Set());
    return true;
  };

  const buildSnapshot = () => ({
    seatsPerTable,
    tableCount,
    tableCols,
    tableRows,
    groupCount,
    mode,
    tableGap,
    assignment,
    closedSeats: Array.from(closedSeats),
    reservedTables: Array.from(reservedTables),
    updatedAt: new Date().toISOString(),
  });

  const saveToHistory = () => {
    if (assignment.length === 0) {
      toast.error('请先完成排座再保存');
      return;
    }
    const name = recordName.trim() || `智能教室-${new Date().toLocaleString()}`;
    const item = saveSmartClassroomHistory(name, buildSnapshot());
    const nextItems = [item, ...historyItems].slice(0, 50);
    setHistoryItems(nextItems);
    setSelectedHistoryId(item.id);
    setRecordName(name);
    saveSmartClassroomSnapshot(item.snapshot);
    toast.success('已保存到历史记录');
  };

  const restoreFromHistory = () => {
    const item = historyItems.find(history => history.id === selectedHistoryId);
    if (!item) {
      toast.error('请选择要恢复的历史记录');
      return;
    }
    const snapshot = item.snapshot;
    const validStudentNames = new Set(students.map(s => s.name));
    const sanitizedAssignment = snapshot.assignment.map(table =>
      table.map(name => (validStudentNames.has(name) ? name : ''))
    );

    setSeatsPerTable(Math.max(3, snapshot.seatsPerTable));
    setTableCount(Math.max(1, snapshot.tableCount));
    setTableCols(Math.max(1, snapshot.tableCols));
    setTableRows(Math.max(1, snapshot.tableRows));
    setGroupCount(Math.max(1, snapshot.groupCount));
    setMode(snapshot.mode);
    setTableGap(Math.max(0, snapshot.tableGap));
    setAssignment(sanitizedAssignment);
    setClosedSeats(new Set(snapshot.closedSeats || []));
    setReservedTables(new Set(snapshot.reservedTables || []));
    setRecordName(item.name);
    saveSmartClassroomSnapshot({ ...snapshot, assignment: sanitizedAssignment });
    toast.success('已从历史记录恢复，可继续调整');
  };

  const seatByLastGroups = () => {
    const cachedGroups = loadLastGroups();
    if (cachedGroups.length === 0) {
      toast.error('暂无已保存分组');
      return;
    }
    const ok = applyGroupsToSeat(cachedGroups);
    if (ok) {
      toast.success('已按分组一桌生成座位');
    }
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);
    const tables: string[][] = Array.from({ length: tableCount }, () => Array.from({ length: seatsPerTable }, () => ''));

    if (mode === 'tableGrouped') {
      const cachedGroups = loadLastGroups();
      if (cachedGroups.length > 0 && !shuffle) {
        const ok = applyGroupsToSeat(cachedGroups);
        if (ok) return;
      }

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

  const roomWidth = Math.max(920, tableCols * 160 + Math.max(0, tableCols - 1) * tableGap + 220);
  const roomHeight = Math.max(640, tableRows * 160 + Math.max(0, tableRows - 1) * tableGap + 240);
  const exportSceneConfig = { seatsPerTable, tableCount, tableCols, tableRows };
  const { className: exportClassName, resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: assignment,
    studentNames: students.map(s => s.name),
    sceneConfig: exportSceneConfig,
    sceneType: 'smartClassroom',
  });
  const defaultRefPositions = useMemo(() => getDefaultRefPositions(roomWidth, roomHeight), [roomWidth, roomHeight]);
  const refBadgeClass = 'absolute h-8 pl-2 pr-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm cursor-move select-none inline-flex items-center gap-1.5';
  const refIconClass = 'inline-flex items-center justify-center w-5 h-5 rounded-md border border-primary/30 bg-background/80 text-[11px] leading-none';
  const refTextClass = 'text-[11px] font-medium leading-none tracking-wide';

  useEffect(() => {
    const requiredTableCount = Math.max(1, Math.ceil(students.length / Math.max(1, seatsPerTable)));
    if (requiredTableCount <= tableCount) return;
    setTableCount(requiredTableCount);
    setTableRows(Math.max(1, Math.ceil(requiredTableCount / tableCols)));
  }, [students.length, seatsPerTable, tableCols, tableCount]);

  useEffect(() => {
    setRefPositions(defaultRefPositions);
  }, [defaultRefPositions]);

  useEffect(() => {
    setTablePositions(Array(tableCount).fill({ x: 0, y: 0 }));
  }, [tableCount]);

  useEffect(() => {
    setClosedSeats(prev => {
      const next = new Set<string>();
      prev.forEach(key => {
        const [tableStr, seatStr] = key.split('-');
        const t = Number(tableStr);
        const s = Number(seatStr);
        if (t < tableCount && s < seatsPerTable) next.add(key);
      });
      return next;
    });
  }, [tableCount, seatsPerTable]);

  useEffect(() => {
    setReservedTables(prev => {
      const next = new Set<number>();
      prev.forEach(index => {
        if (index < tableCount) next.add(index);
      });
      return next;
    });
  }, [tableCount]);

  useEffect(() => {
    setHistoryItems(loadSmartClassroomHistory());
  }, []);

  useEffect(() => {
    if (restoredOnceRef.current) return;
    const snapshot = loadSmartClassroomSnapshot();
    if (snapshot && snapshot.assignment.length > 0) {
      const validStudentNames = new Set(students.map(s => s.name));
      const sanitizedAssignment = snapshot.assignment.map(table =>
        table.map(name => (validStudentNames.has(name) ? name : ''))
      );
      setSeatsPerTable(Math.max(3, snapshot.seatsPerTable));
      setTableCount(Math.max(1, snapshot.tableCount));
      setTableCols(Math.max(1, snapshot.tableCols));
      setTableRows(Math.max(1, snapshot.tableRows));
      setGroupCount(Math.max(1, snapshot.groupCount));
      setMode(snapshot.mode);
      setTableGap(Math.max(0, snapshot.tableGap));
      setAssignment(sanitizedAssignment);
      setClosedSeats(new Set(snapshot.closedSeats || []));
      setReservedTables(new Set(snapshot.reservedTables || []));
    }
    restoredOnceRef.current = true;
  }, [students]);

  useEffect(() => {
    if (assignment.length === 0) return;

    const nextGroups = groupsFromSeatAssignment(assignment, linkedGroupNames);
    if (nextGroups.length > 0) {
      saveLastGroups(nextGroups);
      const nextNames = nextGroups.map(group => group.name);
      if (nextNames.join('|') !== linkedGroupNames.join('|')) {
        setLinkedGroupNames(nextNames);
      }
    }

    saveSmartClassroomSnapshot({
      seatsPerTable,
      tableCount,
      tableCols,
      tableRows,
      groupCount,
      mode,
      tableGap,
      assignment,
      closedSeats: Array.from(closedSeats),
      reservedTables: Array.from(reservedTables),
      updatedAt: new Date().toISOString(),
    });
  }, [assignment, seatsPerTable, tableCount, tableCols, tableRows, groupCount, mode, tableGap, closedSeats, reservedTables, linkedGroupNames]);

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

      if (refDraggingRef.current) {
        const dx = e.clientX - refDraggingRef.current.startX;
        const dy = e.clientY - refDraggingRef.current.startY;
        const key = refDraggingRef.current.key;
        setRefPositions(prev => ({
          ...prev,
          [key]: {
            x: refDraggingRef.current!.origX + dx,
            y: refDraggingRef.current!.origY + dy,
          },
        }));
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      refDraggingRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startTableDrag = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (seatDraggingRef.current) return;
    draggingRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      origX: tablePositions[index]?.x || 0,
      origY: tablePositions[index]?.y || 0,
    };
  };

  const startRefDrag = (e: React.MouseEvent, key: RefKey) => {
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

  const renderRoundTable = (tableIndex: number, people: string[]) => {
    const radius = 52;
    const seatRadius = 16;
    const cx = 80;
    const cy = 80;
    const totalSlots = seatsPerTable;
    const pos = tablePositions[tableIndex] || { x: 0, y: 0 };
    const isReservedTable = reservedTables.has(tableIndex);

    return (
      <div
        key={tableIndex}
        className="flex flex-col items-center gap-1 cursor-move"
        style={{ transform: `translate(${pos.x}px,${pos.y}px)` }}
        onMouseDown={e => startTableDrag(e, tableIndex)}
      >
        <svg width={160} height={160} viewBox="0 0 160 160" className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
          <g
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              toggleTableReserved(tableIndex);
            }}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={36}
              className={isReservedTable ? 'fill-amber-100 stroke-amber-500' : 'fill-primary/10 stroke-primary/30'}
              strokeWidth={2}
            />
            <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle" className={isReservedTable ? 'fill-amber-700 text-[10px] font-semibold' : 'fill-primary text-[10px] font-medium'}>
              {tableIndex + 1}桌
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" className={isReservedTable ? 'fill-amber-700 text-xs font-semibold' : 'fill-muted-foreground text-[10px]'}>
              {isReservedTable ? '保留' : '开放'}
            </text>
          </g>
          {Array.from({ length: totalSlots }).map((_, i) => {
            const angle = (2 * Math.PI * i) / totalSlots - Math.PI / 2;
            const sx = cx + radius * Math.cos(angle);
            const sy = cy + radius * Math.sin(angle);
            const name = people[i] || '';
            const isClosed = closedSeats.has(seatKey(tableIndex, i));
            const isDragging = dragFrom?.table === tableIndex && dragFrom?.seat === i;
            const isOver = dropTarget?.table === tableIndex && dropTarget?.seat === i;
            return (
              <g
                key={i}
                style={{ cursor: name && !isClosed ? 'grab' : 'pointer' }}
                onMouseDown={name && !isClosed ? (e) => {
                  if (isReservedTable) return;
                  e.preventDefault();
                  e.stopPropagation();
                  seatDraggingRef.current = true;
                  handleDragStart(tableIndex, i);
                } : undefined}
                onMouseEnter={() => { if (dragFrom && !isClosed && !isReservedTable) handleDragOver(tableIndex, i); }}
                onMouseUp={() => {
                  if (dragFrom && !isClosed && !isReservedTable) handleDrop(tableIndex, i);
                  seatDraggingRef.current = false;
                }}
                onClick={() => { if (!name && !isReservedTable) toggleSeatOpen(tableIndex, i); }}
              >
                <circle
                  cx={sx} cy={sy} r={seatRadius}
                  className={
                    isReservedTable ? 'fill-amber-50 stroke-amber-200' :
                    isClosed ? 'fill-muted stroke-destructive/60' :
                    isDragging ? 'fill-primary/20 stroke-primary' :
                    isOver ? 'fill-accent stroke-primary' :
                    name ? 'fill-card stroke-border hover:stroke-primary/50' : 'fill-muted/50 stroke-border/50'
                  }
                  strokeWidth={isOver ? 2.5 : 1.5}
                  style={{ transition: 'all 0.15s' }}
                />
                {isClosed && (
                  <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-destructive text-xs pointer-events-none">
                    关
                  </text>
                )}
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
    <div
      onMouseUp={() => {
        handleDragEnd();
        seatDraggingRef.current = false;
        refDraggingRef.current = null;
      }}
      onMouseLeave={() => {
        handleDragEnd();
        seatDraggingRef.current = false;
        refDraggingRef.current = null;
      }}
    >
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
          每桌人数
          <Input type="number" min={3} max={12} value={seatsPerTable}
            onChange={e => setSeatsPerTable(Math.max(3, Math.min(12, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          行数
          <Input
            type="number"
            min={1}
            value={tableRows}
            onChange={e => handleRowsChange(e.target.value)}
            className="w-16 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          列数
          <Input
            type="number"
            min={1}
            value={tableCols}
            onChange={e => handleColsChange(e.target.value)}
            className="w-16 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          桌数
          <Input
            type="number"
            min={1}
            value={tableCount}
            onChange={e => handleTableCountChange(e.target.value)}
            className="w-20 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          模式
          <select
            value={mode}
            onChange={e => setMode(e.target.value as SmartSeatMode)}
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
            <Input type="number" min={2} max={20} value={groupCount}
              onChange={e => setGroupCount(Math.max(2, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          桌子间距
          <Input type="number" min={0} max={100} value={tableGap}
            onChange={e => setTableGap(Math.max(0, Math.min(100, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <div className="flex w-full sm:w-auto sm:min-w-[24rem] items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1">
          <Button variant="outline" onClick={saveToHistory} className="gap-2 h-8" disabled={assignment.length === 0}>
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
          <Button
            variant="outline"
            onClick={restoreFromHistory}
            disabled={!selectedHistoryId}
            className="gap-2 h-8"
          >
            <RotateCcw className="w-4 h-4" /> 恢复历史
          </Button>
        </div>
        <Button variant="outline" onClick={seatByLastGroups} className="gap-2">
          <Users className="w-4 h-4" /> 按分组一桌
        </Button>
        <Button variant="outline" onClick={() => setRefPositions(defaultRefPositions)}>
          重置参照物
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.screen} onChange={() => toggleRefVisible('screen')} className="accent-primary" /> 幕布
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.podium} onChange={() => toggleRefVisible('podium')} className="accent-primary" /> 讲台
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.frontDoor} onChange={() => toggleRefVisible('frontDoor')} className="accent-primary" /> 前门
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.backDoor} onChange={() => toggleRefVisible('backDoor')} className="accent-primary" /> 后门
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.window} onChange={() => toggleRefVisible('window')} className="accent-primary" /> 窗
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refLocked} onChange={e => setRefLocked(e.target.checked)} className="accent-primary" /> 锁定参照物
          </label>
        </div>
        <span className="text-xs text-muted-foreground">
          容量 {seatsPerTable * tableCount} | 学生 {students.length}
        </span>
        {assignment.length > 0 && (
          <ExportButtons
            targetRef={printRef}
            filename={recordName.trim() || '智能教室座位'}
            resolveQrCode={resolveQrCode}
            titleValue={recordName}
            onTitleChange={setRecordName}
            hideTitleInput
          />
        )}
        {assignment.length > 0 && (
          <Button variant="outline" onClick={() => setCheckinOpen(true)} className="gap-2">
            <QrCode className="w-4 h-4" /> 签到
          </Button>
        )}
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
          <div className="flex justify-center overflow-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div
              className="relative rounded-xl border border-border bg-card/40"
              style={{ width: roomWidth, height: roomHeight }}
            >
              {refVisible.screen && (
                <div
                  className={refBadgeClass}
                  style={{ left: refPositions.screen.x, top: refPositions.screen.y }}
                  onMouseDown={e => startRefDrag(e, 'screen')}
                >
                  <span className={refIconClass}>🖥️</span>
                  <span className={refTextClass}>幕布</span>
                </div>
              )}

              {refVisible.podium && (
                <div
                  className={refBadgeClass}
                  style={{ left: refPositions.podium.x, top: refPositions.podium.y }}
                  onMouseDown={e => startRefDrag(e, 'podium')}
                >
                  <span className={refIconClass}>🏫</span>
                  <span className={refTextClass}>讲台</span>
                </div>
              )}

              {refVisible.frontDoor && (
                <div
                  className={refBadgeClass}
                  style={{ left: refPositions.frontDoor.x, top: refPositions.frontDoor.y }}
                  onMouseDown={e => startRefDrag(e, 'frontDoor')}
                >
                  <span className={refIconClass}>🚪</span>
                  <span className={refTextClass}>前门</span>
                </div>
              )}

              {refVisible.backDoor && (
                <div
                  className={refBadgeClass}
                  style={{ left: refPositions.backDoor.x, top: refPositions.backDoor.y }}
                  onMouseDown={e => startRefDrag(e, 'backDoor')}
                >
                  <span className={refIconClass}>🚪</span>
                  <span className={refTextClass}>后门</span>
                </div>
              )}

              {refVisible.window && (
                <div
                  className={refBadgeClass}
                  style={{ left: refPositions.window.x, top: refPositions.window.y }}
                  onMouseDown={e => startRefDrag(e, 'window')}
                >
                  <span className={refIconClass}>🪟</span>
                  <span className={refTextClass}>窗</span>
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="inline-grid pointer-events-auto" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)`, gap: `${tableGap}px` }}>
                  {assignment.map((people, i) => renderRoundTable(i, people))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">圆形桌智能教室，每桌 {seatsPerTable} 人，共 {tableCount} 桌（{tableRows} 行 × {tableCols} 列）</p>
          </div>
        )}
      </div>

      {assignment.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          点击桌心可切换保留/开放；保留桌自动排座时不安排学生；拖拽姓名可交换座位；点击空座位可关闭/开放使用；幕布/讲台/前后门/窗支持显隐与拖拽
        </p>
      )}
      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={assignment}
        studentNames={students.map(s => s.name)}
        sceneType="smartClassroom"
        sceneConfig={exportSceneConfig}
        className={exportClassName}
        pngFileName={recordName.trim() || '智能教室座位'}
        onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)}
      />
    </div>
  );
}

