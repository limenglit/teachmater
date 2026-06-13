import { supabase } from '@/integrations/supabase/client';

export interface VocabErrorEntry {
  cardId?: string;
  word: string;
  definition: string;
  mode: 'match' | 'flash';
}

const LOCAL_KEY = 'vocab-practice-errors-v1';

interface LocalStore {
  // setId -> entries (with count)
  [setId: string]: Array<VocabErrorEntry & { count: number; lastAt: number }>;
}

function readLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function writeLocal(s: LocalStore) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

/** Record an error both locally and to cloud (if logged in). */
export async function recordVocabError(setId: string, entry: VocabErrorEntry): Promise<void> {
  const store = readLocal();
  const list = store[setId] || [];
  const key = (entry.cardId || entry.word).toLowerCase();
  const existing = list.find(e => (e.cardId || e.word).toLowerCase() === key);
  if (existing) {
    existing.count += 1;
    existing.lastAt = Date.now();
  } else {
    list.push({ ...entry, count: 1, lastAt: Date.now() });
  }
  store[setId] = list.slice(-200); // cap
  writeLocal(store);

  // Cloud (fire-and-forget for logged-in users)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from('vocab_practice_errors').insert({
      user_id: user.id,
      vocab_set_id: setId,
      card_id: entry.cardId || null,
      word: entry.word,
      definition: entry.definition,
      mode: entry.mode,
    });
  } catch {
    // silent — local copy is enough for recommendations
  }
}

/** Get aggregated errors for a set: local + cloud (last 30 days). */
export async function getErrorsForSet(setId: string): Promise<Array<VocabErrorEntry & { count: number }>> {
  const store = readLocal();
  const local = store[setId] || [];

  const agg = new Map<string, VocabErrorEntry & { count: number }>();
  for (const e of local) {
    const k = e.word.toLowerCase();
    agg.set(k, { word: e.word, definition: e.definition, mode: e.mode, cardId: e.cardId, count: e.count });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from('vocab_practice_errors')
        .select('word, definition, mode, card_id')
        .eq('user_id', user.id)
        .eq('vocab_set_id', setId)
        .gte('created_at', since)
        .limit(500);
      for (const row of (data || []) as any[]) {
        const k = String(row.word || '').toLowerCase();
        if (!k) continue;
        const cur = agg.get(k);
        if (cur) cur.count += 1;
        else agg.set(k, { word: row.word, definition: row.definition || '', mode: row.mode || 'match', cardId: row.card_id || undefined, count: 1 });
      }
    }
  } catch {
    /* ignore */
  }

  return Array.from(agg.values()).sort((a, b) => b.count - a.count);
}

export function clearLocalErrors(setId: string) {
  const store = readLocal();
  delete store[setId];
  writeLocal(store);
}
