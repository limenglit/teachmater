/**
 * Lightweight cross-component signal so every class/roster picker refreshes
 * as soon as the class library changes (create / rename / delete / import).
 */
export const CLASS_LIBRARY_CHANGED_EVENT = 'teachmate:class-library-changed';

export function notifyClassLibraryChanged() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CLASS_LIBRARY_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** Subscribe to class library changes + tab focus. Returns an unsubscribe fn. */
export function onClassLibraryChanged(handler: () => void) {
  if (typeof window === 'undefined') return () => {};
  const onVisible = () => {
    if (document.visibilityState === 'visible') handler();
  };
  window.addEventListener(CLASS_LIBRARY_CHANGED_EVENT, handler);
  window.addEventListener('focus', handler);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener(CLASS_LIBRARY_CHANGED_EVENT, handler);
    window.removeEventListener('focus', handler);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
