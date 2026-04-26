import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { usePinchZoom } from './usePinchZoom';
import { useSwipeRecommendedSeat, type SeatPoint } from './useSwipeRecommendedSeat';
import SwipeSeatHint from './SwipeSeatHint';
import ZoomIndicator from './ZoomIndicator';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
  recenterSignal?: number;
}

type SeatPosition = {
  side: 'head-left' | 'head-right' | 'top' | 'bottom' | 'companion-top' | 'companion-bottom';
  index: number;
  companionRow?: number;
  label: string;
};

type DoorSide = 'top' | 'bottom' | 'left' | 'right';
interface DoorInfo { side: DoorSide; label: string; }

/** Convert a (x,y) room-canvas coordinate to its nearest perimeter side. */
function classifyDoorSide(door: { x: number; y: number } | null, roomW: number, roomH: number): DoorSide | null {
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

export default function ConferenceCheckinView({ seatData, sceneConfig, studentName, recenterSignal = 0 }: Props) {
  const raw = seatData as Record<string, unknown>;
  const valid = raw && typeof raw === 'object'
    && ((Array.isArray(raw.top) && Array.isArray(raw.bottom))
      || (Array.isArray(raw.mainTop) && Array.isArray(raw.mainBottom)))
    && typeof raw.headLeft === 'string'
    && typeof raw.headRight === 'string';

  const data = useMemo(() => {
    if (!valid) return null;
    return {
      headLeft: raw.headLeft as string,
      headRight: raw.headRight as string,
      top: (raw.top || raw.mainTop) as string[],
      bottom: (raw.bottom || raw.mainBottom) as string[],
      companionTop: (raw.companionTop as string[][] | undefined) || [],
      companionBottom: (raw.companionBottom as string[][] | undefined) || [],
    };
  }, [raw, valid]);

  const seatsPerSide = (sceneConfig.seatsPerSide as number) || data?.top.length || 10;
  const companionRows = (sceneConfig.companionRows as number) || 0;
  const roomW = (sceneConfig.roomWidth as number) || 920;
  const roomH = (sceneConfig.roomHeight as number) || 640;
  const frontDoorRaw = sceneConfig.frontDoor as { x: number; y: number } | null | undefined;
  const backDoorRaw = sceneConfig.backDoor as { x: number; y: number } | null | undefined;

  const doors: DoorInfo[] = useMemo(() => {
    const list: DoorInfo[] = [];
    const fs = classifyDoorSide(frontDoorRaw ?? null, roomW, roomH);
    if (fs) list.push({ side: fs, label: '前门' });
    const bs = classifyDoorSide(backDoorRaw ?? null, roomW, roomH);
    if (bs) list.push({ side: bs, label: '后门' });
    if (list.length === 0) list.push({ side: 'right', label: '入口' });
    return list;
  }, [frontDoorRaw, backDoorRaw, roomW, roomH]);

  const myPos = useMemo((): SeatPosition | null => {
    if (!data) return null;
    if (data.headLeft === studentName) return { side: 'head-left', index: 0, label: '左侧主位' };
    if (data.headRight === studentName) return { side: 'head-right', index: 0, label: '右侧主位' };
    const topIdx = data.top.indexOf(studentName);
    if (topIdx >= 0) return { side: 'top', index: topIdx, label: `上方第${topIdx + 1}位` };
    const bottomIdx = data.bottom.indexOf(studentName);
    if (bottomIdx >= 0) return { side: 'bottom', index: bottomIdx, label: `下方第${bottomIdx + 1}位` };
    for (let cr = 0; cr < data.companionTop.length; cr++) {
      const ci = data.companionTop[cr].indexOf(studentName);
      if (ci >= 0) return { side: 'companion-top', index: ci, companionRow: cr, label: `上方随员第${cr + 1}排第${ci + 1}位` };
    }
    for (let cr = 0; cr < data.companionBottom.length; cr++) {
      const ci = data.companionBottom[cr].indexOf(studentName);
      if (ci >= 0) return { side: 'companion-bottom', index: ci, companionRow: cr, label: `下方随员第${cr + 1}排第${ci + 1}位` };
    }
    return null;
  }, [data, studentName]);

  const seatContainerRef = useAutoCenterMySeat([studentName, myPos?.side, myPos?.index, recenterSignal]);
  const { containerRef: pinchRef, transformStyle, scale, resetZoom } = usePinchZoom(0.5, 4, [recenterSignal]);

  // ---- Layout constants (declared before any early return so hooks below can use them) ----
  const seatW = 38, seatH = 26, gap = 3;
  const tableW = seatsPerSide * (seatW + gap) + 20;
  const tableH = 16;
  const sideGap = 6;
  const companionGap = 4;

  const topCompanionH = companionRows * (seatH + companionGap);
  const bottomCompanionH = companionRows * (seatH + companionGap);
  const totalH = topCompanionH + seatH + sideGap + tableH + sideGap + seatH + bottomCompanionH;

  const outsideMargin = 50;
  const svgW = tableW + 100 + outsideMargin * 2;
  const svgH = totalH + 80 + outsideMargin * 2;

  const tableX = (svgW - tableW) / 2;
  const tableY = outsideMargin + 40 + topCompanionH + seatH + sideGap;
  const headSeatW = 32, headSeatH = tableH;

  // Inner content bounding box (where seats are)
  const innerLeft = tableX - headSeatW - 4;
  const innerRight = tableX + tableW + headSeatW + 4;
  const innerTop = outsideMargin + 40;
  const innerBottom = innerTop + totalH;

  // Aisles around the seat block
  const aisleLeftX = innerLeft - 18;
  const aisleRightX = innerRight + 18;
  const aisleTopY = innerTop - 18;
  const aisleBottomY = innerBottom + 18;

  const seatStartX = tableX + 10;

  const getSeatCenter = (pos: SeatPosition): { x: number; y: number } => {
    switch (pos.side) {
      case 'head-left':
        return { x: tableX - headSeatW / 2 - 4, y: tableY + tableH / 2 };
      case 'head-right':
        return { x: tableX + tableW + headSeatW / 2 + 4, y: tableY + tableH / 2 };
      case 'top':
        return { x: seatStartX + pos.index * (seatW + gap) + seatW / 2, y: tableY - sideGap - seatH / 2 };
      case 'bottom':
        return { x: seatStartX + pos.index * (seatW + gap) + seatW / 2, y: tableY + tableH + sideGap + seatH / 2 };
      case 'companion-top': {
        const cr = pos.companionRow || 0;
        return { x: seatStartX + pos.index * (seatW + gap) + seatW / 2, y: tableY - sideGap - seatH - (cr + 1) * (seatH + companionGap) + seatH / 2 };
      }
      case 'companion-bottom': {
        const cr = pos.companionRow || 0;
        return { x: seatStartX + pos.index * (seatW + gap) + seatW / 2, y: tableY + tableH + sideGap + seatH + (cr + 1) * companionGap + cr * seatH + seatH / 2 };
      }
    }
  };

  // ---- Empty-seat swipe recommendation (visual-only) ----
  const emptySeatPoints: SeatPoint[] = useMemo(() => {
    if (!data) return [];
    const points: SeatPoint[] = [];
    const add = (pos: SeatPosition, name: string) => {
      if (name) return;
      if (myPos && myPos.side === pos.side && myPos.index === pos.index && myPos.companionRow === pos.companionRow) return;
      const c = getSeatCenter(pos);
      const key =
        pos.side === 'head-left' ? 'head-left'
        : pos.side === 'head-right' ? 'head-right'
        : pos.side === 'top' ? `top-${pos.index}`
        : pos.side === 'bottom' ? `bottom-${pos.index}`
        : pos.side === 'companion-top' ? `ct-${pos.companionRow}-${pos.index}`
        : `cb-${pos.companionRow}-${pos.index}`;
      points.push({ key, x: c.x, y: c.y, label: pos.label });
    };
    add({ side: 'head-left', index: 0, label: '左侧主位' }, data.headLeft);
    add({ side: 'head-right', index: 0, label: '右侧主位' }, data.headRight);
    data.top.forEach((n, i) => add({ side: 'top', index: i, label: `上方第${i + 1}位` }, n));
    data.bottom.forEach((n, i) => add({ side: 'bottom', index: i, label: `下方第${i + 1}位` }, n));
    data.companionTop.forEach((row, cr) => row.forEach((n, i) =>
      add({ side: 'companion-top', index: i, companionRow: cr, label: `上方随员第${cr + 1}排第${i + 1}位` }, n)));
    data.companionBottom.forEach((row, cr) => row.forEach((n, i) =>
      add({ side: 'companion-bottom', index: i, companionRow: cr, label: `下方随员第${cr + 1}排第${i + 1}位` }, n)));
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, myPos, seatsPerSide, companionRows]);

  const mySeatPoint: SeatPoint | null = useMemo(() => {
    if (!myPos) return null;
    const c = getSeatCenter(myPos);
    const key =
      myPos.side === 'head-left' ? 'head-left'
      : myPos.side === 'head-right' ? 'head-right'
      : myPos.side === 'top' ? `top-${myPos.index}`
      : myPos.side === 'bottom' ? `bottom-${myPos.index}`
      : myPos.side === 'companion-top' ? `ct-${myPos.companionRow}-${myPos.index}`
      : `cb-${myPos.companionRow}-${myPos.index}`;
    return { key, x: c.x, y: c.y, label: myPos.label };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPos, seatsPerSide, companionRows]);

  const swipe = useSwipeRecommendedSeat(mySeatPoint, emptySeatPoints);

  if (!valid || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-3xl mb-4 text-destructive">⚠️</div>
        <div className="text-xl font-bold text-destructive mb-2">座位数据异常</div>
        <div className="text-sm text-muted-foreground">请联系管理员或刷新页面重试</div>
      </div>
    );
  }

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  const mySeatCenter = getSeatCenter(myPos);

  // Door anchor on the wall (outside seat block) for a side
  const doorAnchor = (side: DoorSide) => {
    switch (side) {
      case 'top':    return { x: mySeatCenter.x, y: aisleTopY - 14 };
      case 'bottom': return { x: mySeatCenter.x, y: aisleBottomY + 14 };
      case 'left':   return { x: aisleLeftX - 14, y: mySeatCenter.y };
      case 'right':  return { x: aisleRightX + 14, y: mySeatCenter.y };
    }
  };

  // Pick the closest door (Manhattan distance)
  let activeDoor: DoorInfo | null = null;
  {
    let min = Infinity;
    for (const d of doors) {
      const a = doorAnchor(d.side);
      const dist = Math.abs(a.x - mySeatCenter.x) + Math.abs(a.y - mySeatCenter.y);
      if (dist < min) { min = dist; activeDoor = d; }
    }
  }

  // Build L-shaped path: door → aisle along wall → into row/col → seat
  const buildPath = (side: DoorSide) => {
    const anchor = doorAnchor(side);
    const points: { x: number; y: number }[] = [anchor];
    if (side === 'top' || side === 'bottom') {
      const aisleY = side === 'top' ? aisleTopY : aisleBottomY;
      points.push({ x: anchor.x, y: aisleY });
      points.push({ x: mySeatCenter.x, y: aisleY });
    } else {
      const aisleX = side === 'left' ? aisleLeftX : aisleRightX;
      points.push({ x: aisleX, y: anchor.y });
      points.push({ x: aisleX, y: mySeatCenter.y });
    }
    points.push(mySeatCenter);
    return points;
  };

  const navPath = activeDoor ? buildPath(activeDoor.side) : [];
  const pathD = navPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const renderSeat = (x: number, y: number, w: number, h: number, name: string, isMine: boolean, key: string) => (
    <g key={key} data-my-seat={isMine ? 'true' : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={4}
        className={isMine ? 'fill-primary stroke-primary' : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
        strokeWidth={isMine ? 2.5 : 1}
      />
      {isMine && (
        <circle cx={x + w / 2} cy={y - 6} r={4} className="fill-primary">
          <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}
      {name && (
        <text x={x + w / 2} y={y + h / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          className={`${name.length >= 4 ? 'text-[6px]' : 'text-[8px]'} ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
          {name}
        </text>
      )}
    </g>
  );

  const dirHint = activeDoor
    ? `从 ${activeDoor.label}（${{ top: '上', bottom: '下', left: '左', right: '右' }[activeDoor.side]}侧）进入，沿走廊到达 ${myPos.label}`
    : '';

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的座位在 <strong>{myPos.label}</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary/50 inline-block" style={{ borderTop: '2px dashed' }} /> 导航路径</span>
        <span className="flex items-center gap-1"><span className="text-base leading-none">🚪</span> 入口</span>
      </div>
      <p className="text-[11px] text-muted-foreground/70 text-center sm:hidden">双指缩放查看细节，双击恢复</p>
      <ZoomIndicator scale={scale} onReset={resetZoom} />

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-hidden pb-4">
        <div ref={pinchRef} style={transformStyle} className="touch-none">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans w-full max-w-[600px]" style={{ minWidth: Math.min(svgW, 320) }}>
            {/* Room outline */}
            <rect x={innerLeft - 24} y={innerTop - 24} width={innerRight - innerLeft + 48} height={innerBottom - innerTop + 48}
              rx={10} className="fill-muted/20 stroke-border" strokeWidth={1.5} />

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

            {/* Conference table */}
            <rect x={tableX} y={tableY} width={tableW} height={tableH} rx={6}
              className="fill-primary/10 stroke-primary/30" strokeWidth={2} />
            <text x={tableX + tableW / 2} y={tableY + tableH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
              className="fill-primary text-[9px] font-medium">会议桌</text>

            {/* Head seats */}
            {renderSeat(tableX - headSeatW - 4, tableY + (tableH - headSeatH) / 2, headSeatW, headSeatH,
              data.headLeft, myPos.side === 'head-left', 'head-left')}
            {renderSeat(tableX + tableW + 4, tableY + (tableH - headSeatH) / 2, headSeatW, headSeatH,
              data.headRight, myPos.side === 'head-right', 'head-right')}

            {/* Main top seats */}
            {data.top.map((name, i) => {
              const x = seatStartX + i * (seatW + gap);
              const y = tableY - sideGap - seatH;
              const isMine = myPos.side === 'top' && myPos.index === i;
              return renderSeat(x, y, seatW, seatH, name, isMine, `top-${i}`);
            })}

            {/* Main bottom seats */}
            {data.bottom.map((name, i) => {
              const x = seatStartX + i * (seatW + gap);
              const y = tableY + tableH + sideGap;
              const isMine = myPos.side === 'bottom' && myPos.index === i;
              return renderSeat(x, y, seatW, seatH, name, isMine, `bottom-${i}`);
            })}

            {/* Companion top rows */}
            {data.companionTop.map((row, cr) => row.map((name, i) => {
              const x = seatStartX + i * (seatW + gap);
              const y = tableY - sideGap - seatH - (cr + 1) * (seatH + companionGap);
              const isMine = myPos.side === 'companion-top' && myPos.companionRow === cr && myPos.index === i;
              return renderSeat(x, y, seatW, seatH, name, isMine, `ct-${cr}-${i}`);
            }))}

            {/* Companion bottom rows */}
            {data.companionBottom.map((row, cr) => row.map((name, i) => {
              const x = seatStartX + i * (seatW + gap);
              const y = tableY + tableH + sideGap + seatH + (cr + 1) * companionGap + cr * seatH;
              const isMine = myPos.side === 'companion-bottom' && myPos.companionRow === cr && myPos.index === i;
              return renderSeat(x, y, seatW, seatH, name, isMine, `cb-${cr}-${i}`);
            }))}
          </svg>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Navigation className="w-3 h-3 text-primary" />
          {dirHint || `从入口进入，到达 ${myPos.label}`}
        </p>
      </div>
    </>
  );
}
