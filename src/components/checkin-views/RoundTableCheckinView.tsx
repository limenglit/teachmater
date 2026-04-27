import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePinchZoom } from './usePinchZoom';
import ZoomIndicator from './ZoomIndicator';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
  sceneType: string;
  recenterSignal?: number;
}

type DoorSide = 'top' | 'bottom' | 'left' | 'right';
interface DoorInfo { side: DoorSide; label: string; }

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
  const { t } = useLanguage();
  const tables = seatData as string[][];
  const seatsPerTable = (sceneConfig.seatsPerTable as number) || tables[0]?.length || 6;
  const tableCols = (sceneConfig.tableCols as number) || Math.ceil(Math.sqrt(tables.length));
  const tableRows = Math.ceil(tables.length / tableCols);
  const isMobile = useIsMobile();

  const myPos = useMemo(() => {
    for (let ti = 0; ti < tables.length; ti++) {
      for (let s = 0; s < tables[ti].length; s++) {
        if (tables[ti][s] === studentName) return { table: ti, seat: s };
      }
    }
    return null;
  }, [tables, studentName]);

  const roomW = sceneConfig.roomWidth as number | undefined;
  const roomH = sceneConfig.roomHeight as number | undefined;
  const frontDoorRaw = sceneConfig.frontDoor as { x: number; y: number } | null | undefined;
  const backDoorRaw = sceneConfig.backDoor as { x: number; y: number } | null | undefined;

  const doors: DoorInfo[] = useMemo(() => {
    const list: DoorInfo[] = [];
    if (roomW && roomH) {
      const fs = classifyDoorSide(frontDoorRaw, roomW, roomH);
      if (fs) list.push({ side: fs, label: t('seat.nav.frontDoor') });
      const bs = classifyDoorSide(backDoorRaw, roomW, roomH);
      if (bs) list.push({ side: bs, label: t('seat.nav.backDoor') });
    }
    if (list.length === 0) {
      const pos = (sceneConfig.entryDoorPosition as DoorSide) || 'top';
      const labelMap: Record<DoorSide, string> = {
        top: t('seat.nav.frontDoor'),
        bottom: t('seat.nav.backDoor'),
        left: t('seat.nav.leftDoor'),
        right: t('seat.nav.rightDoor'),
      };
      list.push({ side: pos, label: labelMap[pos] });
    }
    return list;
  }, [roomW, roomH, frontDoorRaw, backDoorRaw, sceneConfig.entryDoorPosition, t]);

  const { containerRef: pinchRef, transformStyle, scale, resetZoom } = usePinchZoom(0.5, 4, [recenterSignal]);

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

  if (!myPos) return <p className="text-center text-muted-foreground">{t('seat.nav.notFound')}</p>;

  const myCenter = tableCenter(myPos.table);
  const myRow = Math.floor(myPos.table / tableCols);
  const myCol = myPos.table % tableCols;

  const doorAnchor = (side: DoorSide) => {
    switch (side) {
      case 'top':    return { x: myCenter.x, y: outsideMargin - 4 };
      case 'bottom': return { x: myCenter.x, y: outsideMargin + innerBottom + aisleGap + 4 };
      case 'left':   return { x: outsideMargin - 4, y: myCenter.y };
      case 'right':  return { x: outsideMargin + innerRight + aisleGap + 4, y: myCenter.y };
    }
  };

  let activeDoor: DoorInfo | null = null;
  {
    let min = Infinity;
    for (const d of doors) {
      const a = doorAnchor(d.side);
      const dist = Math.abs(a.x - myCenter.x) + Math.abs(a.y - myCenter.y);
      if (dist < min) { min = dist; activeDoor = d; }
    }
  }

  const buildPath = (side: DoorSide) => {
    const anchor = doorAnchor(side);
    const points: { x: number; y: number }[] = [anchor];
    const aisleColX = outsideMargin + innerLeft + myCol * cellW - aisleGap / 2;
    const aisleRowY = outsideMargin + innerTop + myRow * cellH - aisleGap / 2;
    if (side === 'top' || side === 'bottom') {
      const aisleY = side === 'top'
        ? outsideMargin + innerTop - aisleGap / 2
        : outsideMargin + innerBottom + aisleGap / 2;
      points.push({ x: anchor.x, y: aisleY });
      points.push({ x: aisleColX, y: aisleY });
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

  const sceneLabel = sceneType === 'banquet' ? t('seat.nav.banquetHall') : t('seat.nav.smartClassroom');
  const sideText: Record<DoorSide, string> = {
    top: t('seat.nav.sideTop'),
    bottom: t('seat.nav.sideBottom'),
    left: t('seat.nav.sideLeft'),
    right: t('seat.nav.sideRight'),
  };
  const dirHint = activeDoor
    ? tFormat(t('seat.nav.roundTableEnter'), activeDoor.label, sideText[activeDoor.side], myPos.table + 1)
    : '';

  return (
    <>
      <p className="text-sm text-muted-foreground text-center leading-relaxed px-2">
        {tFormat(t('seat.nav.youAtPosition'), studentName)}{' '}
        <strong>{tFormat(t('seat.nav.posTableSeat'), myPos.table + 1, myPos.seat + 1)}</strong>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> {t('seat.nav.mySeat')}</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary/20 border border-primary/40 inline-block" /> {t('seat.nav.myTable')}</span>
        <span className="flex items-center gap-1"><span className="text-base leading-none">🚪</span> {t('seat.nav.entry')}</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary/50 inline-block" style={{ borderTop: '2px dashed' }} /> {t('seat.nav.navPath')}</span>
      </div>

      <div className="text-center text-xs text-muted-foreground mb-2">
        <div className="inline-block bg-primary/10 text-primary px-4 py-1 rounded-lg text-xs font-medium border border-primary/20 mb-2">
          {sceneLabel}
        </div>
        {isMobile && (
          <p className="text-[11px] text-muted-foreground/90">{t('seat.nav.pinchHintRecenter')}</p>
        )}
        <ZoomIndicator scale={scale} onReset={resetZoom} />
      </div>

      <div className="text-center text-xs text-primary font-medium mb-2 flex items-center justify-center gap-1">
        <Navigation className="w-3 h-3" />
        <span>{dirHint}</span>
      </div>

      <div
        ref={seatContainerRef}
        className="seat-checkin-surface flex justify-center overflow-hidden pb-4"
      >
        <div ref={pinchRef} style={transformStyle} className="touch-none">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans w-full max-w-[640px]" style={{ minWidth: Math.min(svgW, 320) }}>
            <rect x={outsideMargin / 2} y={outsideMargin / 2}
              width={svgW - outsideMargin} height={svgH - outsideMargin}
              rx={12} className="fill-muted/15 stroke-border" strokeWidth={1.5} />

            {navPath.length > 1 && (
              <path d={pathD} fill="none" className="stroke-primary/60" strokeWidth={2.5}
                strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round">
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" repeatCount="indefinite" />
              </path>
            )}

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

            {navPath.slice(1, -1).map((p, i) => (
              <circle key={`tp-${i}`} cx={p.x} cy={p.y} r={2.5} className="fill-primary/40 stroke-primary/60" strokeWidth={1} />
            ))}

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
                    {ti + 1}{t('seat.nav.tableShort')}
                  </text>
                  {Array.from({ length: seatsPerTable }).map((_, si) => {
                    const angle = (2 * Math.PI * si) / seatsPerTable - Math.PI / 2;
                    const sx = center.x + seatOrbitRadius * Math.cos(angle);
                    const sy = center.y + seatOrbitRadius * Math.sin(angle);
                    const seatName = people[si] || '';
                    const isMine = ti === myPos.table && si === myPos.seat;
                    return (
                      <g key={si}>
                        <circle cx={sx} cy={sy} r={seatRadius}
                          className={isMine
                            ? 'fill-primary stroke-primary'
                            : isMyTable && seatName ? 'fill-card stroke-primary/40'
                            : seatName ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                          strokeWidth={isMine ? 2.5 : 1.2} />
                        {isMine && (
                          <circle cx={sx} cy={sy - seatRadius - 4} r={3} className="fill-primary">
                            <animate attributeName="r" values="2;4;2" dur="1.2s" repeatCount="indefinite" />
                          </circle>
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
        <p>{tFormat(t('seat.nav.roundTableHint1'), myPos.table + 1, myRow + 1, myCol + 1)}</p>
        <p>{tFormat(t('seat.nav.roundTableHint2'), myPos.seat + 1)}</p>
      </div>
    </>
  );
}
