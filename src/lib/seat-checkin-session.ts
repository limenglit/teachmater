import { supabase } from '@/integrations/supabase/client';

const SEAT_CHECKIN_SESSION_TOKENS_KEY = 'teachmate_seat_checkin_session_tokens_v1';
const SEAT_CHECKIN_SESSION_IDS_KEY = 'teachmate_seat_checkin_session_ids_v1';

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

type SeatCheckinHistoryRow = {
  id: string;
  created_at: string;
  duration_minutes?: number;
  status?: string;
  ended_at?: string | null;
  scene_type?: string;
  class_name?: string;
  student_names?: unknown;
};

interface CreateSeatCheckinSessionParams {
  seatData: unknown;
  studentNames: string[];
  sceneConfig: Record<string, unknown>;
  sceneType: string;
  durationMinutes: number;
  className?: string;
}

const createSeatCheckinCreatorToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const getSeatCheckinSessionTokens = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SEAT_CHECKIN_SESSION_TOKENS_KEY) || '{}');
  } catch {
    return {};
  }
};

const getSeatCheckinSessionIds = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEAT_CHECKIN_SESSION_IDS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
};

const saveSeatCheckinSessionId = (sessionId: string) => {
  const ids = getSeatCheckinSessionIds();
  if (ids.includes(sessionId)) return;
  const next = [sessionId, ...ids].slice(0, 200);
  localStorage.setItem(SEAT_CHECKIN_SESSION_IDS_KEY, JSON.stringify(next));
};

const removeSeatCheckinSessionId = (sessionId: string) => {
  const ids = getSeatCheckinSessionIds().filter(id => id !== sessionId);
  localStorage.setItem(SEAT_CHECKIN_SESSION_IDS_KEY, JSON.stringify(ids));
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
  removeSeatCheckinSessionId(sessionId);
};

export const getSeatCheckinSessionToken = (sessionId: string) => {
  return getSeatCheckinSessionTokens()[sessionId] || null;
};

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; shouldRetry?: (err: unknown) => boolean } = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 500, shouldRetry } = opts;
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = i === attempts - 1;
      if (isLast) break;
      if (shouldRetry && !shouldRetry(err)) throw err;
      // exponential backoff: 500ms, 1000ms
      const delay = baseDelayMs * (i + 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastErr;
}

export async function createSeatCheckinSession({
  seatData,
  studentNames,
  sceneConfig,
  sceneType,
  durationMinutes,
  className,
}: CreateSeatCheckinSessionParams) {
  // Defensive serialization: strip functions/undefined and tolerate odd inputs
  // so the RPC always receives valid JSON values.
  const safeJson = (value: unknown, fallback: unknown) => {
    try {
      const serialized = JSON.stringify(value ?? fallback);
      return serialized === undefined ? fallback : JSON.parse(serialized);
    } catch {
      return fallback;
    }
  };

  const creatorToken = createSeatCheckinCreatorToken();

  const baseInsertData = {
    seat_data: safeJson(seatData, []),
    student_names: safeJson(studentNames, []),
    scene_config: safeJson(sceneConfig, {}),
    scene_type: sceneType || 'classroom',
  };

  const enhancedInsertData = {
    ...baseInsertData,
    creator_token: creatorToken,
    duration_minutes: Math.max(1, Math.floor(durationMinutes || 5)),
    class_name: className?.trim() || '',
  };

  const doCreate = async () => {
    let data: any = null;
    let error: any = null;

    // Preferred path: RPC works for both signed-in and anonymous teachers and
    // always returns the new id + creator_token (no RLS-after-insert issues).
    const rpcResult = await (supabase.rpc as any)('create_seat_checkin_session', {
      p_seat_data: baseInsertData.seat_data,
      p_student_names: baseInsertData.student_names,
      p_scene_config: baseInsertData.scene_config,
      p_scene_type: baseInsertData.scene_type,
      p_duration_minutes: enhancedInsertData.duration_minutes,
      p_class_name: className?.trim() || '',
    });

    if (!rpcResult.error && Array.isArray(rpcResult.data) && rpcResult.data.length > 0) {
      data = rpcResult.data[0];
    } else if (!rpcResult.error && rpcResult.data && typeof rpcResult.data === 'object') {
      data = rpcResult.data;
    } else {
      error = rpcResult.error;
    }

    // Fallback for environments where the RPC is missing or depends on
    // unavailable database helpers such as gen_random_bytes().
    if (!data?.id) {
      const legacyResult = await supabase
        .from('seat_checkin_sessions')
        .insert([enhancedInsertData as any])
        .select('id, creator_token, created_at, duration_minutes, status, ended_at, scene_type, class_name, student_names')
        .single();

      if (!legacyResult.error && legacyResult.data) {
        data = legacyResult.data as any;
        error = null;
      } else if (!error) {
        error = legacyResult.error;
      }
    }

    // Older schemas may not have the new columns yet; fall back again to the
    // minimal insert shape so existing installations keep working.
    if (!data?.id) {
      const minimalResult = await supabase
        .from('seat_checkin_sessions')
        .insert([baseInsertData as any])
        .select('id, created_at, status, scene_type, student_names')
        .single();

      if (!minimalResult.error && minimalResult.data) {
        data = minimalResult.data as any;
        error = null;
      } else if (!error) {
        error = minimalResult.error;
      }
    }

    if (!data?.id) {
      const message = (error && (error.message || error.hint || error.details)) || 'Failed to create seat checkin session';
      throw new Error(typeof message === 'string' ? message : 'Failed to create seat checkin session');
    }

    return data;
  };

  const data = await withRetry(doCreate, {
    attempts: 3,
    baseDelayMs: 500,
    shouldRetry: (err) => {
      const msg = String((err as Error)?.message || '');
      // Retry on network timeout, connection reset, or 5xx-like RPC errors
      return /timeout|network|connection|reset|failed to fetch|503|504|502/i.test(msg);
    },
  });

  if ((data as any).creator_token) {
    saveSeatCheckinSessionToken(data.id, (data as any).creator_token);
  }
  saveSeatCheckinSessionId(data.id);

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
  const tokenIds = Object.keys(getSeatCheckinSessionTokens());
  const ids = Array.from(new Set([...tokenIds, ...getSeatCheckinSessionIds()]));
  let rows: SeatCheckinHistoryRow[] = [];

  const selectEnhanced = 'id, created_at, duration_minutes, status, ended_at, scene_type, class_name, student_names';
  const selectLegacy = 'id, created_at, status, scene_type, student_names';

  const queryHistoryRows = async (build: (selectClause: string) => PromiseLike<{ data: unknown; error: unknown }>) => {
    const enhanced = await build(selectEnhanced);
    if (!enhanced.error && Array.isArray(enhanced.data)) {
      return enhanced.data as SeatCheckinHistoryRow[];
    }

    const legacy = await build(selectLegacy);
    if (!legacy.error && Array.isArray(legacy.data)) {
      return legacy.data as SeatCheckinHistoryRow[];
    }

    return [] as SeatCheckinHistoryRow[];
  };

  // 1) Prefer owner-linked sessions via token RPC (works for guest teachers).
  const tokens = Object.values(getSeatCheckinSessionTokens()).filter(Boolean);
  if (tokens.length > 0) {
    const { data, error } = await supabase.rpc('get_seat_checkin_sessions_by_tokens', { p_tokens: tokens } as any);
    if (!error && Array.isArray(data)) {
      rows = data as SeatCheckinHistoryRow[];
    }
  }

  // 2) Fallback: id-based query (works for logged-in owners via RLS).
  if (rows.length === 0 && ids.length > 0) {
    rows = await queryHistoryRows((selectClause) =>
      supabase
        .from('seat_checkin_sessions')
        .select(selectClause)
        .in('id', ids)
        .order('created_at', { ascending: false })
    );
  }

  if (rows.length === 0) return [];

  return rows
    .filter(item => !sceneType || item.scene_type === sceneType)
    .filter(item => item.status !== 'deleted')
    .map(item => ({
      id: item.id,
      created_at: item.created_at,
      duration_minutes: item.duration_minutes ?? 99999,
      status: item.status ?? 'active',
      ended_at: item.ended_at,
      scene_type: item.scene_type ?? sceneType ?? 'classroom',
      class_name: item.class_name || '',
      student_names: (item.student_names || []) as string[],
    }));
}

export async function loadSeatCheckinRecords(sessionId: string) {
  const token = getSeatCheckinSessionToken(sessionId);
  if (token) {
    const { data, error } = await supabase.rpc('get_seat_checkin_records_for_owner', {
      p_session_id: sessionId,
      p_token: token,
    } as any);
    if (!error && Array.isArray(data)) return data as SeatCheckinRecord[];
  }
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
    const hardDelete = await (supabase.rpc as any)('delete_seat_checkin_session', {
      p_session_id: sessionId,
      p_token: token,
    });

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
