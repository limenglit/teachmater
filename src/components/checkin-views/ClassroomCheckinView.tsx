import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { usePinchZoom } from './usePinchZoom';
import ZoomIndicator from './ZoomIndicator';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';
import { classroomSeatNumber } from '@/lib/seat-number';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
  recenterSignal?: number;
  /** A neighbouring student who already checked in — shown on their seat. */
  neighborName?: string;
}

type DoorSide = 'top' | 'bottom' | 'left' | 'right';

interface Door {
  side: DoorSide;
  label: string;
  // grid coord at the perimeter where the door touches the room
  row: number;
  col: number;
}

const normalizeStudentName = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

export default function ClassroomCheckinView({ seatData, sceneConfig, studentName, recenterSignal = 0, neighborName }: Props) {
  const { t } = useLanguage();
  const seats = seatData as (string | null)[][];
  const config = sceneConfig as {
    rows: number; cols: number; windowOnLeft: boolean;
    colAisles?: number[]; rowAisles?: number[]; aisleGap?: number;
    entryDoorMode?: 'front' | 'back' | 'both';
    frontDoorPosition?: DoorSide;
    backDoorPosition?: DoorSide;
    disabledSeats?: string[];
    rowCols?: number[];
  };
  const disabledSeatSet = useMemo(
    () => new Set(Array.isArray(config.disabledSeats) ? config.disabledSeats : []),
    [config.disabledSeats]
  );

  const myPosition = useMemo(() => {
    for (let r = 0; r < seats.length; r++) {
      for (let c = 0; c < seats[r].length; c++) {
        if (typeof seats[r][c] === 'string' && normalizeStudentName(seats[r][c] as string) === normalizeStudentName(studentName)) return { r, c };
      }
    }
    return null;
  }, [seats, studentName]);

  const rows = config.rows || seats.length;
  // Rows can have different widths in the teacher editor (rowCols). Rendering a
  // uniform grid drew phantom seats and shifted the columns/aisles, so use the
  // per-row width whenever it is available.
  const rowColsConfig = Array.isArray(config.rowCols)
    ? config.rowCols.map(n => Math.max(0, Math.floor(Number(n) || 0)))
    : [];
  const rowWidth = (r: number) => rowColsConfig[r] ?? (seats[r]?.length ?? config.cols ?? 0);
  const cols = Math.max(
    1,
    config.cols || 0,
    ...rowColsConfig,
    ...seats.map(row => row?.length ?? 0),
  );
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
      list.push({ side: frontDoorPos, label: t('seat.nav.frontDoor'), row: e.row, col: e.col });
    }
    if (entryDoorMode === 'back' || entryDoorMode === 'both') {
      const e = doorEntryCell(backDoorPos);
      list.push({ side: backDoorPos, label: t('seat.nav.backDoor'), row: e.row, col: e.col });
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

  const seatContainerRef = useAutoCenterMySeat([studentName, myPosition?.r, myPosition?.c, recenterSignal]);
  const { containerRef: pinchRef, transformStyle, scale, resetZoom } = usePinchZoom(0.5, 4, [recenterSignal]);

  // ---- SVG layout constants (declared before any conditional return) ----
  const seatW = 36;
  const seatH = 26;
  const gapX = 6;
  const gapY = 8;
  const padX = 40; // room interior horizontal padding
  const padY = 36; // room interior vertical padding
  const aisleGap = Math.max(4, Math.min(48, Number(config.aisleGap) || 14)); // configurable spacing for row/col aisles

  if (!myPosition) return <p className="text-center text-muted-foreground">{t('seat.nav.notFound')}</p>;

  // Aisle indices (after column / after row N). Clamp to valid range.
  const colAisleSet = Array.from(new Set((config.colAisles || []).filter((n) => Number.isInteger(n) && n >= 0 && n < cols - 1))).sort((a, b) => a - b);
  const rowAisleSet = Array.from(new Set((config.rowAisles || []).filter((n) => Number.isInteger(n) && n >= 0 && n < rows - 1))).sort((a, b) => a - b);
  const colShift = (c: number) => colAisleSet.filter((a) => a < c).length * aisleGap;
  const rowShift = (r: number) => rowAisleSet.filter((a) => a < r).length * aisleGap;

  // ---- Derived layout (depends on cols/rows known after guard) ----
  const innerW = cols * seatW + (cols - 1) * gapX + colAisleSet.length * aisleGap;
  const innerH = rows * seatH + (rows - 1) * gapY + rowAisleSet.length * aisleGap;
  const roomW = innerW + padX * 2;
  const roomH = innerH + padY * 2;

  const seatX = (c: number) => padX + c * (seatW + gapX) + colShift(c);
  const seatY = (r: number) => padY + r * (seatH + gapY) + rowShift(r);
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
    const c = classroomSeatNumber(myPosition.r, myPosition.c, {
      rowWidth: rowWidth(myPosition.r),
      disabledSeats: disabledSeatSet,
    }) ?? myPosition.c + 1;
    const lr = windowOnLeft ? t('seat.nav.dirLeft') : t('seat.nav.dirRight');
    if (s === 'top') return tFormat(t('seat.nav.classroomDirTop'), r, lr, c);
    if (s === 'bottom') return tFormat(t('seat.nav.classroomDirBottom'), r, lr, c);
    if (s === 'left') return tFormat(t('seat.nav.classroomDirLeft'), r, c);
    return tFormat(t('seat.nav.classroomDirRight'), r, c);
  })();

  return (
    <>
      {/* Compact legend (2 rows on mobile, 1 row on tablet+) */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground px-1">
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-2.5 rounded-sm bg-primary inline-block shrink-0" /> {t('seat.nav.mySeat')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 bg-primary/60 inline-block shrink-0" style={{ borderTop: '2px dashed' }} /> {t('seat.nav.navPath')}</span>
        <span className="flex items-center gap-1.5"><span className="text-sm leading-none shrink-0">🚪</span> {t('seat.nav.entry')}</span>
      </div>
      <ZoomIndicator scale={scale} onReset={resetZoom} />

      <div
        ref={seatContainerRef}
        className="seat-checkin-surface flex justify-center overflow-hidden pb-4"
      >
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
                className="fill-primary text-[10px] font-medium">{t('seat.nav.podium')}</text>
            </g>

            {/* Aisle guides (vertical) */}
            {colAisleSet.map((a) => {
              const x = roomOx + seatX(a) + seatW + gapX / 2 + aisleGap / 2;
              return (
                <g key={`va-${a}`}>
                  <line x1={x} y1={roomOy + padY / 2} x2={x} y2={roomOy + roomH - padY / 2}
                    className="stroke-muted-foreground/30" strokeWidth={1} strokeDasharray="3 3" />
                  <text x={x} y={roomOy + padY / 2 - 2} textAnchor="middle"
                    className="fill-muted-foreground/70 text-[7px]">{t('seat.custom.aisle') || t('seat.nav.entry')}</text>
                </g>
              );
            })}
            {/* Aisle guides (horizontal) */}
            {rowAisleSet.map((a) => {
              const y = roomOy + seatY(a) + seatH + gapY / 2 + aisleGap / 2;
              return (
                <g key={`ha-${a}`}>
                  <line x1={roomOx + padX / 2} y1={y} x2={roomOx + roomW - padX / 2} y2={y}
                    className="stroke-muted-foreground/30" strokeWidth={1} strokeDasharray="3 3" />
                  <text x={roomOx + padX / 2 - 2} y={y} textAnchor="end" dominantBaseline="middle"
                    className="fill-muted-foreground/70 text-[7px]">{t('seat.custom.aisle') || t('seat.nav.entry')}</text>
                </g>
              );
            })}


            {/* Window indicator on the side opposite to the side door (or per config) */}
            <text x={windowOnLeft ? roomOx + 6 : roomOx + roomW - 6}
                  y={roomOy + roomH / 2}
                  textAnchor={windowOnLeft ? 'start' : 'end'} dominantBaseline="middle"
                  className="fill-muted-foreground text-[8px]">{t('seat.nav.window')}</text>

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

            {/* Seats — disabled seats are hidden entirely from check-in nav */}
            {Array.from({ length: rows }).flatMap((_, r) =>
              Array.from({ length: rowWidth(r) }).map((_, c) => {
                const x = roomOx + seatX(c);
                const y = roomOy + seatY(r);
                const name = seats[r]?.[c] ?? null;
                const isMine = myPosition.r === r && myPosition.c === c;
                const isNeighbor = !isMine && !!neighborName && !!name
                  && normalizeStudentName(name) === normalizeStudentName(neighborName);
                const isDisabled = disabledSeatSet.has(`${r}-${c}`) && !isMine;
                if (isDisabled) return null;
                return (
                  <g key={`s-${r}-${c}`} data-my-seat={isMine ? 'true' : undefined}>
                    <rect x={x} y={y} width={seatW} height={seatH} rx={4}
                      className={isMine ? 'fill-primary stroke-primary'
                        : isNeighbor ? 'fill-accent stroke-primary/70'
                        : name ? 'fill-card stroke-border'
                        : 'fill-muted/30 stroke-border/30'}
                      strokeWidth={isMine ? 2.5 : isNeighbor ? 2 : 1}
                    />
                    {isMine && (
                      <circle cx={x + seatW / 2} cy={y - 6} r={4} className="fill-primary">
                        <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {isNeighbor && (
                      <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                        className="fill-foreground text-[8px] font-semibold">
                        {name}
                      </text>
                    )}
                    {isMine && (
                      <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                        className="fill-primary-foreground text-[8px] font-bold">
                        {name || t('seat.nav.mySeat')}
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

      <div className="rounded-xl bg-muted/40 border border-border/60 px-3 py-2.5 text-xs text-foreground/80 space-y-1">
        <p className="flex items-center gap-1.5 font-medium text-primary">
          <Navigation className="w-3.5 h-3.5" />
          {tFormat(t('seat.nav.fromDoor'), activeDoor?.label || t('seat.nav.entry'))}
        </p>
        {dirHint && <p className="text-muted-foreground leading-relaxed pl-5">🚶 {dirHint}</p>}
      </div>
    </>
  );
}
