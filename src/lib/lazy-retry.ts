import { Component, createElement, lazy, type ComponentType, type ErrorInfo, type ReactNode } from 'react';

const CHUNK_RELOAD_KEY = 'chunk_reload_ts';
const REACT_RUNTIME_RELOAD_KEY = 'react_runtime_reload_ts';
const RELOAD_COOLDOWN_MS = 10_000;
const REACT_RUNTIME_RELOAD_COOLDOWN_MS = 30_000;
const MODULE_LOAD_ERROR_MESSAGES = [
  'Importing a module script failed',
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
];
const REACT_RUNTIME_MISMATCH_MESSAGES = [
  'dispatcher.useState',
  "Cannot read properties of null (reading 'useState')",
  "null is not an object (evaluating 'dispatcher.useState')",
  'Invalid hook call',
];

type VitePreloadErrorEvent = Event & {
  payload?: unknown;
  preventDefault: () => void;
};

export function isModuleLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return MODULE_LOAD_ERROR_MESSAGES.some((pattern) => message.includes(pattern));
}

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return `${error.message}\n${error.stack ?? ''}`;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeErrorEvent = error as { message?: unknown; error?: unknown; reason?: unknown };
    return [maybeErrorEvent.message, maybeErrorEvent.error, maybeErrorEvent.reason]
      .map((part) => getErrorText(part))
      .filter(Boolean)
      .join('\n');
  }

  return String(error ?? '');
}

export function isReactRuntimeMismatchError(error: unknown) {
  const message = getErrorText(error);
  return REACT_RUNTIME_MISMATCH_MESSAGES.some((pattern) => message.includes(pattern));
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

export function tryReloadForReactRuntimeMismatch() {
  if (typeof window === 'undefined') return false;

  const last = Number(sessionStorage.getItem(REACT_RUNTIME_RELOAD_KEY) || '0');
  const now = Date.now();
  if (now - last <= REACT_RUNTIME_RELOAD_COOLDOWN_MS) {
    return false;
  }

  sessionStorage.setItem(REACT_RUNTIME_RELOAD_KEY, String(now));
  const url = new URL(window.location.href);
  url.searchParams.set('__react_recover', String(now));
  window.location.replace(url.toString());
  return true;
}

type ReactRuntimeRecoveryBoundaryProps = {
  children: ReactNode;
};

type ReactRuntimeRecoveryBoundaryState = {
  error: Error | null;
};

export class ReactRuntimeRecoveryBoundary extends Component<
  ReactRuntimeRecoveryBoundaryProps,
  ReactRuntimeRecoveryBoundaryState
> {
  state: ReactRuntimeRecoveryBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const text = `${getErrorText(error)}\n${errorInfo.componentStack ?? ''}`;
    if (isReactRuntimeMismatchError(text)) {
      tryReloadForReactRuntimeMismatch();
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      return createElement(
        'div',
        { className: 'flex min-h-screen items-center justify-center bg-background p-6 text-center text-muted-foreground' },
        isReactRuntimeMismatchError(error)
          ? '正在刷新课堂工具…'
          : '页面加载失败，请刷新后重试。',
      );
    }

    return this.props.children;
  }
}

export function handleVitePreloadError(event: Event) {
  const preloadEvent = event as VitePreloadErrorEvent;
  if (!isModuleLoadError(preloadEvent.payload)) return;

  preloadEvent.preventDefault();
  tryReloadForChunkError();
}

export function handleRuntimeError(event: ErrorEvent | PromiseRejectionEvent) {
  if (!isReactRuntimeMismatchError(event)) return;

  if ('preventDefault' in event) {
    event.preventDefault();
  }
  tryReloadForReactRuntimeMismatch();
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
