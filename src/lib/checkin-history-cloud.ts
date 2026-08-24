// Cloud-backed check-in history for logged-in teachers.
// Ensures every session created by an account is visible on any device,
// instead of relying on browser localStorage only.
import { supabase } from '@/integrations/supabase/client';
import type { CheckinRecord, SessionData } from '@/lib/checkin-utils';

export interface CheckinHistoryEntry {
  session: SessionData;
  records: CheckinRecord[];
  unchecked: string[];
  savedAt: string;
  source: 'cloud' | 'local';
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Load all check-in sessions (with records) that belong to the logged-in user. */
export async function fetchCloudCheckinHistory(limit = 100): Promise<CheckinHistoryEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data: sessions, error } = await supabase
    .from('checkin_sessions')
    .select('id, created_at, duration_minutes, status, ended_at, creator_token, student_names')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(sessions) || sessions.length === 0) return [];

  const ids = sessions.map(s => s.id);
  const { data: records } = await supabase
    .from('checkin_records')
    .select('id, session_id, student_name, checked_in_at, status')
    .in('session_id', ids)
    .order('checked_in_at', { ascending: true });

  const bySession = new Map<string, CheckinRecord[]>();
  (records ?? []).forEach((r: any) => {
    const list = bySession.get(r.session_id) ?? [];
    list.push({
      id: r.id,
      student_name: r.student_name,
      checked_in_at: r.checked_in_at,
      status: r.status,
    });
    bySession.set(r.session_id, list);
  });

  return sessions.map((s: any) => {
    const recs = bySession.get(s.id) ?? [];
    const roster: string[] = Array.isArray(s.student_names) ? s.student_names : [];
    const checked = recs.filter(r => r.status === 'matched').map(r => r.student_name);
    return {
      session: {
        id: s.id,
        created_at: s.created_at,
        duration_minutes: s.duration_minutes ?? 0,
        status: s.status ?? 'ended',
        ended_at: s.ended_at ?? null,
        creator_token: s.creator_token ?? '',
      },
      records: recs,
      unchecked: roster.filter(n => !checked.includes(n)),
      savedAt: s.ended_at || s.created_at,
      source: 'cloud' as const,
    };
  });
}

/** Merge cloud entries with local ones, cloud wins on duplicate session id. */
export function mergeCheckinHistory(
  cloud: CheckinHistoryEntry[],
  local: Array<Partial<CheckinHistoryEntry>>,
): CheckinHistoryEntry[] {
  const seen = new Set(cloud.map(e => e.session.id));
  const localEntries = (local || [])
    .filter((e): e is CheckinHistoryEntry => !!e && !!(e as any).session?.id && !seen.has((e as any).session.id))
    .map(e => ({ ...e, source: 'local' as const }));
  return [...cloud, ...localEntries].sort(
    (a, b) => new Date(b.savedAt || b.session.created_at).getTime() - new Date(a.savedAt || a.session.created_at).getTime(),
  );
}
