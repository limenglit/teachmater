const ACTIVE_CLASS_NAME_KEY = 'teachmate_active_class_name';
export const ACTIVE_CLASS_CHANGED_EVENT = 'teachmate:active-class-changed';

export function setActiveClassName(className: string) {
  if (typeof window === 'undefined') return;
  const normalized = className.trim();
  if (normalized) {
    window.localStorage.setItem(ACTIVE_CLASS_NAME_KEY, normalized);
  } else {
    window.localStorage.removeItem(ACTIVE_CLASS_NAME_KEY);
  }
  try {
    window.dispatchEvent(new CustomEvent(ACTIVE_CLASS_CHANGED_EVENT, { detail: normalized }));
  } catch {
    // ignore
  }
}

export function getActiveClassName() {
  if (typeof window === 'undefined') return '';
  return (window.localStorage.getItem(ACTIVE_CLASS_NAME_KEY) || '').trim();
}
