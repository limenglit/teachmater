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
  const insertData = {
    seat_data: JSON.parse(JSON.stringify(seatData)),
    student_names: JSON.parse(JSON.stringify(studentNames)),
    scene_config: JSON.parse(JSON.stringify(sceneConfig)),
    scene_type: sceneType,
    duration_minutes: durationMinutes,
    class_name: className?.trim() || '',
  };

  const { data, error } = await supabase
    .from('seat_checkin_sessions')
    .insert([insertData])
    .select('id, creator_token, created_at, duration_minutes, status, ended_at, scene_type, class_name, student_names')
    .single();

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
      duration_minutes: (data as any).duration_minutes,
      status: (data as any).status,
      ended_at: (data as any).ended_at,
      scene_type: (data as any).scene_type,
      class_name: (data as any).class_name,
      student_names: ((data as any).student_names || []) as string[],
    } as SeatCheckinSessionSummary,
  };
}

export async function loadSeatCheckinSessionHistory(sceneType?: string) {
  const ids = Object.keys(getSeatCheckinSessionTokens());
  if (ids.length === 0) return [] as SeatCheckinSessionSummary[];

  const { data, error } = await supabase
    .from('seat_checkin_sessions')
    .select('id, created_at, duration_minutes, status, ended_at, scene_type, class_name, student_names')
    .in('id', ids)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[])
    .filter(item => !sceneType || item.scene_type === sceneType)
    .map(item => ({
      id: item.id,
      created_at: item.created_at,
      duration_minutes: item.duration_minutes ?? 5,
      status: item.status,
      ended_at: item.ended_at,
      scene_type: item.scene_type,
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
  if (!token) throw new Error('Missing session token');

  const { error } = await supabase.rpc('update_seat_checkin_session', {
    p_session_id: sessionId,
    p_token: token,
    p_status: 'ended',
  } as any);

  if (error) throw error;
}

export async function deleteSeatCheckinSession(sessionId: string) {
  const token = getSeatCheckinSessionToken(sessionId);
  if (!token) throw new Error('Missing session token');

  const { error } = await supabase.rpc('delete_seat_checkin_session', {
    p_session_id: sessionId,
    p_token: token,
  } as any);

  if (error) throw error;
  removeSeatCheckinSessionToken(sessionId);
}
