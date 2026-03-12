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

type ConcertSeatMode = 'arcBalanced' | 'groupZone' | 'verticalS' | 'horizontalS';
type RefKey = 'screen' | 'podium' | 'window' | 'frontDoor' | 'backDoor';
type RefPositions = Record<RefKey, { x: number; y: number }>;
type RefVisible = Record<RefKey, boolean>;

function getAutoRowCount(totalStudents: number, baseSeatsPerRow: number, minRows = 2, maxRows = 10) {
  if (totalStudents <= 0) return minRows;
  for (let rows = minRows; rows <= maxRows; rows++) {
    // Capacity with arithmetic growth: base, base+2, ...
    const capacity = rows * (baseSeatsPerRow + rows - 1);
    if (capacity >= totalStudents) return rows;
  }
  return maxRows;
}

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
    backDoor: { x: rightX, y: Math.max(180, roomHeight - 56) },
  };
}

export default function ConcertHall({ students }: Props) {
  const [seatsPerRow, setSeatsPerRow] = useState(12);
  const [rowCount, setRowCount] = useState(() => getAutoRowCount(students.length, 12));
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<ConcertSeatMode>('arcBalanced');
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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

  const seatCaps = useMemo(
    () => Array.from({ length: rowCount }, (_, r) => seatsPerRow + r * 2),
    [rowCount, seatsPerRow]
  );
  const seatKey = (row: number, col: number) => `${row}-${col}`;

  const seatR = 18;
  const stageW = 180;
  const stageH = 40;
  const stageY = 156;
  const startRadius = 118;
  const arcAngle = Math.PI * 0.94;

  const rowRadii = useMemo(() => {
    const minCenterDistance = seatR * 2 + 10;
    const minCenterDistanceSq = minCenterDistance * minCenterDistance;
    const minRowStep = seatR * 2 + 6;

    const getAngles = (seatCount: number) => {
      if (seatCount <= 1) return [Math.PI / 2];
      const startAngle = Math.PI - (Math.PI - arcAngle) / 2;
      const endAngle = (Math.PI - arcAngle) / 2;
      return Array.from({ length: seatCount }, (_, ci) => {
        const frac = ci / (seatCount - 1);
        return startAngle - frac * (startAngle - endAngle);
      });
    };

    const radii: number[] = [];
    const angleRows = seatCaps.map(cap => getAngles(cap));

    seatCaps.forEach((seatCount, ri) => {
      let radius = startRadius;

      if (seatCount > 1) {
        const theta = arcAngle / (seatCount - 1);
        const spacingRadius = minCenterDistance / (2 * Math.sin(theta / 2));
        radius = Math.max(radius, spacingRadius);
      }

      if (ri > 0) {
        const prevRadius = radii[ri - 1];
        const prevAngles = angleRows[ri - 1];
        const currAngles = angleRows[ri];
        radius = Math.max(radius, prevRadius + minRowStep);

        // Ensure the new row is far enough from the previous row at every seat angle pair.
        while (true) {
          let hasOverlap = false;

          for (const currAngle of currAngles) {
            for (const prevAngle of prevAngles) {
              const delta = currAngle - prevAngle;
              const distSq =
                prevRadius * prevRadius +
                radius * radius -
                2 * prevRadius * radius * Math.cos(delta);
              if (distSq < minCenterDistanceSq) {
                hasOverlap = true;
                break;
              }
            }
            if (hasOverlap) break;
          }

          if (!hasOverlap) break;
          radius += 1;
        }
      }

      radii.push(radius);
    });

    return radii;
  }, [arcAngle, seatCaps, seatR, startRadius]);

  const maxRadius = rowRadii[rowRadii.length - 1] || startRadius;
  const maxArcWidth = Math.max(520, maxRadius * 2 + seatR * 2);
  const roomWidth = Math.max(960, Math.round(maxArcWidth + 220));
  const lowestSeatY = stageY + 20 + maxRadius + seatR;
  const roomHeight = Math.max(700, Math.round(lowestSeatY + 100));
  const exportSceneConfig = { seatsPerRow, rowCount };
  const { className: exportClassName, resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: assignment,
    studentNames: students.map(s => s.name),
    sceneConfig: exportSceneConfig,
    sceneType: 'concertHall',
  });

  const cx = roomWidth / 2;
  const defaultRefPositions = useMemo(
    () => buildDefaultRefPositions(roomWidth, roomHeight),
    [roomWidth, roomHeight]
  );
  const [refPositions, setRefPositions] = useState<RefPositions>(() => buildDefaultRefPositions(960, 700));

  const refBadgeClass =
    'absolute h-8 pl-2 pr-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm cursor-move select-none inline-flex items-center gap-1.5';
  const refIconClass =
    'inline-flex items-center justify-center w-5 h-5 rounded-md border border-primary/30 bg-background/80 text-[11px] leading-none';
  const refTextClass = 'text-[11px] font-medium leading-none tracking-wide';

  useEffect(() => {
    const nextRows = getAutoRowCount(students.length, seatsPerRow);
    setRowCount(prev => (prev === nextRows ? prev : nextRows));
  }, [students.length, seatsPerRow]);

  useEffect(() => {
    setRefPositions(defaultRefPositions);
  }, [defaultRefPositions]);

  useEffect(() => {
    setClosedSeats(prev => {
      const next = new Set<string>();
      prev.forEach(key => {
        const [rStr, cStr] = key.split('-');
        const r = Number(rStr);
        const c = Number(cStr);
        if (r < rowCount && c < seatCaps[r]) next.add(key);
      });
      return next;
    });
  }, [rowCount, seatCaps]);

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

  const toggleSeatOpen = (row: number, col: number) => {
    const key = seatKey(row, col);
    setClosedSeats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

  const seatOrder = (seatMode: ConcertSeatMode) => {
    const slots: { row: number; col: number }[] = [];

    if (seatMode === 'verticalS') {
      const maxCols = Math.max(...seatCaps);
      for (let c = 0; c < maxCols; c++) {
        for (let ri = 0; ri < rowCount; ri++) {
          const r = c % 2 === 0 ? ri : rowCount - 1 - ri;
          if (c < seatCaps[r]) slots.push({ row: r, col: c });
        }
      }
      return slots;
    }

    if (seatMode === 'horizontalS') {
      for (let r = 0; r < rowCount; r++) {
        const cap = seatCaps[r];
        for (let ci = 0; ci < cap; ci++) {
          const c = r % 2 === 0 ? ci : cap - 1 - ci;
          slots.push({ row: r, col: c });
        }
      }
      return slots;
    }

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < seatCaps[r]; c++) slots.push({ row: r, col: c });
    }
    return slots;
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

    const rows: string[][] = seatCaps.map(cap => Array.from({ length: cap }, () => ''));

    if (mode === 'groupZone') {
      const groups = splitIntoGroups(names, Math.max(1, groupCount));
      const slots = seatOrder('horizontalS').filter(slot => !closedSeats.has(seatKey(slot.row, slot.col)));
      let cursor = 0;
      groups.forEach(group => {
        group.forEach(n => {
          if (cursor >= slots.length) return;
          const slot = slots[cursor++];
          rows[slot.row][slot.col] = n;
        });
      });
    } else {
      const slots = seatOrder(mode).filter(slot => !closedSeats.has(seatKey(slot.row, slot.col)));
      names.slice(0, slots.length).forEach((n, i) => {
        const slot = slots[i];
        rows[slot.row][slot.col] = n;
      });
    }

    setAssignment(rows);
  };

  const nameTextLength = Math.max(28, seatR * 1.95);
  const totalCapacity = rowCount * (seatsPerRow + rowCount - 1);

  return (
    <div onMouseUp={() => { setDragFrom(null); setDropTarget(null); }} onMouseLeave={() => { setDragFrom(null); setDropTarget(null); }}>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          每排基准座位
          <Input type="number" min={6} max={24} value={seatsPerRow}
            onChange={e => setSeatsPerRow(Math.max(6, Math.min(24, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground px-2.5 h-8 rounded-md border border-border bg-muted/40">
          自动排数
          <span className="text-foreground font-medium">{rowCount}</span>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground px-2.5 h-8 rounded-md border border-border bg-muted/40">
          容量 {totalCapacity} 人
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          模式
          <select
            value={mode}
            onChange={e => setMode(e.target.value as ConcertSeatMode)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="arcBalanced">扇区平衡</option>
            <option value="groupZone">分组分区</option>
            <option value="verticalS">竖S分配</option>
            <option value="horizontalS">横S分配</option>
          </select>
        </label>
        {mode === 'groupZone' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            组数
            <Input type="number" min={2} max={20} value={groupCount}
              onChange={e => setGroupCount(Math.max(2, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
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
            <input type="checkbox" checked={refVisible.frontDoor} onChange={() => toggleRefVisible('frontDoor')} className="accent-primary" /> 前门
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.backDoor} onChange={() => toggleRefVisible('backDoor')} className="accent-primary" /> 后门
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refLocked} onChange={e => setRefLocked(e.target.checked)} className="accent-primary" /> 锁定参照物
          </label>
        </div>
        {assignment.length > 0 && <ExportButtons targetRef={printRef} filename="音乐厅座位" resolveQrCode={resolveQrCode} />}
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
          <div className="flex justify-center overflow-auto">
            <div className="relative rounded-xl border border-border bg-card/40" style={{ width: roomWidth, height: roomHeight }}>
              {refVisible.screen && (
                <div className={refBadgeClass} style={{ left: refPositions.screen.x, top: refPositions.screen.y }} onMouseDown={e => startRefDrag(e, 'screen')}>
                  <span className={refIconClass}>🖥️</span>
                  <span className={refTextClass}>幕布</span>
                </div>
              )}
              {refVisible.podium && (
                <div className={refBadgeClass} style={{ left: refPositions.podium.x, top: refPositions.podium.y }} onMouseDown={e => startRefDrag(e, 'podium')}>
                  <span className={refIconClass}>🎤</span>
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
                <rect x={cx - stageW / 2} y={stageY - stageH / 2} width={stageW} height={stageH} rx={10}
                  className="fill-primary/15 stroke-primary/30" strokeWidth={2} />
                <text x={cx} y={stageY} textAnchor="middle" dominantBaseline="middle" className="fill-primary text-sm font-medium">
                  🎵 舞 台
                </text>

                {assignment.map((row, ri) => {
                  const r = rowRadii[ri] || startRadius;
                  const seatCount = row.length;
                  const totalAngle = arcAngle;
                  const startAngle = Math.PI - (Math.PI - totalAngle) / 2;
                  const endAngle = (Math.PI - totalAngle) / 2;

                  return row.map((name, ci) => {
                    const frac = seatCount <= 1 ? 0.5 : ci / (seatCount - 1);
                    const angle = startAngle - frac * (startAngle - endAngle);
                    const sx = cx + r * Math.cos(angle);
                    const sy = stageY + 22 + r * Math.sin(angle);

                    const slot = seatKey(ri, ci);
                    const isClosed = closedSeats.has(slot);
                    const isDragging = dragFrom === slot;
                    const isOver = dropTarget === slot;

                    return (
                      <g
                        key={`${ri}-${ci}`}
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
                            const next = prev.map(rw => [...rw]);
                            const [fr, fc] = from.split('-').map(Number);
                            const [tr, tc] = to.split('-').map(Number);
                            const temp = next[fr][fc];
                            next[fr][fc] = next[tr][tc];
                            next[tr][tc] = temp;
                            return next;
                          });
                          setDragFrom(null);
                          setDropTarget(null);
                        }}
                        onClick={() => { if (!name) toggleSeatOpen(ri, ci); }}
                      >
                        <circle cx={sx} cy={sy} r={seatR}
                          className={
                            isClosed ? 'fill-muted stroke-destructive/60' :
                            isDragging ? 'fill-primary/20 stroke-primary' :
                            isOver ? 'fill-accent stroke-primary' :
                            'fill-card stroke-border'
                          }
                          strokeWidth={isOver ? 2.5 : 1.5}
                        />
                        {name && <title>{name}</title>}
                        {isClosed && (
                          <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-destructive text-xs">
                            关
                          </text>
                        )}
                        {name && !isDragging && (
                          <text
                            x={sx}
                            y={sy + 1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            textLength={name.length > 2 ? nameTextLength : undefined}
                            lengthAdjust={name.length > 2 ? 'spacingAndGlyphs' : undefined}
                            className="fill-foreground text-[10px]"
                          >
                            {name}
                          </text>
                        )}
                      </g>
                    );
                  });
                })}
              </svg>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">半圆形音乐厅，{rowCount} 排座位围绕舞台</p>
          </div>
        )}
      </div>

      {assignment.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          拖拽姓名可换座；点击空座位可关闭/开放使用；幕布/讲台/窗/前后门支持显隐与拖拽
        </p>
      )}
      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={assignment}
        studentNames={students.map(s => s.name)}
        sceneType="concertHall"
        sceneConfig={exportSceneConfig}
        className={exportClassName}
        onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)}
      />
    </div>
  );
}
