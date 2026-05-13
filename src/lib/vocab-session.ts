import type { CardItem } from '@/components/toolkit/memory-aid/types';
import { supabase } from '@/integrations/supabase/client';

export type VocabSessionMode = 'match' | 'flash';
export type VocabSessionStatus = 'active' | 'ended';

export interface VocabSessionRecord {
  id: string;
  title: string;
  class_name: string;
  creator_token: string;
  default_mode: VocabSessionMode;
  status: VocabSessionStatus;
}

export interface VocabStudentSession {
  id: string;
  title: string;
  className: string;
  status: VocabSessionStatus;
  defaultMode: VocabSessionMode;
  studentNames: string[];
  set: {
    id: string;
    title: string;
  };
  cards: CardItem[];
}

interface CreateVocabSessionInput {
  setId: string;
  setTitle: string;
  studentNames?: string[];
  className?: string;
  defaultMode?: VocabSessionMode;
  userId?: string | null;
}

function parseArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeStudentName(value: string) {
  return value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
}

function studentNameKey(value: string) {
  return normalizeStudentName(value).replace(/\s+/g, '').toLowerCase();
}

export function normalizeStudentNames(names: string[]) {
  const result: string[] = [];
  const seen = new Set<string>();

  names.forEach((name) => {
    const normalized = normalizeStudentName(name);
    if (!normalized) return;

    const key = studentNameKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  return result;
}

export function resolveRosterStudentName(input: string, roster: string[]) {
  const normalizedInput = normalizeStudentName(input);
  if (!normalizedInput) return null;

  if (roster.length === 0) {
    return normalizedInput;
  }

  const match = roster.find(
    (name) => studentNameKey(name) === studentNameKey(normalizedInput),
  );

  return match ? normalizeStudentName(match) : null;
}

export async function createVocabSession(input: CreateVocabSessionInput): Promise<VocabSessionRecord> {
  const client = supabase as any;
  let userId = input.userId ?? null;

  if (!userId) {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }

  if (!userId) {
    throw new Error('请先登录后再创建词库学习二维码');
  }

  const title = normalizeStudentName(input.setTitle) || '词库学习';
  const className = normalizeStudentName(input.className || '');
  const studentNames = normalizeStudentNames(input.studentNames || []);

  const { data, error } = await client
    .from('vocab_sessions')
    .insert({
      vocab_set_id: input.setId,
      title,
      class_name: className,
      student_names: studentNames,
      default_mode: input.defaultMode || 'match',
      status: 'active',
      user_id: userId,
    })
    .select('id, title, class_name, creator_token, default_mode, status')
    .single();

  if (error) throw error;

  return data as VocabSessionRecord;
}

export async function updateVocabSessionStatus(sessionId: string, token: string, status: VocabSessionStatus) {
  const client = supabase as any;
  const { error } = await client.rpc('update_vocab_session', {
    p_session_id: sessionId,
    p_token: token,
    p_status: status,
  });

  if (error) throw error;
}

export async function loadVocabSessionForStudent(sessionId: string): Promise<VocabStudentSession | null> {
  const client = supabase as any;
  const { data, error } = await client.rpc('get_vocab_session_for_student', {
    p_session_id: sessionId,
  });

  if (error) throw error;
  if (!data) return null;

  const row = typeof data === 'string' ? JSON.parse(data) : data;
  const setInfo = row?.set && typeof row.set === 'object' ? row.set : {};
  const cards = parseArray(row?.cards).map((card) => ({
    id: String(card?.id || ''),
    word: String(card?.word || ''),
    definition: String(card?.definition || ''),
    example: card?.example ? String(card.example) : undefined,
    wordImage: card?.wordImage ? String(card.wordImage) : undefined,
    definitionImage: card?.definitionImage ? String(card.definitionImage) : undefined,
  })) as CardItem[];

  return {
    id: String(row?.id || sessionId),
    title: String(row?.title || setInfo?.title || '词库学习'),
    className: String(row?.class_name || ''),
    status: row?.status === 'ended' ? 'ended' : 'active',
    defaultMode: row?.default_mode === 'flash' ? 'flash' : 'match',
    studentNames: normalizeStudentNames(parseArray(row?.student_names).map((name) => String(name || ''))),
    set: {
      id: String(setInfo?.id || ''),
      title: String(setInfo?.title || row?.title || '词库学习'),
    },
    cards,
  };
}