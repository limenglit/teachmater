import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

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

interface UseZoomGesturesOptions {
  setScale: Dispatch<SetStateAction<number>>;
  targetRef: React.RefObject<HTMLElement>;
  min?: number;
  max?: number;
  enabled?: boolean;
}

/**
 * Attach Ctrl+wheel and pinch-to-zoom gestures to a scroll container.
 */
export function useZoomGestures({ setScale, targetRef, min = 0.3, max = 2, enabled = true }: UseZoomGesturesOptions) {
  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) return;

    const clamp = (v: number) => Math.max(min, Math.min(max, Number(v.toFixed(3))));

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = -e.deltaY > 0 ? 1.1 : 0.9;
      setScale(s => clamp(s * factor));
    };

    const activePointers = new Map<number, { x: number; y: number }>();
    let initialDistance = 0;
    let initialScale = 1;
    let pinching = false;

    const distance = () => {
      const pts = Array.from(activePointers.values());
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        initialDistance = distance();
        setScale(s => { initialScale = s; return s; });
        pinching = true;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinching && activePointers.size === 2 && initialDistance > 0) {
        e.preventDefault();
        const ratio = distance() / initialDistance;
        setScale(() => clamp(initialScale * ratio));
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        pinching = false;
        initialDistance = 0;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    el.addEventListener('pointerleave', onPointerEnd);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      el.removeEventListener('pointerleave', onPointerEnd);
    };
  }, [setScale, min, max, enabled, targetRef]);
}

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}

export default function ZoomControls({ scale, onZoomIn, onZoomOut, onFit, onReset }: ZoomControlsProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background/80 backdrop-blur px-1.5 py-1 shadow-sm">
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onZoomOut} title={t('seat.zoom.zoomOut')}>
        <ZoomOut className="w-3.5 h-3.5" />
      </Button>
      <button
        type="button"
        onClick={onReset}
        className="text-[11px] tabular-nums w-10 text-center text-muted-foreground hover:text-foreground"
        title={t('seat.zoom.reset100')}
      >
        {Math.round(scale * 100)}%
      </button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onZoomIn} title={t('seat.zoom.zoomIn')}>
        <ZoomIn className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-[11px]" onClick={onFit} title={t('seat.zoom.fit')}>
        <Maximize2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('seat.zoom.fitShort')}</span>
      </Button>
    </div>
  );
}
