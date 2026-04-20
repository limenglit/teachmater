// Cloud sync for "last working draft" of groups & teams (cross-device).
// Explicit history snapshots already use `teamwork_history` (type='groups'|'teams').
// Here we use sentinel types 'groups_last' / 'teams_last' — one upserted row per user.
import { supabase } from '@/integrations/supabase/client';
import {
  loadLastGroups,
  loadLastTeams,
  saveLastGroups,
  saveLastTeams,
  type PersistedGroup,
  type PersistedTeam,
} from '@/lib/teamwork-local';

type Kind = 'groups' | 'teams';
const SENTINEL_TITLE = '__last_working_draft__';
const sentinelType = (k: Kind) => (k === 'groups' ? 'groups_last' : 'teams_last');

const MIGRATION_FLAG_PREFIX = 'teachmate_teamwork_last_migrated_';

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function fetchLastDraft<T>(kind: Kind): Promise<T[] | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('teamwork_history')
    .select('data, created_at')
    .eq('user_id', userId)
    .eq('type', sentinelType(kind))
    .eq('title', SENTINEL_TITLE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[teamwork-cloud] fetch error', error);
    return null;
  }
  if (!data) return null;
  return (Array.isArray(data.data) ? data.data : null) as T[] | null;
}

async function saveLastDraft<T>(kind: Kind, payload: T[]): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  // Replace previous sentinel rows then insert fresh one (no unique constraint to upsert on).
  const { error: delErr } = await supabase
    .from('teamwork_history')
    .delete()
    .eq('user_id', userId)
    .eq('type', sentinelType(kind))
    .eq('title', SENTINEL_TITLE);
  if (delErr) {
    console.error('[teamwork-cloud] clear previous error', delErr);
  }
  const studentCount = payload.reduce(
    (sum, item: any) => sum + (Array.isArray(item?.members) ? item.members.length : 0),
    0
  );
  const { error } = await supabase.from('teamwork_history').insert([{
    user_id: userId,
    type: sentinelType(kind),
    title: SENTINEL_TITLE,
    data: payload as any,
    student_count: studentCount,
  }]);
  if (error) {
    console.error('[teamwork-cloud] save error', error);
  }
}

export const fetchLastGroupsCloud = () => fetchLastDraft<PersistedGroup>('groups');
export const fetchLastTeamsCloud = () => fetchLastDraft<PersistedTeam>('teams');
export const saveLastGroupsCloud = (groups: PersistedGroup[]) => saveLastDraft('groups', groups);
export const saveLastTeamsCloud = (teams: PersistedTeam[]) => saveLastDraft('teams', teams);

/**
 * One-time migration per user per kind:
 *  - If cloud already has a draft → adopt it locally (cross-device).
 *  - Else if local has a draft → upload it to cloud.
 * Returns the resolved draft (cloud-preferred) or null.
 */
export async function migrateTeamworkLastOnce(kind: 'groups'): Promise<PersistedGroup[] | null>;
export async function migrateTeamworkLastOnce(kind: 'teams'): Promise<PersistedTeam[] | null>;
export async function migrateTeamworkLastOnce(kind: Kind): Promise<any[] | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const flagKey = `${MIGRATION_FLAG_PREFIX}${kind}_${userId}`;
  const alreadyRan = !!localStorage.getItem(flagKey);

  // Always check cloud first to support cross-device pull.
  const cloud = await fetchLastDraft<any>(kind);
  if (cloud && cloud.length > 0) {
    if (kind === 'groups') saveLastGroups(cloud as PersistedGroup[]);
    else saveLastTeams(cloud as PersistedTeam[]);
    localStorage.setItem(flagKey, '1');
    return cloud;
  }

  // No cloud draft. Upload local once if migration hasn't run.
  if (!alreadyRan) {
    const local = kind === 'groups' ? loadLastGroups() : loadLastTeams();
    if (local.length > 0) {
      await saveLastDraft(kind, local);
    }
    localStorage.setItem(flagKey, '1');
    return local.length > 0 ? local : null;
  }

  return null;
}
