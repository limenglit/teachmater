import { useMemo } from 'react';
import { Palette } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { usePinchZoom } from './usePinchZoom';
import ZoomIndicator from './ZoomIndicator';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
  recenterSignal?: number;
}

const normalizeStudentName = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

export default function ArtStudioCheckinView({ seatData, sceneConfig, studentName, recenterSignal = 0 }: Props) {
  const { t } = useLanguage();
  const rings = Array.isArray(seatData) ? (seatData as string[][]) : [];
  const layoutMode = (sceneConfig.layoutMode as string) || 'radial';

  const myPos = useMemo(() => {
    for (let ring = 0; ring < rings.length; ring++) {
      for (let seat = 0; seat < rings[ring].length; seat++) {
        if (normalizeStudentName(rings[ring][seat] || '') === normalizeStudentName(studentName)) {
          return { ring, seat };
        }
      }
    }
    return null;
  }, [rings, studentName]);

  const seatContainerRef = useAutoCenterMySeat([studentName, myPos?.ring, myPos?.seat, recenterSignal]);
  const { containerRef: pinchRef, transformStyle, scale, resetZoom } = usePinchZoom(0.5, 4, [recenterSignal]);

  if (!myPos) return <p className="text-center text-muted-foreground">{t('seat.nav.notFound')}</p>;

  const centerX = 320;
  const centerY = 240;
  const svgW = 640;
  const svgH = 500;
  // Use the teacher-side ring radii/offsets when the session carries them so the
  // phone view matches the exported chart; otherwise keep the legacy estimate.
  const cfgRadii = Array.isArray(sceneConfig.ringRadii) ? (sceneConfig.ringRadii as number[]) : null;
  const cfgOffsets = Array.isArray(sceneConfig.ringOffsets) ? (sceneConfig.ringOffsets as number[]) : null;
  const baseRadii = rings.map((_, i) => cfgRadii?.[i] ?? 82 + i * 56);
  const maxBaseRadius = Math.max(1, ...baseRadii);
  const fit = Math.min(1, (Math.min(svgW, svgH) / 2 - 40) / maxBaseRadius);
  const ringRadii = baseRadii.map(r => r * fit);
  const seatRx = Math.max(14, 28 * fit);
  const seatRy = Math.max(9, 16 * fit);
  const ringStartAngle = (i: number) => cfgOffsets?.[i] ?? -Math.PI / 2;

  const myLabel = `第${myPos.ring + 1}圈 · 第${myPos.seat + 1}位`;

  return (
    <>
      <p className="text-sm text-muted-foreground text-center leading-relaxed px-2">
        {tFormat(t('seat.nav.youAtPosition'), studentName)} <strong>{myLabel}</strong>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> {t('seat.nav.mySeat')}</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary/10 border border-primary/30 inline-block" /> 写生区核心</span>
        <span className="flex items-center gap-1"><Palette className="w-3.5 h-3.5" /> {layoutMode === 'concentric' ? '同心环布局' : '辐射布局'}</span>
      </div>
      <p className="text-[11px] text-muted-foreground/70 text-center sm:hidden">可双指缩放，拖动画面查看座位</p>
      <ZoomIndicator scale={scale} onReset={resetZoom} />

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-hidden pb-4">
        <div ref={pinchRef} style={transformStyle} className="touch-none">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans w-full max-w-[680px]" style={{ minWidth: Math.min(svgW, 320) }}>
            <rect x={12} y={12} width={svgW - 24} height={svgH - 24} rx={20} className="fill-muted/15 stroke-border" strokeWidth={1.5} />

            <circle cx={centerX} cy={centerY} r={52} className="fill-primary/10 stroke-primary/25" strokeWidth={1.5} />
            <text x={centerX} y={centerY - 6} textAnchor="middle" className="fill-primary text-[13px] font-semibold">写生区</text>
            <text x={centerX} y={centerY + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">请围绕中心入座</text>

            {rings.map((ring, ringIndex) => {
              const radius = baseRadius + ringIndex * radiusStep;
              return (
                <g key={`ring-${ringIndex}`}>
                  <circle cx={centerX} cy={centerY} r={radius} fill="none" className="stroke-border/70" strokeDasharray="5 5" />
                  <text x={centerX + radius + 12} y={centerY - 4} className="fill-muted-foreground text-[10px]">第{ringIndex + 1}圈</text>
                  {ring.map((name, seatIndex) => {
                    const angle = (-Math.PI / 2) + (2 * Math.PI * seatIndex) / Math.max(1, ring.length);
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    const isMine = ringIndex === myPos.ring && seatIndex === myPos.seat;
                    return (
                      <g key={`seat-${ringIndex}-${seatIndex}`} data-my-seat={isMine ? 'true' : undefined}>
                        <ellipse
                          cx={x}
                          cy={y}
                          rx={seatRx}
                          ry={seatRy}
                          className={isMine ? 'fill-primary stroke-primary' : name ? 'fill-card stroke-border' : 'fill-muted/35 stroke-border/30'}
                          strokeWidth={isMine ? 2.5 : 1.2}
                        />
                        <text
                          x={x}
                          y={y + 1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={isMine ? 'fill-primary-foreground text-[9px] font-semibold' : name ? 'fill-foreground text-[9px]' : 'fill-muted-foreground text-[8px]'}
                        >
                          {name || `${seatIndex + 1}`}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </>
  );
}
