import { useRef, useState, useCallback, useEffect, DependencyList } from 'react';

interface PinchZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

const GESTURE_SWIPE_GUARD_MS = 260;

/**
 * Hook that adds pinch-to-zoom and drag-to-pan on a container element.
 * Returns a ref to attach to the zoomable wrapper and the current transform style.
 */
export function usePinchZoom(minScale = 0.5, maxScale = 4, resetDeps: DependencyList = []) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PinchZoomState>({ scale: 1, translateX: 0, translateY: 0 });
  const suppressSwipeUntilRef = useRef(0);

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

  const isInSwipeGuardWindow = useCallback(() => Date.now() < suppressSwipeUntilRef.current, []);

  const startSwipeGuardWindow = useCallback(() => {
    suppressSwipeUntilRef.current = Date.now() + GESTURE_SWIPE_GUARD_MS;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isInSwipeGuardWindow() && e.touches.length === 1) {
      // Pinch/pan rebound phase: prevent parent swipe handlers from interpreting this touch.
      e.stopPropagation();
      return;
    }

    const g = gestureRef.current;
    if (e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
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
  }, [isInSwipeGuardWindow, state.scale, state.translateX, state.translateY]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isInSwipeGuardWindow() && e.touches.length === 1) {
      e.stopPropagation();
      return;
    }

    const g = gestureRef.current;
    if (g.isPinching && e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const rawScale = g.initialScale * (dist / g.initialDistance);
      const scale = Math.min(maxScale, Math.max(minScale, rawScale));

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const translateX = g.initialTranslateX + (midX - g.initialMidX);
      const translateY = g.initialTranslateY + (midY - g.initialMidY);

      setState({ scale, translateX, translateY });
    } else if (g.isPanning && e.touches.length === 1) {
      e.stopPropagation();
      const dx = e.touches[0].clientX - g.panStartX;
      const dy = e.touches[0].clientY - g.panStartY;
      setState(prev => ({
        ...prev,
        translateX: g.panInitTx + dx,
        translateY: g.panInitTy + dy,
      }));
    }
  }, [isInSwipeGuardWindow, minScale, maxScale]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const wasGestureActive = gestureRef.current.isPinching || gestureRef.current.isPanning;
    if (wasGestureActive) {
      startSwipeGuardWindow();
      e.stopPropagation();
    } else if (isInSwipeGuardWindow()) {
      e.stopPropagation();
    }

    gestureRef.current.isPinching = false;
    gestureRef.current.isPanning = false;
  }, [isInSwipeGuardWindow, startSwipeGuardWindow]);

  // Double-tap to reset
  const lastTapRef = useRef(0);
  const handleDoubleTapReset = useCallback((e: TouchEvent) => {
    if (isInSwipeGuardWindow()) return;
    if (e.touches.length !== 1) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setState({ scale: 1, translateX: 0, translateY: 0 });
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [isInSwipeGuardWindow]);

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

  const resetZoom = useCallback(
    () => setState({ scale: 1, translateX: 0, translateY: 0 }),
    []
  );

  // External reset trigger (e.g. "Back to my seat" FAB)
  useEffect(() => {
    if (resetDeps.length === 0) return;
    resetZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  return { containerRef, transformStyle, scale: state.scale, resetZoom };
}
