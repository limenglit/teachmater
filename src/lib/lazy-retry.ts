import { lazy, type ComponentType } from 'react';

const CHUNK_RELOAD_KEY = 'chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 10_000;
const MODULE_LOAD_ERROR_MESSAGES = [
  'Importing a module script failed',
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
];

type VitePreloadErrorEvent = Event & {
  payload?: unknown;
  preventDefault: () => void;
};

export function isModuleLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return MODULE_LOAD_ERROR_MESSAGES.some((pattern) => message.includes(pattern));
}

function tryReloadForChunkError() {
  if (typeof window === 'undefined') return false;

  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
  const now = Date.now();
  if (now - last > RELOAD_COOLDOWN_MS) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  }
  return false;
}

function waitForReload<T>() {
  return new Promise<T>(() => {
    // Keep Suspense fallback visible while the browser reloads.
  });
}

export function handleVitePreloadError(event: Event) {
  const preloadEvent = event as VitePreloadErrorEvent;
  if (!isModuleLoadError(preloadEvent.payload)) return;

  preloadEvent.preventDefault();
  tryReloadForChunkError();
}

/** Retry dynamic import once then force-reload to pick up new chunks */
export function lazyRetry<T extends { default: ComponentType<any> }>(
  factory: () => Promise<T>,
) {
  return lazy(() =>
    factory()
      .then((module) => {
        // Guard against stale/HTML responses that resolve without a default export.
        // React's lazy internals would otherwise throw "undefined is not an object
        // (evaluating 'e._result.default')" deep in the renderer.
        if (!module || typeof (module as any).default === 'undefined') {
          if (tryReloadForChunkError()) {
            return waitForReload<T>();
          }
          throw new Error('Dynamically imported module is missing a default export');
        }
        return module;
      })
      .catch((error) => {
        if (!isModuleLoadError(error)) {
          throw error;
        }

        if (tryReloadForChunkError()) {
          return waitForReload<T>();
        }

        throw error;
      }),
  );
}
