import { usePinchZoom } from './usePinchZoom';
import ZoomIndicator from './ZoomIndicator';

interface Props {
  imageUrl: string;
  recenterSignal?: number;
}

/**
 * Degraded check-in view: no in-room navigation, just the uploaded seating
 * chart picture with pinch-to-zoom / drag-to-pan support.
 */
export default function SeatChartImageView({ imageUrl, recenterSignal = 0 }: Props) {
  const { containerRef, transformStyle, scale, resetZoom } = usePinchZoom(0.5, 5, [recenterSignal]);

  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted-foreground">双指缩放 / 拖动查看座次表</p>
      <ZoomIndicator scale={scale} onReset={resetZoom} />
      <div className="seat-checkin-surface flex justify-center overflow-hidden rounded-xl border border-border bg-muted/20">
        <div ref={containerRef} style={transformStyle} className="touch-none">
          <img
            src={imageUrl}
            alt="座次表"
            className="max-w-full select-none pointer-events-none"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
