import { useState, useRef, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle, QrCode } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import { useSeatExportQr } from './useSeatExportQr';

interface Props {
  students: { id: string; name: string }[];
}

type ConferenceSeatMode = 'balanced' | 'groupCluster' | 'verticalS' | 'horizontalS';
type RefKey = 'screen' | 'podium' | 'window' | 'frontDoor' | 'backDoor';
type RefPositions = Record<RefKey, { x: number; y: number }>;
type RefVisible = Record<RefKey, boolean>;

type ConferenceAssignment = {
  headLeft: string;
  headRight: string;
  mainTop: string[];
  mainBottom: string[];
  companionTop: string[][];
  companionBottom: string[][];
};

function splitIntoGroups(names: string[], count: number) {
  const groups: string[][] = Array.from({ length: count }, () => []);
  names.forEach((n, i) => groups[i % count].push(n));
  return groups;
}

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
    backDoor: { x: rightX, y: Math.max(160, roomHeight - 56) },
  };
}

export default function ConferenceRoom({ students }: Props) {
  const [seatsPerSide, setSeatsPerSide] = useState(10);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<ConferenceSeatMode>('balanced');
  const [seatGap, setSeatGap] = useState(6);
  const [showCompanionSeats, setShowCompanionSeats] = useState(true);
  const [companionRows, setCompanionRows] = useState(1);
  const [assignment, setAssignment] = useState<ConferenceAssignment>({
    headLeft: '',
    headRight: '',
    mainTop: Array.from({ length: 10 }, () => ''),
    mainBottom: Array.from({ length: 10 }, () => ''),
    companionTop: [Array.from({ length: 10 }, () => '')],
    companionBottom: [Array.from({ length: 10 }, () => '')],
  });
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [seated, setSeated] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const [refVisible, setRefVisible] = useState<RefVisible>({
    screen: true,
    podium: true,
    window: true,
    frontDoor: true,
    backDoor: true,
  });
  const [refLocked, setRefLocked] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const refDraggingRef = useRef<{ key: RefKey; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const seatW = 64;
  const seatH = 40;
  const gap = seatGap;
  const tableH = 64;
  const tableW = seatsPerSide * (seatW + gap) + gap;
  const headGap = 12;
  const sideGap = 10;

  const contentWidth = tableW + 2 * (seatW + headGap);
  const contentHeight =
    tableH +
    2 * (seatH + sideGap) +
    (showCompanionSeats ? 2 * companionRows * (seatH + sideGap) : 0);

  const roomWidth = Math.max(920, contentWidth + 160);
  const roomHeight = Math.max(640, contentHeight + 220);
  const exportSceneConfig = {
    seatsPerSide,
    companionRows: showCompanionSeats ? companionRows : 0,
  };
  const { className: exportClassName, resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: assignment,
    studentNames: students.map(s => s.name),
    sceneConfig: exportSceneConfig,
    sceneType: 'conference',
  });

  const tableX = (roomWidth - tableW) / 2;
  const tableY = (roomHeight - tableH) / 2;

  const defaultRefPositions = useMemo(
    () => buildDefaultRefPositions(roomWidth, roomHeight),
    [roomWidth, roomHeight]
  );

  const [refPositions, setRefPositions] = useState<RefPositions>(() =>
    buildDefaultRefPositions(920, 640)
  );

  const refBadgeClass =
    'absolute h-8 pl-2 pr-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm cursor-move select-none inline-flex items-center gap-1.5';
  const refIconClass =
    'inline-flex items-center justify-center w-5 h-5 rounded-md border border-primary/30 bg-background/80 text-[11px] leading-none';
  const refTextClass = 'text-[11px] font-medium leading-none tracking-wide';

  const sideOrderSlots = useMemo(() => {
    const slots: { side: 'top' | 'bottom'; index: number }[] = [];

    if (mode === 'verticalS') {
      for (let c = 0; c < seatsPerSide; c++) {
        if (c % 2 === 0) {
          slots.push({ side: 'top', index: c });
          slots.push({ side: 'bottom', index: c });
        } else {
          slots.push({ side: 'bottom', index: c });
          slots.push({ side: 'top', index: c });
        }
      }
      return slots;
    }

    if (mode === 'horizontalS' || mode === 'groupCluster') {
      for (let c = 0; c < seatsPerSide; c++) slots.push({ side: 'top', index: c });
      for (let c = seatsPerSide - 1; c >= 0; c--) slots.push({ side: 'bottom', index: c });
      return slots;
    }

    for (let c = 0; c < seatsPerSide; c++) slots.push({ side: 'top', index: c });
    for (let c = 0; c < seatsPerSide; c++) slots.push({ side: 'bottom', index: c });
    return slots;
  }, [mode, seatsPerSide]);

  const allSlots = useMemo(() => {
    const slots: string[] = ['head-left', 'head-right'];

    sideOrderSlots.forEach(({ side, index }) => {
      slots.push(`main-${side}-${index}`);
    });

    if (showCompanionSeats) {
      for (let r = 0; r < companionRows; r++) {
        sideOrderSlots.forEach(({ side, index }) => {
          slots.push(`companion-${side}-${r}-${index}`);
        });
      }
    }

    return slots;
  }, [companionRows, showCompanionSeats, sideOrderSlots]);

  useEffect(() => {
    setRefPositions(defaultRefPositions);
  }, [defaultRefPositions]);

  useEffect(() => {
    setAssignment(prev => ({
      headLeft: prev.headLeft,
      headRight: prev.headRight,
      mainTop: Array.from({ length: seatsPerSide }, (_, i) => prev.mainTop[i] || ''),
      mainBottom: Array.from({ length: seatsPerSide }, (_, i) => prev.mainBottom[i] || ''),
      companionTop: Array.from({ length: companionRows }, (_, r) =>
        Array.from({ length: seatsPerSide }, (_, i) => prev.companionTop[r]?.[i] || '')
      ),
      companionBottom: Array.from({ length: companionRows }, (_, r) =>
        Array.from({ length: seatsPerSide }, (_, i) => prev.companionBottom[r]?.[i] || '')
      ),
    }));
  }, [seatsPerSide, companionRows]);

  useEffect(() => {
    setClosedSeats(prev => {
      const next = new Set<string>();
      allSlots.forEach(slot => {
        if (prev.has(slot)) next.add(slot);
      });
      return next;
    });
  }, [allSlots]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!refDraggingRef.current) return;
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
    };

    const handleMouseUp = () => {
      refDraggingRef.current = null;
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

  const getSeatValue = (data: ConferenceAssignment, slot: string) => {
    if (slot === 'head-left') return data.headLeft;
    if (slot === 'head-right') return data.headRight;

    const parts = slot.split('-');
    if (parts[0] === 'main') {
      const side = parts[1] as 'top' | 'bottom';
      const index = Number(parts[2]);
      return side === 'top' ? data.mainTop[index] || '' : data.mainBottom[index] || '';
    }

    const side = parts[1] as 'top' | 'bottom';
    const row = Number(parts[2]);
    const index = Number(parts[3]);
    return side === 'top'
      ? data.companionTop[row]?.[index] || ''
      : data.companionBottom[row]?.[index] || '';
  };

  const setSeatValue = (data: ConferenceAssignment, slot: string, value: string) => {
    if (slot === 'head-left') {
      data.headLeft = value;
      return;
    }
    if (slot === 'head-right') {
      data.headRight = value;
      return;
    }

    const parts = slot.split('-');
    if (parts[0] === 'main') {
      const side = parts[1] as 'top' | 'bottom';
      const index = Number(parts[2]);
      if (side === 'top') data.mainTop[index] = value;
      else data.mainBottom[index] = value;
      return;
    }

    const side = parts[1] as 'top' | 'bottom';
    const row = Number(parts[2]);
    const index = Number(parts[3]);
    if (side === 'top') data.companionTop[row][index] = value;
    else data.companionBottom[row][index] = value;
  };

  const toggleSeatOpen = (slot: string) => {
    setClosedSeats(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

    const next: ConferenceAssignment = {
      headLeft: '',
      headRight: '',
      mainTop: Array.from({ length: seatsPerSide }, () => ''),
      mainBottom: Array.from({ length: seatsPerSide }, () => ''),
      companionTop: Array.from({ length: companionRows }, () => Array.from({ length: seatsPerSide }, () => '')),
      companionBottom: Array.from({ length: companionRows }, () => Array.from({ length: seatsPerSide }, () => '')),
    };

    const availableSlots = allSlots.filter(slot => !closedSeats.has(slot));

    if (mode === 'groupCluster') {
      const groups = splitIntoGroups(names, Math.max(1, groupCount));
      let cursor = 0;
      groups.forEach(group => {
        group.forEach(n => {
          if (cursor >= availableSlots.length) return;
          setSeatValue(next, availableSlots[cursor++], n);
        });
      });
    } else {
      names.slice(0, availableSlots.length).forEach((name, i) => {
        setSeatValue(next, availableSlots[i], name);
      });
    }

    setAssignment(next);
    setSeated(true);
  };

  const renderSeat = (x: number, y: number, name: string, slot: string) => {
    const isClosed = closedSeats.has(slot);
    const isDragging = dragFrom === slot;
    const isOver = dropTarget === slot;

    return (
      <g
        key={slot}
        style={{ cursor: name && !isClosed ? 'grab' : 'pointer' }}
        onMouseDown={
          name && !isClosed
            ? e => {
                e.stopPropagation();
                setDragFrom(slot);
                setDropTarget(slot);
              }
            : undefined
        }
        onMouseEnter={() => {
          if (dragFrom && !isClosed) setDropTarget(slot);
        }}
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
            const next: ConferenceAssignment = {
              headLeft: prev.headLeft,
              headRight: prev.headRight,
              mainTop: [...prev.mainTop],
              mainBottom: [...prev.mainBottom],
              companionTop: prev.companionTop.map(row => [...row]),
              companionBottom: prev.companionBottom.map(row => [...row]),
            };

            const fromVal = getSeatValue(next, from);
            const toVal = getSeatValue(next, to);
            setSeatValue(next, from, toVal);
            setSeatValue(next, to, fromVal);
            return next;
          });

          setDragFrom(null);
          setDropTarget(null);
        }}
        onClick={() => {
          if (!name) toggleSeatOpen(slot);
        }}
      >
        <rect
          x={x}
          y={y}
          width={seatW}
          height={seatH}
          rx={6}
          className={
            isClosed
              ? 'fill-muted stroke-destructive/60'
              : isDragging
                ? 'fill-primary/20 stroke-primary'
                : isOver
                  ? 'fill-accent stroke-primary'
                  : name
                    ? 'fill-card stroke-border'
                    : 'fill-muted/50 stroke-border/50'
          }
          strokeWidth={isOver ? 2.5 : 1.5}
        />
        {isClosed && (
          <text
            x={x + seatW / 2}
            y={y + seatH / 2 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-destructive text-xs"
          >
            关
          </text>
        )}
        {name && !isDragging && (
          <text
            x={x + seatW / 2}
            y={y + seatH / 2 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-xs"
          >
            {name.length > 3 ? name.slice(0, 3) : name}
          </text>
        )}
      </g>
    );
  };

  return (
    <div
      onMouseUp={() => {
        setDragFrom(null);
        setDropTarget(null);
      }}
      onMouseLeave={() => {
        setDragFrom(null);
        setDropTarget(null);
      }}
    >
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          每边主座位数
          <Input
            type="number"
            min={4}
            max={18}
            value={seatsPerSide}
            onChange={e => setSeatsPerSide(Math.max(4, Math.min(18, Number(e.target.value))))}
            className="w-16 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          座位间距
          <Input
            type="number"
            min={2}
            max={20}
            value={seatGap}
            onChange={e => setSeatGap(Math.max(2, Math.min(20, Number(e.target.value))))}
            className="w-16 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showCompanionSeats}
            onChange={e => setShowCompanionSeats(e.target.checked)}
            className="accent-primary"
          />
          显示陪同人员座位
        </label>
        {showCompanionSeats && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            陪同座位列数
            <Input
              type="number"
              min={1}
              max={4}
              value={companionRows}
              onChange={e => setCompanionRows(Math.max(1, Math.min(4, Number(e.target.value))))}
              className="w-14 h-8 text-center"
            />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          模式
          <select
            value={mode}
            onChange={e => setMode(e.target.value as ConferenceSeatMode)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="balanced">两侧平衡</option>
            <option value="groupCluster">分组同侧</option>
            <option value="verticalS">竖S分配</option>
            <option value="horizontalS">横S分配</option>
          </select>
        </label>
        {mode === 'groupCluster' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            组数
            <Input
              type="number"
              min={2}
              max={20}
              value={groupCount}
              onChange={e => setGroupCount(Math.max(2, Math.min(20, Number(e.target.value))))}
              className="w-16 h-8 text-center"
            />
          </label>
        )}
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
            <input type="checkbox" checked={refVisible.window} onChange={() => toggleRefVisible('window')} className="accent-primary" /> 窗
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={refVisible.frontDoor}
              onChange={() => toggleRefVisible('frontDoor')}
              className="accent-primary"
            />
            前门
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={refVisible.backDoor}
              onChange={() => toggleRefVisible('backDoor')}
              className="accent-primary"
            />
            后门
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refLocked} onChange={e => setRefLocked(e.target.checked)} className="accent-primary" /> 锁定参照物
          </label>
        </div>
        {seated && <ExportButtons targetRef={printRef} filename="会议室座位" resolveQrCode={resolveQrCode} />}
        {seated && (
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
        {seated ? (
          <div className="flex justify-center overflow-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="relative rounded-xl border border-border bg-card/40" style={{ width: roomWidth, height: roomHeight }}>
              {refVisible.screen && (
                <div className={refBadgeClass} style={{ left: refPositions.screen.x, top: refPositions.screen.y }} onMouseDown={e => startRefDrag(e, 'screen')}>
                  <span className={refIconClass}>🖥️</span>
                  <span className={refTextClass}>幕布</span>
                </div>
              )}
              {refVisible.podium && (
                <div className={refBadgeClass} style={{ left: refPositions.podium.x, top: refPositions.podium.y }} onMouseDown={e => startRefDrag(e, 'podium')}>
                  <span className={refIconClass}>🏫</span>
                  <span className={refTextClass}>讲台</span>
                </div>
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

              <svg width={roomWidth} height={roomHeight} viewBox={`0 0 ${roomWidth} ${roomHeight}`} className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
                <rect x={tableX} y={tableY} width={tableW} height={tableH} rx={10} className="fill-primary/10 stroke-primary/30" strokeWidth={2} />

                {Array.from({ length: seatsPerSide }).map((_, i) => {
                  const x = tableX + gap + i * (seatW + gap);
                  const y = tableY - seatH - sideGap;
                  return renderSeat(x, y, assignment.mainTop[i] || '', `main-top-${i}`);
                })}

                {Array.from({ length: seatsPerSide }).map((_, i) => {
                  const x = tableX + gap + i * (seatW + gap);
                  const y = tableY + tableH + sideGap;
                  return renderSeat(x, y, assignment.mainBottom[i] || '', `main-bottom-${i}`);
                })}

                {showCompanionSeats &&
                  Array.from({ length: companionRows }).map((_, row) => (
                    <g key={`companion-row-${row}`}>
                      {Array.from({ length: seatsPerSide }).map((__, i) => {
                        const x = tableX + gap + i * (seatW + gap);
                        const topY = tableY - seatH - sideGap - (row + 1) * (seatH + sideGap);
                        const bottomY = tableY + tableH + sideGap + (row + 1) * (seatH + sideGap);
                        return (
                          <g key={`companion-slot-${row}-${i}`}>
                            {renderSeat(x, topY, assignment.companionTop[row]?.[i] || '', `companion-top-${row}-${i}`)}
                            {renderSeat(x, bottomY, assignment.companionBottom[row]?.[i] || '', `companion-bottom-${row}-${i}`)}
                          </g>
                        );
                      })}
                    </g>
                  ))}

                {renderSeat(tableX - seatW - headGap, tableY + (tableH - seatH) / 2, assignment.headLeft, 'head-left')}
                {renderSeat(tableX + tableW + headGap, tableY + (tableH - seatH) / 2, assignment.headRight, 'head-right')}

                <text
                  x={tableX + tableW / 2}
                  y={tableY + tableH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-primary text-sm font-medium"
                >
                  会议桌
                </text>
              </svg>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">
              会议桌初始每边 {seatsPerSide} 人，
              {showCompanionSeats ? `每侧陪同 ${companionRows} 列` : '不显示陪同座位'}
            </p>
          </div>
        )}
      </div>

      {seated && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          拖拽姓名可换座；点击空座位可关闭/开放使用；幕布/讲台/窗/前后门支持显隐与拖拽
        </p>
      )}
      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={assignment}
        studentNames={students.map(s => s.name)}
        sceneType="conference"
        sceneConfig={exportSceneConfig}
        className={exportClassName}
        onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)}
      />
    </div>
  );
}
