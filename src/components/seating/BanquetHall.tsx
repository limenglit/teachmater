import { useState, useRef, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle, QrCode } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import { useRoundTableDrag } from './useRoundTableDrag';
import { useSeatExportQr } from './useSeatExportQr';

interface Props {
  students: { id: string; name: string }[];
}

type BanquetSeatMode = 'tableRoundRobin' | 'tableGrouped' | 'verticalS' | 'horizontalS';
type RefKey = 'screen' | 'podium' | 'window' | 'frontDoor' | 'backDoor';
type RefPositions = Record<RefKey, { x: number; y: number }>;
type RefVisible = Record<RefKey, boolean>;

function buildDefaultRefPositions(roomWidth: number, roomHeight: number): RefPositions {
  const badgeW = 94;
  const centerX = Math.round((roomWidth - badgeW) / 2);
  const rightX = Math.max(24, roomWidth - badgeW - 24);
  const midY = Math.max(20, Math.round((roomHeight - 32) / 2));
  return {
    screen: { x: centerX, y: 22 },
    podium: { x: centerX, y: 74 },
    window: { x: 24, y: midY },
    frontDoor: { x: rightX, y: 120 },
    backDoor: { x: rightX, y: Math.max(180, roomHeight - 56) },
  };
}

export default function BanquetHall({ students }: Props) {
  const [seatsPerTable, setSeatsPerTable] = useState(10);
  const [tableCount, setTableCount] = useState(() => Math.ceil(students.length / 10) || 3);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<BanquetSeatMode>('tableRoundRobin');
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [tableGap, setTableGap] = useState(24);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [tablePositions, setTablePositions] = useState<{ x: number; y: number }[]>([]);
  const [refVisible, setRefVisible] = useState<RefVisible>({
    screen: true,
    podium: true,
    window: true,
    frontDoor: true,
    backDoor: true,
  });
  const [refLocked, setRefLocked] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ index: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const refDraggingRef = useRef<{ key: RefKey; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const seatDraggingRef = useRef(false);
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

  const tableCols = Math.ceil(Math.sqrt(tableCount));
  const tableRows = Math.ceil(tableCount / tableCols);
  const roomWidth = Math.max(980, tableCols * 180 + Math.max(0, tableCols - 1) * tableGap + 260);
  const roomHeight = Math.max(720, tableRows * 180 + Math.max(0, tableRows - 1) * tableGap + 280);
  const exportSceneConfig = { seatsPerTable, tableCount, tableCols: Math.ceil(Math.sqrt(tableCount)) };
  const { className: exportClassName, resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: assignment,
    studentNames: students.map(s => s.name),
    sceneConfig: exportSceneConfig,
    sceneType: 'banquet',
  });
  const tableCellSize = 170;
  const tStageRunwayWidth = 56;
  const hasTStage = refVisible.podium;
  const splitIndex = Math.ceil(tableCols / 2);
  const tStageTopWidth = Math.max(320, Math.min(roomWidth * 0.56, tableCols * 180));
  const tStageTopY = 116;
  const tStageTopHeight = 28;
  const tStageRunwayTop = tStageTopY + tStageTopHeight - 2;
  const tStageRunwayBottom = roomHeight - 64;
  const tStageRunwayHeight = Math.max(120, tStageRunwayBottom - tStageRunwayTop);
  const defaultRefPositions = useMemo(() => buildDefaultRefPositions(roomWidth, roomHeight), [roomWidth, roomHeight]);
  const [refPositions, setRefPositions] = useState<RefPositions>(() => buildDefaultRefPositions(980, 720));
  const refBadgeClass = 'absolute h-8 pl-2 pr-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm cursor-move select-none inline-flex items-center gap-1.5';
  const refIconClass = 'inline-flex items-center justify-center w-5 h-5 rounded-md border border-primary/30 bg-background/80 text-[11px] leading-none';
  const refTextClass = 'text-[11px] font-medium leading-none tracking-wide';

  const placeName = (tables: string[][], preferred: number, name: string) => {
    const order = [preferred, ...Array.from({ length: tableCount }, (_, i) => i).filter(i => i !== preferred)];
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
    const tables: string[][] = Array.from({ length: tableCount }, () => Array.from({ length: seatsPerTable }, () => ''));

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
    const matchedTableCount = Math.max(1, Math.ceil(students.length / Math.max(1, seatsPerTable)));
    setTableCount(matchedTableCount);
  }, [students.length, seatsPerTable]);

  useEffect(() => {
    setRefPositions(defaultRefPositions);
  }, [defaultRefPositions]);

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

  const renderBanquetTable = (tableIndex: number, people: string[]) => {
    const radius = 60;
    const seatRadius = 16;
    const cx = 85;
    const cy = 85;
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
            const isClosed = closedSeats.has(seatKey(tableIndex, i));
            const isDragging = dragFrom?.table === tableIndex && dragFrom?.seat === i;
            const isOver = dropTarget?.table === tableIndex && dropTarget?.seat === i;
            return (
              <g
                key={i}
                style={{ cursor: name && !isClosed ? 'grab' : 'pointer' }}
                onMouseDown={name && !isClosed ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  seatDraggingRef.current = true;
                  handleDragStart(tableIndex, i);
                } : undefined}
                onMouseEnter={() => { if (dragFrom && !isClosed) handleDragOver(tableIndex, i); }}
                onMouseUp={() => {
                  if (dragFrom && !isClosed) handleDrop(tableIndex, i);
                  seatDraggingRef.current = false;
                }}
                onClick={() => { if (!name) toggleSeatOpen(tableIndex, i); }}
              >
                <circle
                  cx={sx}
                  cy={sy}
                  r={seatRadius}
                  className={
                    isClosed ? 'fill-muted stroke-destructive/60' :
                    isDragging ? 'fill-primary/20 stroke-primary' :
                    isOver ? 'fill-accent stroke-primary' :
                    name ? 'fill-card stroke-border hover:stroke-primary/50' : 'fill-muted/30 stroke-border/30'
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
      }}
      onMouseLeave={() => {
        handleDragEnd();
        seatDraggingRef.current = false;
      }}
    >
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          每桌人数
          <Input type="number" min={6} max={16} value={seatsPerTable}
            onChange={e => setSeatsPerTable(Math.max(6, Math.min(16, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          自动桌数
          <span className="inline-flex items-center justify-center min-w-10 h-8 px-2 rounded-md border border-border bg-muted/40 text-foreground font-medium">
            {tableCount}
          </span>
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
        <Button variant="outline" onClick={() => setRefPositions(defaultRefPositions)}>
          重置参照物
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.screen} onChange={() => toggleRefVisible('screen')} className="accent-primary" /> 幕布
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.podium} onChange={() => toggleRefVisible('podium')} className="accent-primary" /> T型舞台
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.window} onChange={() => toggleRefVisible('window')} className="accent-primary" /> 窗
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.frontDoor} onChange={() => toggleRefVisible('frontDoor')} className="accent-primary" /> 前门
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.backDoor} onChange={() => toggleRefVisible('backDoor')} className="accent-primary" /> 后门
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refLocked} onChange={e => setRefLocked(e.target.checked)} className="accent-primary" /> 锁定参照物
          </label>
        </div>
        <span className="text-xs text-muted-foreground">
          共可容纳 {seatsPerTable * tableCount} 人 | 当前 {students.length} 人
        </span>
        {assignment.length > 0 && <ExportButtons targetRef={printRef} filename="宴会厅座位" resolveQrCode={resolveQrCode} />}
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
        <div className="text-center mb-4">
          <div className="inline-block bg-primary/10 text-primary px-6 py-2 rounded-lg text-sm font-medium border border-primary/20">
            宴会厅
          </div>
        </div>

        {assignment.length > 0 ? (
          <div className="flex justify-center overflow-auto">
            <div className="relative rounded-xl border border-border bg-card/40" style={{ width: roomWidth, height: roomHeight }}>
              {refVisible.screen && (
                <div className={refBadgeClass} style={{ left: refPositions.screen.x, top: refPositions.screen.y }} onMouseDown={e => startRefDrag(e, 'screen')}>
                  <span className={refIconClass}>🖥️</span>
                  <span className={refTextClass}>幕布</span>
                </div>
              )}
              {hasTStage && (
                <>
                  <div
                    className="absolute rounded-xl border border-primary/35 bg-primary/12 shadow-sm pointer-events-none"
                    style={{
                      left: `calc(50% - ${tStageTopWidth / 2}px)`,
                      top: tStageTopY,
                      width: tStageTopWidth,
                      height: tStageTopHeight,
                    }}
                  />
                  <div
                    className="absolute rounded-xl border border-primary/35 bg-primary/12 shadow-sm pointer-events-none"
                    style={{
                      left: `calc(50% - ${tStageRunwayWidth / 2}px)`,
                      top: tStageRunwayTop,
                      width: tStageRunwayWidth,
                      height: tStageRunwayHeight,
                    }}
                  />
                  <div
                    className="absolute text-[11px] font-medium text-primary/80 select-none pointer-events-none"
                    style={{ left: '50%', top: tStageTopY + 6, transform: 'translateX(-50%)' }}
                  >
                    T型舞台
                  </div>
                </>
              )}
              {refVisible.window && (
                <div className={refBadgeClass} style={{ left: refPositions.window.x, top: refPositions.window.y }} onMouseDown={e => startRefDrag(e, 'window')}>
                  <span className={refIconClass}>🪟</span>
                  <span className={refTextClass}>窗</span>
                </div>
              )}
              {refVisible.frontDoor && (
                <div className={refBadgeClass} style={{ left: refPositions.frontDoor.x, top: refPositions.frontDoor.y }} onMouseDown={e => startRefDrag(e, 'frontDoor')}>
                  <span className={refIconClass}>🚪</span>
                  <span className={refTextClass}>前门</span>
                </div>
              )}
              {refVisible.backDoor && (
                <div className={refBadgeClass} style={{ left: refPositions.backDoor.x, top: refPositions.backDoor.y }} onMouseDown={e => startRefDrag(e, 'backDoor')}>
                  <span className={refIconClass}>🚪</span>
                  <span className={refTextClass}>后门</span>
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="inline-grid pointer-events-auto"
                  style={{
                    gridTemplateColumns: hasTStage && tableCols > 1
                      ? `repeat(${splitIndex}, ${tableCellSize}px) ${tStageRunwayWidth}px repeat(${tableCols - splitIndex}, ${tableCellSize}px)`
                      : `repeat(${tableCols}, ${tableCellSize}px)`,
                    columnGap: `${tableGap}px`,
                    rowGap: `${tableGap}px`,
                  }}
                >
                  {assignment.map((people, i) => {
                    const col = i % tableCols;
                    const row = Math.floor(i / tableCols);
                    const visualCol = hasTStage && tableCols > 1 && col >= splitIndex ? col + 2 : col + 1;
                    return (
                      <div key={`banquet-table-cell-${i}`} style={{ gridColumn: visualCol, gridRow: row + 1 }}>
                        {renderBanquetTable(i, people)}
                      </div>
                    );
                  })}
                </div>
              </div>
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
          拖拽姓名可交换座位；点击空座位可关闭/开放使用；幕布/T型舞台/窗/前后门支持显隐与拖拽
        </p>
      )}
      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={assignment}
        studentNames={students.map(s => s.name)}
        sceneType="banquet"
        sceneConfig={exportSceneConfig}
        className={exportClassName}
        onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)}
      />
    </div>
  );
}
