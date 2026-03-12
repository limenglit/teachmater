const ACTIVE_CLASS_NAME_KEY = 'teachmate_active_class_name';

export function setActiveClassName(className: string) {
  if (typeof window === 'undefined') return;
  const normalized = className.trim();
  if (normalized) {
    window.localStorage.setItem(ACTIVE_CLASS_NAME_KEY, normalized);
    return;
  }
  window.localStorage.removeItem(ACTIVE_CLASS_NAME_KEY);
}

export function getActiveClassName() {
  if (typeof window === 'undefined') return '';
  return (window.localStorage.getItem(ACTIVE_CLASS_NAME_KEY) || '').trim();
}
