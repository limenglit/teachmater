import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { usePinchZoom } from './usePinchZoom';
import ZoomIndicator from './ZoomIndicator';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
  recenterSignal?: number;
  /** Friend to highlight on the map (找朋友). */
  friendName?: string;
}

interface LabRow {
  rowIndex: number;
  side: 'top' | 'bottom';
  students: string[];
}

const normalizeStudentName = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

type DoorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const num = (value: unknown, fallback: number) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);

/**
 * The check-in view renders in the *same* coordinate space as the teacher
 * editor (and therefore the exported PNG): identical seat size, gaps, table bar
 * height, row pitch, row transforms and room box. Only the SVG viewBox scales
 * it down to the phone. Any divergence here makes tables drift and names land
 * in the wrong boxes, so all constants come from the exported scene config.
 */
export default function ComputerLabCheckinView({ seatData, sceneConfig, studentName, recenterSignal = 0, friendName }: Props) {
  const isFriendSeat = (n?: string | null) =>
    !!friendName && !!n && normalizeStudentName(n) === normalizeStudentName(friendName)
      && normalizeStudentName(n) !== normalizeStudentName(studentName);
  const { t } = useLanguage();
  const labRows = Array.isArray(seatData) ? (seatData as LabRow[]) : [];

  const seatsPerSide = num(sceneConfig.seatsPerSide, 8);
  const tableCols = num(sceneConfig.tableCols, 1);
  const seatSide = (sceneConfig.seatSide as string) || 'both';
  const dualSide = seatSide === 'both';
  const showTop = seatSide === 'top' || seatSide === 'both';
  const showBottom = seatSide === 'bottom' || seatSide === 'both';
  const doorPosition = (sceneConfig.doorPosition as DoorPosition) || 'bottom-right';
  const rowTransforms = (sceneConfig.rowTransforms as { x: number; y: number; rotation: number }[] | undefined) || [];
  const closedSeats = useMemo(
    () => new Set(Array.isArray(sceneConfig.closedSeats) ? (sceneConfig.closedSeats as string[]) : []),
    [sceneConfig.closedSeats],
  );

  // Teacher-side constants (see ComputerLab.tsx)
  const seatW = num(sceneConfig.seatW, 56);
  const seatH = num(sceneConfig.seatH, 36);
  const gap = num(sceneConfig.seatGap, 4);
  const colGap = num(sceneConfig.colGap, 40);
  const tableW = num(sceneConfig.tableW, seatsPerSide * (seatW + gap) + gap);
  const allTableW = num(sceneConfig.allTableW, tableW * tableCols + colGap * (tableCols - 1));
  const minRowGap = dualSide ? 128 : 188;
  const rowGap = Math.max(num(sceneConfig.rowGap, 80), minRowGap);

  const derivedRows = labRows.length
    ? Math.max(...labRows.map(r => r.rowIndex)) + 1
    : num(sceneConfig.rowCount, 5);
  const rowCount = Math.max(num(sceneConfig.maxRows, derivedRows), derivedRows);

  const hasRotatedRow = rowTransforms.some(tf => ((tf?.rotation ?? 0) % 180) !== 0);
  const rotationPad = hasRotatedRow ? Math.round(allTableW / 2) + 60 : 0;
  const roomWidth = num(sceneConfig.roomWidth, Math.max(980, allTableW + 40 + 220) + rotationPad);
  const roomHeight = num(sceneConfig.roomHeight, Math.max(760, rowCount * rowGap + 220) + rotationPad);

  const allTableStartX = (roomWidth - allTableW) / 2;
  const centerX = roomWidth / 2;
  const baseYOf = (ri: number) => 120 + ri * rowGap;
  const rowCenterYOf = (ri: number) => (dualSide ? baseYOf(ri) + 20 : baseYOf(ri) + 52);
  const topSeatY = (ri: number) => baseYOf(ri) - seatH - 8;
  const bottomSeatY = (ri: number) => (dualSide ? baseYOf(ri) + 28 : baseYOf(ri) + 24 + 8);
  const seatX = (tci: number, ci: number) => allTableStartX + tci * (tableW + colGap) + gap + ci * (seatW + gap);

  const myPos = useMemo(() => {
    for (const row of labRows) {
      const idx = (row.students || []).findIndex(name => normalizeStudentName(name || '') === normalizeStudentName(studentName));
      if (idx >= 0) return { rowIndex: row.rowIndex, side: row.side, col: idx };
    }
    return null;
  }, [labRows, studentName]);

  const tableColIdx = myPos ? Math.floor(myPos.col / seatsPerSide) : 0;
  const seatContainerRef = useAutoCenterMySeat([studentName, myPos?.rowIndex, myPos?.side, myPos?.col, recenterSignal]);
  const { containerRef: pinchRef, transformStyle, scale, resetZoom } = usePinchZoom(0.5, 4, [recenterSignal]);

  const applyRowTransform = (p: { x: number; y: number }, ri: number) => {
    const tf = rowTransforms[ri] || { x: 0, y: 0, rotation: 0 };
    const rotation = tf.rotation ?? 0;
    const a = (rotation * Math.PI) / 180;
    const cy = rowCenterYOf(ri);
    const dx = p.x - centerX;
    const dy = p.y - cy;
    return {
      x: centerX + dx * Math.cos(a) - dy * Math.sin(a) + (tf.x ?? 0),
      y: cy + dx * Math.sin(a) + dy * Math.cos(a) + (tf.y ?? 0),
    };
  };

  const doorRef = sceneConfig.refPositions as Record<string, { x: number; y: number }> | undefined;
  const doorOnTop = doorPosition.startsWith('top');
  const doorOnLeft = doorPosition.endsWith('left');

  const navPath = useMemo(() => {
    if (!myPos) return [] as { x: number; y: number }[];
    const localCol = myPos.col % seatsPerSide;
    const tci = Math.floor(myPos.col / seatsPerSide);
    const seatCx = seatX(tci, localCol) + seatW / 2;
    const seatCy = (myPos.side === 'top' ? topSeatY(myPos.rowIndex) : bottomSeatY(myPos.rowIndex)) + seatH / 2;
    const aisleX = doorOnLeft ? Math.max(24, allTableStartX - 48) : Math.min(roomWidth - 24, allTableStartX + allTableW + 48);
    const door = doorRef?.door;
    const doorPoint = door
      ? { x: Math.min(Math.max(door.x + 20, 16), roomWidth - 16), y: Math.min(Math.max(door.y + 16, 16), roomHeight - 16) }
      : { x: aisleX, y: doorOnTop ? 40 : roomHeight - 40 };
    const rowAisleY = rowCenterYOf(myPos.rowIndex);
    const pre = [doorPoint, { x: aisleX, y: doorPoint.y }, { x: aisleX, y: rowAisleY }];
    const tail = [{ x: seatCx, y: rowAisleY }, { x: seatCx, y: seatCy }].map(p => applyRowTransform(p, myPos.rowIndex));
    return [...pre, ...tail];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPos, seatsPerSide, seatW, seatH, allTableStartX, allTableW, roomWidth, roomHeight, doorOnLeft, doorOnTop, rowGap, dualSide, doorRef, rowTransforms]);

  const pathD = navPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  if (!myPos) return <p className="text-center text-muted-foreground">{t('seat.nav.notFound')}</p>;

  const doorLabel = tFormat(
    t('seat.nav.computerLabDoor'),
    doorOnTop ? t('seat.nav.computerLabFront') : t('seat.nav.computerLabBack'),
    doorOnLeft ? t('seat.nav.computerLabLeftSide') : t('seat.nav.computerLabRightSide'),
  );
  const walkDir = doorOnTop
    ? (myPos.rowIndex > 0 ? t('seat.nav.computerLabWalkDown') : '')
    : (myPos.rowIndex < rowCount - 1 ? t('seat.nav.computerLabWalkUp') : '');
  const tablePart = tableCols > 1 ? tFormat(t('seat.nav.computerLabTablePart'), tableColIdx + 1) : '';
  const sideText = myPos.side === 'top' ? t('seat.nav.computerLabSideTop') : t('seat.nav.computerLabSideBottom');
  const turnDir = doorOnLeft ? t('seat.nav.dirRight') : t('seat.nav.dirLeft');
  const aisleSide = doorOnLeft ? t('seat.nav.computerLabLeftSide') : t('seat.nav.computerLabRightSide');

  const nameFontSize = (name: string) => (name.length >= 4 ? 11 : 13);

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {tFormat(t('seat.nav.youAtPosition'), studentName)}{' '}
        <strong>{tFormat(t('seat.nav.computerLabFull'), myPos.rowIndex + 1, tablePart, sideText, (myPos.col % seatsPerSide) + 1)}</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> {t('seat.nav.mySeat')}</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary/50 inline-block" style={{ borderTop: '2px dashed' }} /> {t('seat.nav.navPath')}</span>
      </div>
      <p className="text-[11px] text-muted-foreground/70 text-center sm:hidden">{t('seat.nav.pinchHint')}</p>
      <ZoomIndicator scale={scale} onReset={resetZoom} />

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-hidden pb-4">
        <div ref={pinchRef} style={transformStyle} className="touch-none">
          <svg viewBox={`0 0 ${roomWidth} ${roomHeight}`} className="font-sans w-full max-w-[680px]" style={{ minWidth: 320 }}>
            <rect x={2} y={2} width={roomWidth - 4} height={roomHeight - 4} rx={16} className="fill-muted/10 stroke-border" strokeWidth={2} />

            {(sceneConfig.refVisible as Record<string, boolean> | undefined)?.blackboard !== false && doorRef?.blackboard && (
              <text x={doorRef.blackboard.x + 45} y={doorRef.blackboard.y + 16} textAnchor="middle" dominantBaseline="middle" className="fill-primary text-[16px]">
                🖥️ {t('seat.nav.stage')}
              </text>
            )}
            {doorRef?.window && (
              <text x={doorRef.window.x + 45} y={doorRef.window.y + 16} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[16px]">
                🪟
              </text>
            )}

            <path d={pathD} fill="none" className="stroke-primary/50" strokeWidth={4}
              strokeDasharray="10 6" strokeLinecap="round" strokeLinejoin="round">
              <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.5s" repeatCount="indefinite" />
            </path>

            <g>
              <circle cx={navPath[0].x} cy={navPath[0].y} r={16} className="fill-accent stroke-accent-foreground/30" strokeWidth={1.5} />
              <text x={navPath[0].x} y={navPath[0].y + 1} textAnchor="middle" dominantBaseline="middle" className="text-[14px] fill-accent-foreground">🚪</text>
            </g>
            {navPath.slice(1, -1).map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4} className="fill-primary/40 stroke-primary/60" strokeWidth={1} />
            ))}

            {Array.from({ length: rowCount }).map((_, ri) => {
              const baseY = baseYOf(ri);
              const tf = rowTransforms[ri] || { x: 0, y: 0, rotation: 0 };
              const rowCenterY = rowCenterYOf(ri);
              const topRow = labRows.find(r => r.rowIndex === ri && r.side === 'top');
              const bottomRow = labRows.find(r => r.rowIndex === ri && r.side === 'bottom');

              return (
                <g key={ri} transform={`translate(${tf.x ?? 0} ${tf.y ?? 0})`}>
                  <g transform={`rotate(${tf.rotation ?? 0} ${centerX} ${rowCenterY})`}>
                    {Array.from({ length: tableCols }).map((_, tci) => {
                      const tableX = allTableStartX + tci * (tableW + colGap);
                      const seatOffset = tci * seatsPerSide;
                      return (
                        <g key={`tc-${tci}`}>
                          <rect x={tableX} y={baseY} width={tableW} height={24} rx={6}
                            className="fill-primary/10 stroke-primary/30" strokeWidth={1.5} />
                          <text x={tableX + tableW / 2} y={baseY + 12} textAnchor="middle" dominantBaseline="middle" className="fill-primary/50 text-[11px]">
                            {ri + 1}{t('seat.nav.rowShort')}
                          </text>

                          {(['top', 'bottom'] as const).map(side => {
                            if (side === 'top' && !showTop) return null;
                            if (side === 'bottom' && !showBottom) return null;
                            const group = side === 'top' ? topRow : bottomRow;
                            const y = side === 'top' ? topSeatY(ri) : bottomSeatY(ri);
                            return Array.from({ length: seatsPerSide }).map((_, ci) => {
                              const globalCol = seatOffset + ci;
                              const x = seatX(tci, ci);
                              const name = group?.students?.[globalCol] || '';
                              const isClosed = closedSeats.has(`${ri}-${side}-${globalCol}`);
                              const isMine = myPos.rowIndex === ri && myPos.side === side && myPos.col === globalCol;
                              return (
                                <g key={`${side}-${globalCol}`} data-my-seat={isMine ? 'true' : undefined}>
                                  <rect x={x} y={y} width={seatW} height={seatH} rx={4}
                                    className={
                                      isMine ? 'fill-primary stroke-primary'
                                        : isClosed ? 'fill-muted stroke-destructive/60'
                                          : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/40'
                                    }
                                    strokeWidth={isMine ? 3 : 1.5}
                                  />
                                  {isMine && (
                                    <circle cx={x + seatW / 2} cy={side === 'top' ? y - 8 : y + seatH + 8} r={5} className="fill-primary">
                                      <animate attributeName="r" values="4;7;4" dur="1.2s" repeatCount="indefinite" />
                                    </circle>
                                  )}
                                  {isClosed && !name && (
                                    <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="fill-destructive text-[12px]">
                                      {t('seat.editor.common.off')}
                                    </text>
                                  )}
                                  {name && (
                                    <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                                      fontSize={nameFontSize(name)}
                                      className={isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}>
                                      {name.length > 4 ? `${name.slice(0, 4)}…` : name}
                                    </text>
                                  )}
                                </g>
                              );
                            });
                          })}
                        </g>
                      );
                    })}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Navigation className="w-3 h-3 text-primary" />
          <span>
            {tFormat(t('seat.nav.computerLabEnterDoor'), doorLabel)}
            {walkDir && tFormat(t('seat.nav.computerLabAlongAisle'), aisleSide, walkDir, myPos.rowIndex + 1)}
          </span>
        </p>
        <p>
          {tableCols > 1
            ? tFormat(t('seat.nav.computerLabFinalTable'), turnDir, tableColIdx + 1, sideText, (myPos.col % seatsPerSide) + 1)
            : tFormat(t('seat.nav.computerLabFinalLong'), turnDir, sideText, (myPos.col % seatsPerSide) + 1)}
        </p>
      </div>
    </>
  );
}
