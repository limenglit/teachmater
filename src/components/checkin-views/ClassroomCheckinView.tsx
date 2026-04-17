import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { usePinchZoom } from './usePinchZoom';
import ZoomIndicator from './ZoomIndicator';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
}

type DoorSide = 'top' | 'bottom' | 'left' | 'right';

interface Door {
  side: DoorSide;
  label: string;
  // grid coord at the perimeter where the door touches the room
  row: number;
  col: number;
}

export default function ClassroomCheckinView({ seatData, sceneConfig, studentName }: Props) {
  const seats = seatData as (string | null)[][];
  const config = sceneConfig as {
    rows: number; cols: number; windowOnLeft: boolean;
    colAisles?: number[]; rowAisles?: number[];
    entryDoorMode?: 'front' | 'back' | 'both';
    frontDoorPosition?: DoorSide;
    backDoorPosition?: DoorSide;
    disabledSeats?: string[];
  };
  const disabledSeatSet = useMemo(
    () => new Set(Array.isArray(config.disabledSeats) ? config.disabledSeats : []),
    [config.disabledSeats]
  );

  const myPosition = useMemo(() => {
    for (let r = 0; r < seats.length; r++) {
      for (let c = 0; c < seats[r].length; c++) {
        if (seats[r][c] === studentName) return { r, c };
      }
    }
    return null;
  }, [seats, studentName]);

  const rows = config.rows || seats.length;
  const cols = config.cols || (seats[0]?.length ?? 8);
  const entryDoorMode = config.entryDoorMode || 'front';
  const frontDoorPos: DoorSide = config.frontDoorPosition || 'top';
  const backDoorPos: DoorSide = config.backDoorPosition || 'bottom';

  // Map a door side to a perimeter cell coordinate (row, col on grid).
  // The door is *outside* the grid; pick an entry cell at the appropriate perimeter.
  const doorEntryCell = (side: DoorSide): { row: number; col: number } => {
    switch (side) {
      case 'top':    return { row: 0,        col: 0 };
      case 'bottom': return { row: rows - 1, col: 0 };
      case 'left':   return { row: 0,        col: 0 };
      case 'right':  return { row: 0,        col: cols - 1 };
    }
  };

  const doors: Door[] = useMemo(() => {
    const list: Door[] = [];
    if (entryDoorMode === 'front' || entryDoorMode === 'both') {
      const e = doorEntryCell(frontDoorPos);
      list.push({ side: frontDoorPos, label: '前门', row: e.row, col: e.col });
    }
    if (entryDoorMode === 'back' || entryDoorMode === 'both') {
      const e = doorEntryCell(backDoorPos);
      list.push({ side: backDoorPos, label: '后门', row: e.row, col: e.col });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDoorMode, frontDoorPos, backDoorPos, rows, cols]);

  // Pick the closest door (Manhattan distance from entry cell to my seat)
  const activeDoor: Door | null = useMemo(() => {
    if (!myPosition || doors.length === 0) return null;
    let best: Door | null = null;
    let min = Infinity;
    for (const d of doors) {
      const dist = Math.abs(d.row - myPosition.r) + Math.abs(d.col - myPosition.c);
      if (dist < min) { min = dist; best = d; }
    }
    return best;
  }, [doors, myPosition]);

  const seatContainerRef = useAutoCenterMySeat([studentName, myPosition?.r, myPosition?.c]);
  const { containerRef: pinchRef, transformStyle, scale, resetZoom } = usePinchZoom();

  if (!myPosition) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  // ---- SVG layout (inspired by ComputerLab style) ----
  const seatW = 36;
  const seatH = 26;
  const gapX = 6;
  const gapY = 8;
  const padX = 40; // room interior horizontal padding
  const padY = 36; // room interior vertical padding
  const innerW = cols * seatW + (cols - 1) * gapX;
  const innerH = rows * seatH + (rows - 1) * gapY;
  const roomW = innerW + padX * 2;
  const roomH = innerH + padY * 2;

  const seatX = (c: number) => padX + c * (seatW + gapX);
  const seatY = (r: number) => padY + r * (seatH + gapY);
  const seatCx = (c: number) => seatX(c) + seatW / 2;
  const seatCy = (r: number) => seatY(r) + seatH / 2;

  // Aisle lines used for the navigation route (just outside the seats)
  const aisleLeftX = padX - 12;
  const aisleRightX = padX + innerW + 12;
  const aisleTopY = padY - 12;
  const aisleBottomY = padY + innerH + 12;

  // SVG canvas size (room + outside margin for doors and podium)
  const podiumH = 26;
  const outsideMargin = 28;
  const svgW = roomW + outsideMargin * 2;
  const svgH = roomH + outsideMargin * 2 + podiumH + 8;
  const roomOx = outsideMargin;
  const roomOy = outsideMargin + podiumH + 8;

  const toSvg = (x: number, y: number) => ({ x: x + roomOx, y: y + roomOy });

  // Door anchor (on the room wall, outside) for a given side
  const doorAnchor = (side: DoorSide, mySeat: { r: number; c: number }) => {
    // anchor near my seat to keep the route short and tidy
    switch (side) {
      case 'top':    return toSvg(seatCx(mySeat.c), -8);
      case 'bottom': return toSvg(seatCx(mySeat.c), roomH + 8);
      case 'left':   return toSvg(-8, seatCy(mySeat.r));
      case 'right':  return toSvg(roomW + 8, seatCy(mySeat.r));
    }
  };

  // Build a tidy L-shaped route: door → aisle along the wall → into row → seat
  const buildPath = (door: Door, mySeat: { r: number; c: number }) => {
    const seat = toSvg(seatCx(mySeat.c), seatCy(mySeat.r));
    const anchor = doorAnchor(door.side, mySeat);
    const points: { x: number; y: number }[] = [anchor];

    if (door.side === 'top' || door.side === 'bottom') {
      // walk along top/bottom aisle (outside seat block) to my column, then into row
      const aisleY = door.side === 'top'
        ? toSvg(0, aisleTopY).y
        : toSvg(0, aisleBottomY).y;
      const colX = toSvg(seatCx(mySeat.c), 0).x;
      points.push({ x: anchor.x, y: aisleY });
      points.push({ x: colX, y: aisleY });
      points.push({ x: colX, y: seat.y });
    } else {
      // left / right: walk along side aisle to my row, then into column
      const aisleX = door.side === 'left'
        ? toSvg(aisleLeftX, 0).x
        : toSvg(aisleRightX, 0).x;
      const rowY = toSvg(0, seatCy(mySeat.r)).y;
      points.push({ x: aisleX, y: anchor.y });
      points.push({ x: aisleX, y: rowY });
      points.push({ x: seat.x, y: rowY });
    }
    points.push(seat);
    return points;
  };

  const navPath = activeDoor ? buildPath(activeDoor, myPosition) : [];
  const pathD = navPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Window side (opposite to a left/right door if needed; default keeps config)
  const windowOnLeft = config.windowOnLeft;
  const podiumX = roomOx + roomW / 2;
  const podiumY = roomOy - podiumH / 2 - 4;

  // Direction hint text
  const dirHint = (() => {
    if (!activeDoor) return '';
    const s = activeDoor.side;
    const r = myPosition.r + 1;
    const c = myPosition.c + 1;
    if (s === 'top') return `沿走廊向后走到第 ${r} 排，再向${windowOnLeft ? '左' : '右'}走到第 ${c} 列`;
    if (s === 'bottom') return `沿走廊向前走到第 ${r} 排，再向${windowOnLeft ? '左' : '右'}走到第 ${c} 列`;
    if (s === 'left') return `沿左侧走廊走到第 ${r} 排，再向右走到第 ${c} 列`;
    return `沿右侧走廊走到第 ${r} 排，再向左走到第 ${c} 列`;
  })();

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的座位在 <strong>第{myPosition.r + 1}排 第{myPosition.c + 1}列</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
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
            <rect x={roomOx} y={roomOy} width={roomW} height={roomH} rx={10}
              className="fill-muted/20 stroke-border" strokeWidth={1.5} />

            {/* Podium */}
            <g>
              <rect x={podiumX - 50} y={podiumY} width={100} height={podiumH} rx={6}
                className="fill-primary/10 stroke-primary/30" strokeWidth={1} />
              <text x={podiumX} y={podiumY + podiumH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                className="fill-primary text-[10px] font-medium">🏫 讲 台</text>
            </g>

            {/* Window indicator on the side opposite to the side door (or per config) */}
            <text x={windowOnLeft ? roomOx + 6 : roomOx + roomW - 6}
                  y={roomOy + roomH / 2}
                  textAnchor={windowOnLeft ? 'start' : 'end'} dominantBaseline="middle"
                  className="fill-muted-foreground text-[8px]">窗</text>

            {/* Navigation path */}
            {navPath.length > 1 && (
              <path d={pathD} fill="none" className="stroke-primary/60" strokeWidth={2.5}
                strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round">
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" repeatCount="indefinite" />
              </path>
            )}

            {/* Turning points */}
            {navPath.slice(1, -1).map((p, i) => (
              <circle key={`tp-${i}`} cx={p.x} cy={p.y} r={2.5} className="fill-primary/40 stroke-primary/60" strokeWidth={1} />
            ))}

            {/* Doors (rendered as door icons on the wall) */}
            {doors.map((d, i) => {
              const a = doorAnchor(d.side, myPosition);
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

            {/* Seats */}
            {Array.from({ length: rows }).flatMap((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const x = roomOx + seatX(c);
                const y = roomOy + seatY(r);
                const name = seats[r]?.[c] ?? null;
                const isMine = myPosition.r === r && myPosition.c === c;
                return (
                  <g key={`s-${r}-${c}`} data-my-seat={isMine ? 'true' : undefined}>
                    <rect x={x} y={y} width={seatW} height={seatH} rx={4}
                      className={isMine ? 'fill-primary stroke-primary'
                        : name ? 'fill-card stroke-border'
                        : 'fill-muted/30 stroke-border/30'}
                      strokeWidth={isMine ? 2.5 : 1} />
                    {isMine && (
                      <circle cx={x + seatW / 2} cy={y - 6} r={4} className="fill-primary">
                        <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {isMine && (
                      <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                        className="fill-primary-foreground text-[8px] font-bold">
                        {name || '我'}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            {/* Row/Col axis labels (lightweight) */}
            {Array.from({ length: rows }).map((_, r) => (
              <text key={`rl-${r}`} x={roomOx + 6} y={roomOy + seatY(r) + seatH / 2 + 1}
                textAnchor="start" dominantBaseline="middle"
                className="fill-muted-foreground/70 text-[7px]">{r + 1}</text>
            ))}
            {Array.from({ length: cols }).map((_, c) => (
              <text key={`cl-${c}`} x={roomOx + seatX(c) + seatW / 2} y={roomOy + roomH - 6}
                textAnchor="middle" dominantBaseline="middle"
                className="fill-muted-foreground/70 text-[7px]">{c + 1}</text>
            ))}
          </svg>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Navigation className="w-3 h-3 text-primary" />
          从 <strong>{activeDoor?.label || '入口'}</strong> 进入
        </p>
        {dirHint && <p>🚶 {dirHint}</p>}
      </div>
    </>
  );
}
