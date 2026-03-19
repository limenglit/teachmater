import { lazy } from 'react';

/** Retry dynamic import once then force-reload to pick up new chunks */
export function lazyRetry<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>,
) {
  return lazy(() =>
    factory().catch(() => {
      const key = 'chunk_reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
      return factory();
    }),
  );
}
