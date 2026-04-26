import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SeatPoint {
  /** Stable unique key for the seat (used for highlighting). */
  key: string;
  /** Logical X for distance calculation (any consistent unit). */
  x: number;
  /** Logical Y for distance calculation (any consistent unit). */
  y: number;
  /** Optional human-friendly label, e.g. "第 2 排第 3 列". */
  label?: string;
}

export interface SwipeRecommendation {
  /** The currently highlighted empty seat (null if none). */
  recommended: SeatPoint | null;
  /** Index into the sorted candidates list (0 = nearest). */
  index: number;
  /** Total number of nearby empty seats. */
  total: number;
  /** Move to the next nearer/farther seat manually. */
  prev: () => void;
  next: () => void;
  /** Reset to the nearest empty seat. */
  reset: () => void;
  /** Touch handlers — spread on the swipeable container. */
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

interface Options {
  /** Maximum number of nearest empty seats to cycle through. */
  maxCandidates?: number;
  /** Minimum horizontal distance (px) to count as a swipe. */
  threshold?: number;
}

/**
 * Mobile swipe gesture that lets a checked-in student preview the nearest
 * empty seats. Visual-only — does not mutate seat assignments.
 *
 * Sorts emptySeats by Euclidean distance from `mySeat` and exposes the current
 * recommendation. Swipe right → previous (closer). Swipe left → next (farther).
 */
export function useSwipeRecommendedSeat(
  mySeat: SeatPoint | null,
  emptySeats: SeatPoint[],
  options: Options = {}
): SwipeRecommendation {
  const { maxCandidates = 8, threshold = 40 } = options;

  // Sort empty seats by distance from my seat, take the nearest N.
  const candidates = useMemo(() => {
    if (!mySeat || emptySeats.length === 0) return [] as SeatPoint[];
    return [...emptySeats]
      .map(s => ({
        seat: s,
        d: Math.hypot(s.x - mySeat.x, s.y - mySeat.y),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, maxCandidates)
      .map(c => c.seat);
  }, [mySeat, emptySeats, maxCandidates]);

  const [index, setIndex] = useState(0);

  // Reset when candidate set or my seat changes.
  useEffect(() => {
    setIndex(0);
  }, [mySeat?.key, candidates.length]);

  const next = useCallback(() => {
    setIndex(i => Math.min(i + 1, Math.max(candidates.length - 1, 0)));
  }, [candidates.length]);

  const prev = useCallback(() => {
    setIndex(i => Math.max(i - 1, 0));
  }, []);

  const reset = useCallback(() => setIndex(0), []);

  // Touch tracking
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      // Two-finger pinch is for zoom, not swipe.
      startRef.current = null;
      return;
    }
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    // If the user starts pinching mid-gesture, abort the swipe.
    if (e.touches.length > 1) startRef.current = null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Must be predominantly horizontal and exceed threshold.
      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      // Quick gesture only (under 800ms) to avoid accidental long drags.
      if (Date.now() - start.time > 800) return;
      if (dx < 0) next();
      else prev();
    },
    [threshold, next, prev]
  );

  return {
    recommended: candidates[index] ?? null,
    index,
    total: candidates.length,
    prev,
    next,
    reset,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
