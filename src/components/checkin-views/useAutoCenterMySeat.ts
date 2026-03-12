import { DependencyList, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

export function useAutoCenterMySeat(deps: DependencyList) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMobile) return;
    const container = containerRef.current;
    if (!container) return;

    const timer = window.setTimeout(() => {
      const mySeat = container.querySelector('[data-my-seat="true"]') as Element | null;
      if (!mySeat) return;
      mySeat.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [isMobile, ...deps]);

  return containerRef;
}
