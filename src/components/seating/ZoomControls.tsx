import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export interface UseSceneZoomOptions {
  contentWidth: number;
  contentHeight: number;
  min?: number;
  max?: number;
  step?: number;
}

export function useSceneZoom({ contentWidth, contentHeight, min = 0.3, max = 2, step = 0.1 }: UseSceneZoomOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const fitToScreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth - 16; // padding allowance
    const ch = el.clientHeight - 16;
    if (cw <= 0 || ch <= 0 || contentWidth <= 0 || contentHeight <= 0) return;
    const next = Math.min(cw / contentWidth, ch / contentHeight, 1);
    setScale(Math.max(min, Math.min(max, Number(next.toFixed(3)))));
  }, [contentWidth, contentHeight, min, max]);

  const zoomIn = useCallback(() => setScale(s => Math.min(max, Number((s + step).toFixed(3)))), [max, step]);
  const zoomOut = useCallback(() => setScale(s => Math.max(min, Number((s - step).toFixed(3)))), [min, step]);
  const reset = useCallback(() => setScale(1), []);

  // Re-fit when container size changes drastically (initial mount)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // intentionally no auto-fit on resize to avoid surprising users; user can click 适应
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { containerRef, scale, setScale, fitToScreen, zoomIn, zoomOut, reset };
}

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}

export default function ZoomControls({ scale, onZoomIn, onZoomOut, onFit, onReset }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background/80 backdrop-blur px-1.5 py-1 shadow-sm">
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onZoomOut} title="缩小">
        <ZoomOut className="w-3.5 h-3.5" />
      </Button>
      <button
        type="button"
        onClick={onReset}
        className="text-[11px] tabular-nums w-10 text-center text-muted-foreground hover:text-foreground"
        title="重置 100%"
      >
        {Math.round(scale * 100)}%
      </button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onZoomIn} title="放大">
        <ZoomIn className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-[11px]" onClick={onFit} title="适应屏幕">
        <Maximize2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">适应</span>
      </Button>
    </div>
  );
}
