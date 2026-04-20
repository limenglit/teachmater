// Cloud sync for seat history (all 6 scenes) — only for logged-in users.
// Local helpers in `teamwork-local.ts` remain unchanged; this module layers cloud on top.
import { supabase } from '@/integrations/supabase/client';
import {
  loadSmartClassroomHistory,
  loadBanquetHallHistory,
  loadConferenceRoomHistory,
  loadClassroomHistory,
  loadComputerLabHistory,
  loadConcertHallHistory,
  type SmartClassroomHistoryItem,
  type BanquetHallHistoryItem,
  type ConferenceRoomHistoryItem,
  type ClassroomHistoryItem,
  type ComputerLabHistoryItem,
  type ConcertHallHistoryItem,
} from '@/lib/teamwork-local';

export type SeatSceneType =
  | 'classroom'
  | 'smart_classroom'
  | 'banquet'
  | 'conference'
  | 'computer_lab'
  | 'concert';

export interface CloudSeatHistoryRow<S = unknown> {
  id: string;
  name: string;
  createdAt: string;
  snapshot: S;
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchCloudSeatHistory<S = unknown>(
  scene: SeatSceneType
): Promise<CloudSeatHistoryRow<S>[] | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('seat_history')
    .select('id, name, snapshot, created_at')
    .eq('user_id', userId)
    .eq('scene_type', scene)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[seat-history] fetch error', error);
    return null;
  }
  return (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    snapshot: r.snapshot as S,
  }));
}

export async function saveCloudSeatHistory<S = unknown>(
  scene: SeatSceneType,
  name: string,
  snapshot: S
): Promise<CloudSeatHistoryRow<S> | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('seat_history')
    .insert({ user_id: userId, scene_type: scene, name, snapshot: snapshot as any })
    .select('id, name, snapshot, created_at')
    .single();
  if (error) {
    console.error('[seat-history] save error', error);
    return null;
  }
  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    snapshot: data.snapshot as S,
  };
}

export async function deleteCloudSeatHistory(id: string): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;
  const { error } = await supabase
    .from('seat_history')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    console.error('[seat-history] delete error', error);
    return false;
  }
  return true;
}

export async function renameCloudSeatHistory(id: string, name: string): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;
  const { error } = await supabase
    .from('seat_history')
    .update({ name })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    console.error('[seat-history] rename error', error);
    return false;
  }
  return true;
}

// One-time migration: upload local history to cloud after first login per scene per user.
const MIGRATION_FLAG_PREFIX = 'teachmate_seat_history_migrated_';

export async function migrateLocalToCloudOnce(scene: SeatSceneType): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const flagKey = `${MIGRATION_FLAG_PREFIX}${scene}_${userId}`;
  if (localStorage.getItem(flagKey)) return;
  let local: { name: string; snapshot: unknown }[] = [];
  try {
    if (scene === 'classroom') local = loadClassroomHistory() as any;
    else if (scene === 'smart_classroom') local = loadSmartClassroomHistory() as any;
    else if (scene === 'banquet') local = loadBanquetHallHistory() as any;
    else if (scene === 'conference') local = loadConferenceRoomHistory() as any;
    else if (scene === 'computer_lab') local = loadComputerLabHistory() as any;
    else if (scene === 'concert') local = loadConcertHallHistory() as any;
  } catch {
    local = [];
  }
  if (!local || local.length === 0) {
    localStorage.setItem(flagKey, '1');
    return;
  }
  // Insert oldest-first so newest local item ends up newest in cloud too.
  const ordered = [...local].reverse();
  const rows = ordered.map(item => ({
    user_id: userId,
    scene_type: scene,
    name: item.name,
    snapshot: item.snapshot as any,
  }));
  const { error } = await supabase.from('seat_history').insert(rows);
  if (error) {
    console.error('[seat-history] migration error', error);
    return;
  }
  localStorage.setItem(flagKey, '1');
}

// Convenience: typed wrappers per scene
export const fetchClassroomHistoryCloud = () =>
  fetchCloudSeatHistory<ClassroomHistoryItem['snapshot']>('classroom');
export const fetchSmartClassroomHistoryCloud = () =>
  fetchCloudSeatHistory<SmartClassroomHistoryItem['snapshot']>('smart_classroom');
export const fetchBanquetHistoryCloud = () =>
  fetchCloudSeatHistory<BanquetHallHistoryItem['snapshot']>('banquet');
export const fetchConferenceHistoryCloud = () =>
  fetchCloudSeatHistory<ConferenceRoomHistoryItem['snapshot']>('conference');
export const fetchComputerLabHistoryCloud = () =>
  fetchCloudSeatHistory<ComputerLabHistoryItem['snapshot']>('computer_lab');
export const fetchConcertHistoryCloud = () =>
  fetchCloudSeatHistory<ConcertHallHistoryItem['snapshot']>('concert');
