import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePinchZoom } from './usePinchZoom';
import { useSwipeRecommendedSeat, type SeatPoint } from './useSwipeRecommendedSeat';
import SwipeSeatHint from './SwipeSeatHint';
import ZoomIndicator from './ZoomIndicator';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
  sceneType: string;
  recenterSignal?: number;
}

type DoorSide = 'top' | 'bottom' | 'left' | 'right';
interface DoorInfo { side: DoorSide; label: string; }

/** Convert a (x,y) room-canvas coordinate to its nearest perimeter side. */
function classifyDoorSide(door: { x: number; y: number } | null | undefined, roomW: number, roomH: number): DoorSide | null {
  if (!door) return null;
  const dLeft = door.x;
  const dRight = roomW - door.x;
  const dTop = door.y;
  const dBottom = roomH - door.y;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return 'left';
  if (min === dRight) return 'right';
  if (min === dTop) return 'top';
  return 'bottom';
}

export default function RoundTableCheckinView({ seatData, sceneConfig, studentName, sceneType, recenterSignal = 0 }: Props) {
  const tables = seatData as string[][];
  const seatsPerTable = (sceneConfig.seatsPerTable as number) || tables[0]?.length || 6;
  const tableCols = (sceneConfig.tableCols as number) || Math.ceil(Math.sqrt(tables.length));
  const tableRows = Math.ceil(tables.length / tableCols);
  const isMobile = useIsMobile();

  const myPos = useMemo(() => {
    for (let t = 0; t < tables.length; t++) {
      for (let s = 0; s < tables[t].length; s++) {
        if (tables[t][s] === studentName) return { table: t, seat: s };
      }
    }
    return null;
  }, [tables, studentName]);

  // Resolve doors: prefer pixel coords (frontDoor/backDoor with roomWidth/roomHeight),
  // fall back to legacy entryDoorPosition / entryDoors.
  const roomW = sceneConfig.roomWidth as number | undefined;
  const roomH = sceneConfig.roomHeight as number | undefined;
  const frontDoorRaw = sceneConfig.frontDoor as { x: number; y: number } | null | undefined;
  const backDoorRaw = sceneConfig.backDoor as { x: number; y: number } | null | undefined;

  const doors: DoorInfo[] = useMemo(() => {
    const list: DoorInfo[] = [];
    if (roomW && roomH) {
      const fs = classifyDoorSide(frontDoorRaw, roomW, roomH);
      if (fs) list.push({ side: fs, label: '前门' });
      const bs = classifyDoorSide(backDoorRaw, roomW, roomH);
      if (bs) list.push({ side: bs, label: '后门' });
    }
    if (list.length === 0) {
      // legacy
      const pos = (sceneConfig.entryDoorPosition as DoorSide) || 'top';
      const labelMap: Record<DoorSide, string> = { top: '前门', bottom: '后门', left: '左门', right: '右门' };
      list.push({ side: pos, label: labelMap[pos] });
    }
    return list;
  }, [roomW, roomH, frontDoorRaw, backDoorRaw, sceneConfig.entryDoorPosition]);

  const { containerRef: pinchRef, transformStyle, scale, resetZoom } = usePinchZoom(0.5, 4, [recenterSignal]);

  // SVG layout for tables in a grid
  const tableSvgSize = isMobile ? 110 : 150;
  const aisleGap = isMobile ? 26 : 36;
  const tableRadius = isMobile ? 22 : 32;
  const seatOrbitRadius = isMobile ? 36 : 48;
  const seatRadius = isMobile ? 10 : 14;

  const cellW = tableSvgSize + aisleGap;
  const cellH = tableSvgSize + aisleGap;
  const innerLeft = aisleGap;
  const innerTop = aisleGap;
  const innerRight = innerLeft + tableCols * cellW;
  const innerBottom = innerTop + tableRows * cellH;

  const outsideMargin = 40;
  const svgW = innerRight + aisleGap + outsideMargin * 2;
  const svgH = innerBottom + aisleGap + outsideMargin * 2;

  const tableCenter = (tIdx: number) => {
    const r = Math.floor(tIdx / tableCols);
    const c = tIdx % tableCols;
    return {
      x: outsideMargin + innerLeft + c * cellW + tableSvgSize / 2,
      y: outsideMargin + innerTop + r * cellH + tableSvgSize / 2,
    };
  };

  const seatContainerRef = useAutoCenterMySeat([studentName, myPos?.table, myPos?.seat, recenterSignal]);

  // ---- Empty-seat swipe recommendation (visual-only) ----
  const emptySeatPoints: SeatPoint[] = useMemo(() => {
    const points: SeatPoint[] = [];
    for (let ti = 0; ti < tables.length; ti++) {
      const center = tableCenter(ti);
      for (let si = 0; si < seatsPerTable; si++) {
        if (tables[ti][si]) continue;
        if (myPos && ti === myPos.table && si === myPos.seat) continue;
        const angle = (2 * Math.PI * si) / seatsPerTable - Math.PI / 2;
        points.push({
          key: `${ti}-${si}`,
          x: center.x + seatOrbitRadius * Math.cos(angle),
          y: center.y + seatOrbitRadius * Math.sin(angle),
          label: `第 ${ti + 1} 桌第 ${si + 1} 号座`,
        });
      }
    }
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, seatsPerTable, myPos, tableCols, tableSvgSize, aisleGap]);

  const mySeatPoint: SeatPoint | null = useMemo(() => {
    if (!myPos) return null;
    const center = tableCenter(myPos.table);
    const angle = (2 * Math.PI * myPos.seat) / seatsPerTable - Math.PI / 2;
    return {
      key: `${myPos.table}-${myPos.seat}`,
      x: center.x + seatOrbitRadius * Math.cos(angle),
      y: center.y + seatOrbitRadius * Math.sin(angle),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPos, seatsPerTable, tableCols, tableSvgSize, aisleGap]);

  const swipe = useSwipeRecommendedSeat(mySeatPoint, emptySeatPoints);

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  const myCenter = tableCenter(myPos.table);
  const myRow = Math.floor(myPos.table / tableCols);
  const myCol = myPos.table % tableCols;

  // Door anchor on the wall
  const doorAnchor = (side: DoorSide) => {
    switch (side) {
      case 'top':    return { x: myCenter.x, y: outsideMargin - 4 };
      case 'bottom': return { x: myCenter.x, y: outsideMargin + innerBottom + aisleGap + 4 };
      case 'left':   return { x: outsideMargin - 4, y: myCenter.y };
      case 'right':  return { x: outsideMargin + innerRight + aisleGap + 4, y: myCenter.y };
    }
  };

  // Pick closest door
  let activeDoor: DoorInfo | null = null;
  {
    let min = Infinity;
    for (const d of doors) {
      const a = doorAnchor(d.side);
      const dist = Math.abs(a.x - myCenter.x) + Math.abs(a.y - myCenter.y);
      if (dist < min) { min = dist; activeDoor = d; }
    }
  }

  // L-shaped path through aisles between tables
  const buildPath = (side: DoorSide) => {
    const anchor = doorAnchor(side);
    const points: { x: number; y: number }[] = [anchor];

    // Aisle X coordinate just left of my column (between my column and the previous one)
    const aisleColX = outsideMargin + innerLeft + myCol * cellW - aisleGap / 2;
    // Aisle Y just above my row
    const aisleRowY = outsideMargin + innerTop + myRow * cellH - aisleGap / 2;

    if (side === 'top' || side === 'bottom') {
      const aisleY = side === 'top'
        ? outsideMargin + innerTop - aisleGap / 2
        : outsideMargin + innerBottom + aisleGap / 2;
      points.push({ x: anchor.x, y: aisleY });
      // walk along outer aisle to my column-aisle
      points.push({ x: aisleColX, y: aisleY });
      // walk down/up along column-aisle to my row level
      points.push({ x: aisleColX, y: myCenter.y });
    } else {
      const aisleX = side === 'left'
        ? outsideMargin + innerLeft - aisleGap / 2
        : outsideMargin + innerRight + aisleGap / 2;
      points.push({ x: aisleX, y: anchor.y });
      points.push({ x: aisleX, y: aisleRowY });
      points.push({ x: myCenter.x, y: aisleRowY });
    }
    points.push(myCenter);
    return points;
  };

  const navPath = activeDoor ? buildPath(activeDoor.side) : [];
  const pathD = navPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const label = sceneType === 'banquet' ? '宴会厅' : '智能教室';
  const sideText: Record<DoorSide, string> = { top: '上', bottom: '下', left: '左', right: '右' };
  const dirHint = activeDoor
    ? `从 ${activeDoor.label}（${sideText[activeDoor.side]}侧）进入，沿走廊抵达 第 ${myPos.table + 1} 桌`
    : '';

  return (
    <>
      <p className="text-sm text-muted-foreground text-center leading-relaxed px-2">
        {studentName}，你的位置在 <strong>第{myPos.table + 1}桌 · 第{myPos.seat + 1}号座</strong>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary/20 border border-primary/40 inline-block" /> 你的桌子</span>
        <span className="flex items-center gap-1"><span className="text-base leading-none">🚪</span> 入口</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary/50 inline-block" style={{ borderTop: '2px dashed' }} /> 导航路径</span>
      </div>

      <div className="text-center text-xs text-muted-foreground mb-2">
        <div className="inline-block bg-primary/10 text-primary px-4 py-1 rounded-lg text-xs font-medium border border-primary/20 mb-2">
          {label}
        </div>
        {isMobile && (
          <p className="text-[11px] text-muted-foreground/90">双指缩放查看细节，双击恢复原位</p>
        )}
        <ZoomIndicator scale={scale} onReset={resetZoom} />
      </div>

      <div className="text-center text-xs text-primary font-medium mb-2 flex items-center justify-center gap-1">
        <Navigation className="w-3 h-3" />
        <span>{dirHint}</span>
      </div>

      <SwipeSeatHint
        total={swipe.total}
        index={swipe.index}
        label={swipe.recommended?.label}
        onPrev={swipe.prev}
        onNext={swipe.next}
      />

      <div
        ref={seatContainerRef}
        className="seat-checkin-surface flex justify-center overflow-hidden pb-4"
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
      >
        <div ref={pinchRef} style={transformStyle} className="touch-none">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans w-full max-w-[640px]" style={{ minWidth: Math.min(svgW, 320) }}>
            {/* Room outline */}
            <rect x={outsideMargin / 2} y={outsideMargin / 2}
              width={svgW - outsideMargin} height={svgH - outsideMargin}
              rx={12} className="fill-muted/15 stroke-border" strokeWidth={1.5} />

            {/* Navigation path */}
            {navPath.length > 1 && (
              <path d={pathD} fill="none" className="stroke-primary/60" strokeWidth={2.5}
                strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round">
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" repeatCount="indefinite" />
              </path>
            )}

            {/* Doors */}
            {doors.map((d, i) => {
              const a = doorAnchor(d.side);
              const isActive = activeDoor?.side === d.side && activeDoor?.label === d.label;
              return (
                <g key={`door-${i}`}>
                  <circle cx={a.x} cy={a.y} r={11}
                    className={isActive ? 'fill-accent stroke-primary' : 'fill-card stroke-border'}
                    strokeWidth={1.5} />
                  <text x={a.x} y={a.y + 1} textAnchor="middle" dominantBaseline="middle" className="text-[10px]">🚪</text>
                  <text x={a.x} y={a.y + 22} textAnchor="middle" dominantBaseline="middle"
                    className={`text-[8px] ${isActive ? 'fill-primary font-bold' : 'fill-muted-foreground'}`}>
                    {d.label}
                  </text>
                </g>
              );
            })}

            {/* Turning points */}
            {navPath.slice(1, -1).map((p, i) => (
              <circle key={`tp-${i}`} cx={p.x} cy={p.y} r={2.5} className="fill-primary/40 stroke-primary/60" strokeWidth={1} />
            ))}

            {/* Tables */}
            {tables.map((people, ti) => {
              const center = tableCenter(ti);
              const isMyTable = ti === myPos.table;
              return (
                <g key={`tbl-${ti}`} data-my-seat={isMyTable ? 'true' : undefined}>
                  <circle cx={center.x} cy={center.y} r={tableRadius}
                    className={isMyTable ? 'fill-primary/15 stroke-primary/60' : 'fill-primary/5 stroke-primary/25'}
                    strokeWidth={isMyTable ? 2.5 : 1.5} />
                  <text x={center.x} y={center.y + 1} textAnchor="middle" dominantBaseline="middle"
                    className={`text-[10px] font-medium ${isMyTable ? 'fill-primary' : 'fill-muted-foreground'}`}>
                    {ti + 1}桌
                  </text>
                  {Array.from({ length: seatsPerTable }).map((_, si) => {
                    const angle = (2 * Math.PI * si) / seatsPerTable - Math.PI / 2;
                    const sx = center.x + seatOrbitRadius * Math.cos(angle);
                    const sy = center.y + seatOrbitRadius * Math.sin(angle);
                    const seatName = people[si] || '';
                    const isMine = ti === myPos.table && si === myPos.seat;
                    const isRecommended = swipe.recommended?.key === `${ti}-${si}` && !isMine && !seatName;
                    return (
                      <g key={si}>
                        {isRecommended && (
                          <circle cx={sx} cy={sy} r={seatRadius + 4}
                            className="fill-none stroke-accent-foreground" strokeWidth={1.5} strokeDasharray="3 2">
                            <animate attributeName="stroke-dashoffset" from="0" to="10" dur="1s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <circle cx={sx} cy={sy} r={seatRadius}
                          className={isMine
                            ? 'fill-primary stroke-primary'
                            : isRecommended ? 'fill-accent/60 stroke-accent-foreground'
                            : isMyTable && seatName ? 'fill-card stroke-primary/40'
                            : seatName ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                          strokeWidth={isMine || isRecommended ? 2.5 : 1.2} />
                        {isMine && (
                          <circle cx={sx} cy={sy - seatRadius - 4} r={3} className="fill-primary">
                            <animate attributeName="r" values="2;4;2" dur="1.2s" repeatCount="indefinite" />
                          </circle>
                        )}
                        {isRecommended && (
                          <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle"
                            className="fill-accent-foreground text-[7px] font-bold pointer-events-none">推荐</text>
                        )}
                        {seatName && (
                          <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle"
                            textLength={seatName.length >= 5 ? 20 : undefined}
                            lengthAdjust={seatName.length >= 5 ? 'spacingAndGlyphs' : undefined}
                            className={`${seatName.length >= 5 ? 'text-[6px]' : seatName.length >= 4 ? 'text-[7px]' : 'text-[8.5px]'} pointer-events-none ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
                            {seatName}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>📍 找到第 <strong>{myPos.table + 1}</strong> 桌（第{myRow + 1}行第{myCol + 1}列位置）</p>
        <p>🪑 坐在第 <strong>{myPos.seat + 1}</strong> 号座位（从顶部12点钟方向顺时针数）</p>
      </div>
    </>
  );
}
