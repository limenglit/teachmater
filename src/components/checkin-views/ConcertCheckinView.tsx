import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { usePinchZoom } from './usePinchZoom';
import ZoomIndicator from './ZoomIndicator';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

type EntryDoor = { side: 'front' | 'back'; label: string };
type Window = { side: 'left' | 'right'; label: string };

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
  recenterSignal?: number;
  /** Friend to highlight on the map (找朋友). */
  friendName?: string;
}

const normalizeStudentName = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

export default function ConcertCheckinView({ seatData, sceneConfig, studentName, recenterSignal = 0, friendName }: Props) {
  const isFriendSeat = (n?: string | null) =>
    !!friendName && !!n && normalizeStudentName(n) === normalizeStudentName(friendName)
      && normalizeStudentName(n) !== normalizeStudentName(studentName);
  const { t } = useLanguage();
  const rows = seatData as string[][];
  const seatsPerRow = (sceneConfig.seatsPerRow as number) || 12;
  const rowCount = rows.length;

  const entryDoors: EntryDoor[] = useMemo(() => {
    if (Array.isArray(sceneConfig.entryDoorSides)) {
      return (sceneConfig.entryDoorSides as string[]).map(side => ({
        side: side === 'back' ? 'back' : 'front',
        label: side === 'back' ? t('seat.nav.backDoor') : t('seat.nav.frontDoor'),
      }));
    }
    const mode = sceneConfig.entryDoorMode as string || 'front';
    if (mode === 'both') return [
      { side: 'front', label: t('seat.nav.frontDoor') },
      { side: 'back', label: t('seat.nav.backDoor') },
    ];
    if (mode === 'back') return [{ side: 'back', label: t('seat.nav.backDoor') }];
    return [{ side: 'front', label: t('seat.nav.frontDoor') }];
  }, [sceneConfig, t]);

  const window: Window = useMemo(() => {
    const doorSides = entryDoors.map(d => d.side);
    if (doorSides.includes('front')) return { side: 'right', label: t('seat.nav.window') };
    return { side: 'left', label: t('seat.nav.window') };
  }, [entryDoors, t]);

  const myPos = useMemo(() => {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (normalizeStudentName(rows[r][c] || '') === normalizeStudentName(studentName)) return { row: r, col: c };
      }
    }
    return null;
  }, [rows, studentName]);

  // Teacher-side geometry (arc angle + collision-resolved row radii) is exported
  // with the session; fall back to the legacy estimate for older sessions.
  const cfgCaps = Array.isArray(sceneConfig.seatCaps) ? (sceneConfig.seatCaps as number[]) : null;
  const seatCaps = Array.from({ length: rowCount }, (_, r) =>
    Math.max(rows[r]?.length || 0, cfgCaps?.[r] ?? seatsPerRow + r * 2));
  const svgW = 540;
  const svgH = 400;
  const cx = svgW / 2;
  const stageY = 48;
  const cfgRadii = Array.isArray(sceneConfig.rowRadii) ? (sceneConfig.rowRadii as number[]) : null;
  const cfgSeatR = Number(sceneConfig.seatRadius) || 18;
  const baseRadii = Array.from({ length: rowCount }, (_, r) =>
    cfgRadii?.[r] ?? (Number(sceneConfig.startRadius) || 80) + r * 44);
  const maxBaseRadius = Math.max(1, ...baseRadii);
  const fit = Math.min(
    1,
    (svgW / 2 - 16) / (maxBaseRadius + cfgSeatR),
    (svgH - stageY - 40) / (maxBaseRadius + cfgSeatR),
  );
  const rowRadii = baseRadii.map(r => r * fit);
  const seatR = Math.max(8, cfgSeatR * fit);
  const cfgArcAngle = Number(sceneConfig.arcAngle) || 0;
  const rowArc = (ri: number) =>
    cfgArcAngle > 0 ? cfgArcAngle : Math.min(Math.PI * 0.85, Math.PI * (0.5 + ri * 0.05));
  const seatContainerRef = useAutoCenterMySeat([studentName, myPos?.row, myPos?.col, recenterSignal]);
  const { containerRef: pinchRef, transformStyle, scale, resetZoom } = usePinchZoom(0.5, 4, [recenterSignal]);

  if (!myPos) return <p className="text-center text-muted-foreground">{t('seat.nav.notFound')}</p>;

  const doorPos = (side: EntryDoor['side']) => {
    if (side === 'front') return { x: cx, y: stageY - 60 };
    return { x: cx, y: svgH - 30 };
  };
  const windowPos = window.side === 'left'
    ? { x: 40, y: svgH / 2 + 30 }
    : { x: svgW - 40, y: svgH / 2 + 30 };

  const mySeatPolar = (() => {
    const r = rowRadii[myPos.row] ?? 0;
    const seatCount = seatCaps[myPos.row];
    const totalAngle = rowArc(myPos.row);
    const startAngle = Math.PI - (Math.PI - totalAngle) / 2;
    const endAngle = (Math.PI - totalAngle) / 2;
    const frac = seatCount <= 1 ? 0.5 : myPos.col / (seatCount - 1);
    const angle = startAngle - frac * (startAngle - endAngle);
    return { r, angle };
  })();
  const mySeatPos = {
    x: cx + mySeatPolar.r * Math.cos(mySeatPolar.angle),
    y: stageY + 15 + mySeatPolar.r * Math.sin(mySeatPolar.angle),
  };

  const nearestDoor = entryDoors[0];
  const nearestDoorPos = doorPos(nearestDoor.side);
  const pathPoints = [
    { ...nearestDoorPos },
    { x: mySeatPos.x, y: nearestDoorPos.y },
    { ...mySeatPos },
  ];

  const getTextFontSize = (name: string) => {
    if (name.length >= 6) return '7px';
    if (name.length >= 4) return '9px';
    return '11px';
  };

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {tFormat(t('seat.nav.youAtPosition'), studentName)}{' '}
        <strong>{tFormat(t('seat.nav.posConcertRowSeat'), myPos.row + 1, myPos.col + 1)}</strong>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> {t('seat.nav.mySeat')}</span>
        {entryDoors.map((d, idx) => (
          <span key={idx} className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-accent border border-accent-foreground/20 inline-block" /> {d.label}</span>
        ))}
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary/50 inline-block" style={{ borderTop: '2px dashed' }} /> {t('seat.nav.navPath')}</span>
      </div>
      <p className="text-[11px] text-muted-foreground/70 text-center sm:hidden">{t('seat.nav.pinchHint')}</p>
      <ZoomIndicator scale={scale} onReset={resetZoom} />

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-hidden pb-4">
        <div ref={pinchRef} style={transformStyle} className="touch-none">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans w-full max-w-[560px]" style={{ minWidth: Math.min(svgW, 320) }}>
          {entryDoors.map((d) => {
            const pos = doorPos(d.side);
            return (
              <g key={d.side}>
                <circle cx={pos.x} cy={pos.y} r={14} className="fill-accent stroke-accent-foreground/30" strokeWidth={1.5} />
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" className="text-[9px] fill-accent-foreground">🚪</text>
                <text x={pos.x} y={pos.y + 22} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[9px]">{d.label}</text>
              </g>
            );
          })}

          <polyline points={pathPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none"
            className="stroke-primary/50" strokeWidth={3} strokeDasharray="8 5" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-dashoffset" from="26" to="0" dur="1.5s" repeatCount="indefinite" />
          </polyline>

          {pathPoints.slice(1, -1).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-primary/40 stroke-primary/60" strokeWidth={1} />
          ))}

          <rect x={cx - 60} y={stageY - 15} width={120} height={28} rx={8}
            className="fill-primary/15 stroke-primary/30" strokeWidth={2} />
          <text x={cx} y={stageY} textAnchor="middle" dominantBaseline="middle"
            className="fill-primary text-base font-semibold">{t('seat.nav.stage')}</text>

          {rows.map((row, ri) => {
            const r = rowRadii[ri] ?? 0;
            const seatCount = seatCaps[ri];
            const totalAngle = rowArc(ri);
            const startAngle = Math.PI - (Math.PI - totalAngle) / 2;
            const endAngle = (Math.PI - totalAngle) / 2;

            return row.map((name, ci) => {
              const frac = seatCount <= 1 ? 0.5 : ci / (seatCount - 1);
              const angle = startAngle - frac * (startAngle - endAngle);
              const sx = cx + r * Math.cos(angle);
              const sy = stageY + 15 + r * Math.sin(angle);
              const isMine = ri === myPos.row && ci === myPos.col;
              const isFriend = isFriendSeat(name);
              return (
                <g key={`${ri}-${ci}`} data-my-seat={isMine ? 'true' : undefined}>
                  <circle cx={sx} cy={sy} r={seatR}
                    className={isMine
                      ? 'fill-primary stroke-primary shadow-lg'
                      : isFriend ? 'fill-accent stroke-primary/70'
                      : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                    strokeWidth={isMine ? 2.5 : isFriend ? 2.5 : 1.5}
                    filter={isMine ? 'drop-shadow(0 2px 8px #38bdf8aa)' : undefined}
                  />
                  {isMine && (
                    <circle cx={sx} cy={sy - seatR - 5} r={3} className="fill-primary">
                      <animate attributeName="r" values="2;4;2" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {name && (
                    <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={getTextFontSize(name)}
                      textLength={name.length > 4 ? seatR * 2.2 : undefined}
                      lengthAdjust={name.length > 4 ? 'spacingAndGlyphs' : undefined}
                      className={`pointer-events-none ${isMine ? 'fill-primary-foreground font-bold' : isFriend ? 'fill-foreground font-bold' : 'fill-foreground'}`}>
                      {name.length > 8 ? name.slice(0, 7) + '…' : name}
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Navigation className="w-3 h-3 text-primary" />
          <span>{tFormat(t('seat.nav.concertEnterFromDoor'), nearestDoor.label)}</span>
        </p>
        <p>{tFormat(t('seat.nav.concertWalkRow'), myPos.row + 1)}</p>
        <p>{tFormat(t('seat.nav.concertSeatFromLeft'), myPos.col + 1)}</p>
      </div>
    </>
  );
}
