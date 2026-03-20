import { DependencyList, useEffect, useRef } from 'react';

export function useAutoCenterMySeat(deps: DependencyList) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const timer = window.setTimeout(() => {
      const mySeat = container.querySelector('[data-my-seat="true"]') as HTMLElement | null;
      if (!mySeat) return;

      const containerRect = container.getBoundingClientRect();
      const seatRect = mySeat.getBoundingClientRect();
      const leftDelta = (seatRect.left - containerRect.left) - (container.clientWidth - seatRect.width) / 2;
      const topDelta = (seatRect.top - containerRect.top) - (container.clientHeight - seatRect.height) / 2;

      container.scrollTo({
        left: container.scrollLeft + leftDelta,
        top: container.scrollTop + topDelta,
        behavior: 'smooth',
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [...deps]);

  return containerRef;
}
