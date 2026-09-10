import { useMemo } from 'react';
import { usePinchZoom } from './usePinchZoom';
import ZoomIndicator from './ZoomIndicator';
import {
  findAllMarkersByName,
  findMarkerByName,
  describeMarker,
  type SeatChartMarker,
} from '@/lib/seat-chart-markers';

interface Props {
  imageUrl: string;
  recenterSignal?: number;
  /** AI-recognized / teacher-confirmed name positions on the picture. */
  markers?: SeatChartMarker[];
  /** The current student's name — highlighted in red. */
  selfName?: string;
  /** Optional friend to highlight in blue. */
  friendName?: string | null;
}

/**
 * Degraded check-in view: no in-room navigation, just the uploaded seating
 * chart picture with pinch-to-zoom / drag-to-pan support. When the teacher has
 * confirmed name markers, the student's own seat (and an optional friend) is
 * marked directly on the picture.
 */
export default function SeatChartImageView({
  imageUrl,
  recenterSignal = 0,
  markers = [],
  selfName = '',
  friendName = null,
}: Props) {
  const { containerRef, transformStyle, scale, resetZoom } = usePinchZoom(0.5, 5, [recenterSignal]);

  const selfMarkers = useMemo(() => findAllMarkersByName(markers, selfName), [markers, selfName]);
  const selfMarker = selfMarkers[0] ?? null;
  const friendMarker = useMemo(
    () => (friendName ? findMarkerByName(markers, friendName) : null),
    [markers, friendName],
  );

  const selfHint = describeMarker(selfMarker);
  const friendHint = describeMarker(friendMarker);
  const hasMarkers = markers.length > 0;

  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted-foreground">双指缩放 / 拖动查看座次表</p>

      {hasMarkers && (
        <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs space-y-1">
          {selfMarker ? (
            <p className="text-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle" />
              已在座次表上标出你的位置
              {selfHint ? `：${selfHint}` : ''}
              {selfMarkers.length > 1 ? '（表中有多位同名，请核对区域）' : ''}
            </p>
          ) : (
            <p className="text-amber-600">未在座次表中找到你的姓名，请按现场安排入座。</p>
          )}
          {friendMarker && (
            <p className="text-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-1.5 align-middle" />
              好友 {friendMarker.name}
              {friendHint ? `：${friendHint}` : ' 已在图上标出'}
            </p>
          )}
        </div>
      )}

      <ZoomIndicator scale={scale} onReset={resetZoom} />
      <div className="seat-checkin-surface flex justify-center overflow-hidden rounded-xl border border-border bg-muted/20">
        <div ref={containerRef} style={transformStyle} className="touch-none">
          <div className="relative">
            <img
              src={imageUrl}
              alt="座次表"
              className="max-w-full select-none pointer-events-none"
              draggable={false}
            />
            {selfMarkers.map((m, i) => (
              <span
                key={`self-${i}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
              >
                <span className="block w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-white animate-ping absolute inset-0 opacity-70" />
                <span className="block w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-white relative" />
                <span className="absolute left-1/2 -translate-x-1/2 top-4 whitespace-nowrap rounded bg-red-500 px-1 py-0.5 text-[9px] leading-none text-white">
                  {m.name}
                </span>
              </span>
            ))}
            {friendMarker && (
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${friendMarker.x * 100}%`, top: `${friendMarker.y * 100}%` }}
              >
                <span className="block w-3.5 h-3.5 rounded-full bg-sky-500 ring-2 ring-white" />
                <span className="absolute left-1/2 -translate-x-1/2 top-4 whitespace-nowrap rounded bg-sky-500 px-1 py-0.5 text-[9px] leading-none text-white">
                  {friendMarker.name}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
