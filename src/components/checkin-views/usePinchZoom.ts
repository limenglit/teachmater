import { useRef, useState, useCallback, useEffect, DependencyList } from 'react';

interface PinchZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

const GESTURE_SWIPE_GUARD_MS = 260;
const TRANSFORM_EPSILON = 0.01;

function isTransformNearlyEqual(a: PinchZoomState, b: PinchZoomState) {
  return (
    Math.abs(a.scale - b.scale) < TRANSFORM_EPSILON
    && Math.abs(a.translateX - b.translateX) < TRANSFORM_EPSILON
    && Math.abs(a.translateY - b.translateY) < TRANSFORM_EPSILON
  );
}

/**
 * Hook that adds pinch-to-zoom and drag-to-pan on a container element.
 * Returns a ref to attach to the zoomable wrapper and the current transform style.
 */
export function usePinchZoom(minScale = 0.5, maxScale = 4, resetDeps: DependencyList = []) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PinchZoomState>({ scale: 1, translateX: 0, translateY: 0 });
  const stateRef = useRef<PinchZoomState>({ scale: 1, translateX: 0, translateY: 0 });
  const suppressSwipeUntilRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const pendingStateRef = useRef<PinchZoomState | null>(null);

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

  const flushStateRaf = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      const queued = pendingStateRef.current;
      pendingStateRef.current = null;
      if (!queued) return;
      if (isTransformNearlyEqual(stateRef.current, queued)) return;
      stateRef.current = queued;
      setState(queued);
    });
  }, []);

  const enqueueTransform = useCallback((next: PinchZoomState) => {
    if (isTransformNearlyEqual(stateRef.current, next)) return;
    pendingStateRef.current = next;
    flushStateRaf();
  }, [flushStateRaf]);

  const applyTransformImmediately = useCallback((next: PinchZoomState) => {
    pendingStateRef.current = null;
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (isTransformNearlyEqual(stateRef.current, next)) return;
    stateRef.current = next;
    setState(next);
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
      const current = stateRef.current;
      g.isPinching = true;
      g.isPanning = false;
      g.initialDistance = getDistance(e.touches[0], e.touches[1]);
      g.initialScale = current.scale;
      g.initialMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      g.initialMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      g.initialTranslateX = current.translateX;
      g.initialTranslateY = current.translateY;
    } else if (e.touches.length === 1 && stateRef.current.scale > 1) {
      g.isPanning = true;
      g.panStartX = e.touches[0].clientX;
      g.panStartY = e.touches[0].clientY;
      g.panInitTx = stateRef.current.translateX;
      g.panInitTy = stateRef.current.translateY;
    }
  }, [isInSwipeGuardWindow]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isInSwipeGuardWindow() && e.touches.length === 1) {
      e.stopPropagation();
      return;
    }

    const g = gestureRef.current;
    if (g.isPinching && e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
      if (g.initialDistance <= 0) return;
      const dist = getDistance(e.touches[0], e.touches[1]);
      const rawScale = g.initialScale * (dist / g.initialDistance);
      const scale = Math.min(maxScale, Math.max(minScale, rawScale));

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const translateX = g.initialTranslateX + (midX - g.initialMidX);
      const translateY = g.initialTranslateY + (midY - g.initialMidY);

      enqueueTransform({ scale, translateX, translateY });
    } else if (g.isPanning && e.touches.length === 1) {
      e.stopPropagation();
      const dx = e.touches[0].clientX - g.panStartX;
      const dy = e.touches[0].clientY - g.panStartY;
      enqueueTransform({
        scale: stateRef.current.scale,
        translateX: g.panInitTx + dx,
        translateY: g.panInitTy + dy,
      });
    }
  }, [enqueueTransform, isInSwipeGuardWindow, minScale, maxScale]);

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
      applyTransformImmediately({ scale: 1, translateX: 0, translateY: 0 });
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [applyTransformImmediately, isInSwipeGuardWindow]);

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
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingStateRef.current = null;
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
    () => applyTransformImmediately({ scale: 1, translateX: 0, translateY: 0 }),
    [applyTransformImmediately]
  );

  // External reset trigger (e.g. "Back to my seat" FAB)
  useEffect(() => {
    if (resetDeps.length === 0) return;
    resetZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  return { containerRef, transformStyle, scale: state.scale, resetZoom };
}
