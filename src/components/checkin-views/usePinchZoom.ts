import { useRef, useState, useCallback, useEffect } from 'react';

interface PinchZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

/**
 * Hook that adds pinch-to-zoom and drag-to-pan on a container element.
 * Returns a ref to attach to the zoomable wrapper and the current transform style.
 */
export function usePinchZoom(minScale = 0.5, maxScale = 4) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PinchZoomState>({ scale: 1, translateX: 0, translateY: 0 });

  // Refs for gesture tracking (avoid stale closures)
  const gestureRef = useRef({
    initialDistance: 0,
    initialScale: 1,
    initialMidX: 0,
    initialMidY: 0,
    initialTranslateX: 0,
    initialTranslateY: 0,
    isPinching: false,
    // single-finger pan
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panInitTx: 0,
    panInitTy: 0,
  });

  const getDistance = (t1: Touch, t2: Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const g = gestureRef.current;
    if (e.touches.length === 2) {
      e.preventDefault();
      g.isPinching = true;
      g.isPanning = false;
      g.initialDistance = getDistance(e.touches[0], e.touches[1]);
      g.initialScale = state.scale;
      g.initialMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      g.initialMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      g.initialTranslateX = state.translateX;
      g.initialTranslateY = state.translateY;
    } else if (e.touches.length === 1 && state.scale > 1) {
      g.isPanning = true;
      g.panStartX = e.touches[0].clientX;
      g.panStartY = e.touches[0].clientY;
      g.panInitTx = state.translateX;
      g.panInitTy = state.translateY;
    }
  }, [state.scale, state.translateX, state.translateY]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const g = gestureRef.current;
    if (g.isPinching && e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const rawScale = g.initialScale * (dist / g.initialDistance);
      const scale = Math.min(maxScale, Math.max(minScale, rawScale));

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const translateX = g.initialTranslateX + (midX - g.initialMidX);
      const translateY = g.initialTranslateY + (midY - g.initialMidY);

      setState({ scale, translateX, translateY });
    } else if (g.isPanning && e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.panStartX;
      const dy = e.touches[0].clientY - g.panStartY;
      setState(prev => ({
        ...prev,
        translateX: g.panInitTx + dx,
        translateY: g.panInitTy + dy,
      }));
    }
  }, [minScale, maxScale]);

  const handleTouchEnd = useCallback(() => {
    gestureRef.current.isPinching = false;
    gestureRef.current.isPanning = false;
  }, []);

  // Double-tap to reset
  const lastTapRef = useRef(0);
  const handleDoubleTapReset = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setState({ scale: 1, translateX: 0, translateY: 0 });
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      handleDoubleTapReset(e);
      handleTouchStart(e);
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleDoubleTapReset]);

  const transformStyle: React.CSSProperties = {
    transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
    transformOrigin: 'center center',
    transition: gestureRef.current.isPinching || gestureRef.current.isPanning ? 'none' : 'transform 0.2s ease-out',
  };

  return { containerRef, transformStyle, scale: state.scale, resetZoom: () => setState({ scale: 1, translateX: 0, translateY: 0 }) };
}
