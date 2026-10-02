// Per-class data space for signed-in teachers.
// The active class is chosen in the top bar; whiteboards, quizzes and
// check-ins are tagged with it on create and filtered by it on load.
// null = "未分班" (unassigned / legacy content).
import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';

const KEY = 'tm-active-class-id';
const EVT = 'tm-active-class-change';

export type ClassKind = 'board' | 'quiz' | 'checkin' | 'seat_checkin';
const TABLE: Record<ClassKind, string> = {
  board: 'boards',
  quiz: 'quiz_sessions',
  checkin: 'checkin_sessions',
  seat_checkin: 'seat_checkin_sessions',
};

export function getActiveClassId(): string | null {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}

export function setActiveClassId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb); };
}

export function useActiveClassId(): string | null {
  return useSyncExternalStore(subscribe, getActiveClassId, () => null);
}

async function signedInUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Tag a freshly created item with the active class (signed-in only). */
export async function tagWithActiveClass(kind: ClassKind, id: string): Promise<void> {
  const classId = getActiveClassId();
  if (!classId || !id) return;
  if (!(await signedInUserId())) return;
  const { error } = await (supabase as any).rpc('set_content_class', {
    p_kind: kind, p_id: id, p_class_id: classId,
  });
  if (error) console.warn('[class-space] tag failed', error.message);
}

/** Move an item to another class (null = 未分班). */
export async function moveToClass(kind: ClassKind, id: string, classId: string | null) {
  const { error } = await (supabase as any).rpc('set_content_class', {
    p_kind: kind, p_id: id, p_class_id: classId,
  });
  if (error) throw error;
}

/**
 * Keep only rows belonging to the active class. Rows without a class
 * (legacy / guest) only appear in 未分班. Guests are not filtered.
 */
export async function filterByActiveClass<T extends { id: string }>(kind: ClassKind, rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  if (!(await signedInUserId())) return rows;
  const active = getActiveClassId();
  const ids = rows.map(r => r.id);
  const map = new Map<string, string | null>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await (supabase.from(TABLE[kind] as any) as any)
      .select('id, class_id').in('id', ids.slice(i, i + 200));
    if (error) return active ? [] : rows;
    (data || []).forEach((r: any) => map.set(r.id, r.class_id ?? null));
  }
  return rows.filter(r => (map.get(r.id) ?? null) === active);
}
