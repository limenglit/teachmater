const ACTIVE_CLASS_NAME_KEY = 'teachmate_active_class_name';
const ACTIVE_CLASS_CONTEXT_KEY = 'teachmate_active_class_context_v1';
export const ACTIVE_CLASS_CHANGED_EVENT = 'teachmate:active-class-changed';

export interface ActiveClassContext {
  label: string;
  classIds: string[];
  collegeIds: string[];
}

const cleanIds = (values: string[]) => Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));

export function setActiveClassContext(context: ActiveClassContext) {
  if (typeof window === 'undefined') return;
  const normalized: ActiveClassContext = {
    label: context.label.trim(),
    classIds: cleanIds(context.classIds),
    collegeIds: cleanIds(context.collegeIds),
  };
  if (normalized.label || normalized.classIds.length > 0) {
    window.localStorage.setItem(ACTIVE_CLASS_CONTEXT_KEY, JSON.stringify(normalized));
  } else {
    window.localStorage.removeItem(ACTIVE_CLASS_CONTEXT_KEY);
  }
  setActiveClassName(normalized.label);
}

export function getActiveClassContext(): ActiveClassContext {
  if (typeof window === 'undefined') return { label: '', classIds: [], collegeIds: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVE_CLASS_CONTEXT_KEY) || 'null') as Partial<ActiveClassContext> | null;
    if (parsed && Array.isArray(parsed.classIds) && Array.isArray(parsed.collegeIds)) {
      return {
        label: typeof parsed.label === 'string' ? parsed.label.trim() : getActiveClassName(),
        classIds: cleanIds(parsed.classIds.filter((value): value is string => typeof value === 'string')),
        collegeIds: cleanIds(parsed.collegeIds.filter((value): value is string => typeof value === 'string')),
      };
    }
  } catch {
    // Fall through to the legacy name-only context.
  }
  return { label: getActiveClassName(), classIds: [], collegeIds: [] };
}

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
