import { supabase } from '@/integrations/supabase/client';

const SEAT_CHECKIN_SESSION_TOKENS_KEY = 'teachmate_seat_checkin_session_tokens_v1';

export interface SeatCheckinSessionSummary {
  id: string;
  created_at: string;
  duration_minutes: number;
  status: string;
  ended_at: string | null;
  scene_type: string;
  class_name: string;
  student_names: string[];
}

export interface SeatCheckinRecord {
  id: string;
  session_id: string;
  student_name: string;
  checked_in_at: string;
}

interface CreateSeatCheckinSessionParams {
  seatData: unknown;
  studentNames: string[];
  sceneConfig: Record<string, unknown>;
  sceneType: string;
  durationMinutes: number;
  className?: string;
}

const getSeatCheckinSessionTokens = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SEAT_CHECKIN_SESSION_TOKENS_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveSeatCheckinSessionToken = (sessionId: string, token: string) => {
  const tokens = getSeatCheckinSessionTokens();
  tokens[sessionId] = token;
  localStorage.setItem(SEAT_CHECKIN_SESSION_TOKENS_KEY, JSON.stringify(tokens));
};

export const removeSeatCheckinSessionToken = (sessionId: string) => {
  const tokens = getSeatCheckinSessionTokens();
  delete tokens[sessionId];
  localStorage.setItem(SEAT_CHECKIN_SESSION_TOKENS_KEY, JSON.stringify(tokens));
};

export const getSeatCheckinSessionToken = (sessionId: string) => {
  return getSeatCheckinSessionTokens()[sessionId] || null;
};

export async function createSeatCheckinSession({
  seatData,
  studentNames,
  sceneConfig,
  sceneType,
  durationMinutes,
  className,
}: CreateSeatCheckinSessionParams) {
  const baseInsertData = {
    seat_data: JSON.parse(JSON.stringify(seatData)),
    student_names: JSON.parse(JSON.stringify(studentNames)),
    scene_config: JSON.parse(JSON.stringify(sceneConfig)),
    scene_type: sceneType,
  };

  const enhancedInsertData = {
    ...baseInsertData,
    duration_minutes: durationMinutes,
    class_name: className?.trim() || '',
  };

  let data: any = null;
  let error: any = null;

  const enhancedResult = await supabase
    .from('seat_checkin_sessions')
    .insert([enhancedInsertData as any])
    .select('id, creator_token, created_at, duration_minutes, status, ended_at, scene_type, class_name, student_names')
    .single();

  data = enhancedResult.data as any;
  error = enhancedResult.error;

  // Compatibility fallback: old schema may not have duration_minutes/class_name/creator_token/ended_at yet.
  if (error) {
    const legacyResult = await supabase
      .from('seat_checkin_sessions')
      .insert([baseInsertData as any])
      .select('id, created_at, status, scene_type, student_names')
      .single();

    data = legacyResult.data as any;
    error = legacyResult.error;
  }

  if (error || !data?.id) {
    throw error || new Error('Failed to create seat checkin session');
  }

  if ((data as any).creator_token) {
    saveSeatCheckinSessionToken(data.id, (data as any).creator_token);
  }

  return {
    sessionId: data.id,
    checkinUrl: `${window.location.origin}/seat-checkin/${data.id}`,
    session: {
      id: data.id,
      created_at: (data as any).created_at,
      duration_minutes: (data as any).duration_minutes ?? durationMinutes,
      status: (data as any).status ?? 'active',
      ended_at: (data as any).ended_at ?? null,
      scene_type: (data as any).scene_type ?? sceneType,
      class_name: (data as any).class_name ?? className?.trim() ?? '',
      student_names: ((data as any).student_names || []) as string[],
    } as SeatCheckinSessionSummary,
  };
}

export async function loadSeatCheckinSessionHistory(sceneType?: string) {
  const ids = Object.keys(getSeatCheckinSessionTokens());
  let rows: any[] = [];

  // 1) Prefer owner-linked sessions (newer flow with token).
  if (ids.length > 0) {
    const ownerLinked = await supabase
      .from('seat_checkin_sessions')
      .select('id, created_at, duration_minutes, status, ended_at, scene_type, class_name, student_names')
      .in('id', ids)
      .order('created_at', { ascending: false });

    if (!ownerLinked.error && ownerLinked.data) {
      rows = ownerLinked.data as any[];
    }
  }

  // 2) Compatibility fallback: load recent scene sessions when token list is empty
  // or when owner-linked sessions are not available yet.
  if (rows.length === 0) {
    let query = supabase
      .from('seat_checkin_sessions')
      .select('id, created_at, duration_minutes, status, ended_at, scene_type, class_name, student_names')
      .order('created_at', { ascending: false })
      .limit(30);

    if (sceneType) {
      query = query.eq('scene_type', sceneType);
    }

    const fallback = await query;
    if (fallback.error || !fallback.data) return [];
    rows = fallback.data as any[];
  }

  return rows
    .filter(item => !sceneType || item.scene_type === sceneType)
    .filter(item => item.status !== 'deleted')
    .map(item => ({
      id: item.id,
      created_at: item.created_at,
      duration_minutes: item.duration_minutes ?? 5,
      status: item.status ?? 'active',
      ended_at: item.ended_at,
      scene_type: item.scene_type ?? sceneType ?? 'classroom',
      class_name: item.class_name || '',
      student_names: (item.student_names || []) as string[],
    }));
}

export async function loadSeatCheckinRecords(sessionId: string) {
  const { data, error } = await supabase
    .from('seat_checkin_records')
    .select('*')
    .eq('session_id', sessionId)
    .order('checked_in_at', { ascending: true });

  if (error || !data) return [] as SeatCheckinRecord[];
  return data as SeatCheckinRecord[];
}

export async function endSeatCheckinSession(sessionId: string) {
  const token = getSeatCheckinSessionToken(sessionId);

  // New RPC signature with token.
  if (token) {
    const next = await supabase.rpc('update_seat_checkin_session', {
      p_session_id: sessionId,
      p_token: token,
      p_status: 'ended',
    } as any);
    if (!next.error) return;
  }

  // Legacy fallback: update_seat_checkin_session(p_session_id, p_status)
  const legacy = await supabase.rpc('update_seat_checkin_session', {
    p_session_id: sessionId,
    p_status: 'ended',
  } as any);

  if (legacy.error) throw legacy.error;
}

export async function deleteSeatCheckinSession(sessionId: string) {
  const token = getSeatCheckinSessionToken(sessionId);

  // Preferred hard delete path (new migration).
  if (token) {
    const hardDelete = await supabase.rpc('delete_seat_checkin_session', {
      p_session_id: sessionId,
      p_token: token,
    } as any);

    if (!hardDelete.error) {
      removeSeatCheckinSessionToken(sessionId);
      return;
    }
  }

  // Compatibility fallback for older DB: mark session as deleted using update RPC
  // so it disappears from UI and no longer accepts sign-ins.
  const softDeleteWithToken = token
    ? await supabase.rpc('update_seat_checkin_session', {
        p_session_id: sessionId,
        p_token: token,
        p_status: 'deleted',
      } as any)
    : { error: new Error('no-token') };

  if (!softDeleteWithToken.error) {
    removeSeatCheckinSessionToken(sessionId);
    return;
  }

  const softDeleteLegacy = await supabase.rpc('update_seat_checkin_session', {
    p_session_id: sessionId,
    p_status: 'deleted',
  } as any);

  if (softDeleteLegacy.error) throw softDeleteLegacy.error;
  removeSeatCheckinSessionToken(sessionId);
}
