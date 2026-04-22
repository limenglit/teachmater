import { supabase } from '@/integrations/supabase/client';

export type VocabAudience = 'primary' | 'junior' | 'senior' | 'university' | 'vocational';
export type VocabStatus = 'private' | 'pending' | 'approved' | 'rejected';

export interface VocabSet {
  id: string;
  user_id: string | null;
  title: string;
  audience: VocabAudience;
  description: string;
  status: VocabStatus;
  reject_reason: string;
  is_system: boolean;
  author_name: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

export interface VocabCard {
  id: string;
  set_id: string;
  word: string;
  definition: string;
  example: string;
  word_image: string;
  definition_image: string;
  sort_order: number;
}

export interface VocabSetWithCount extends VocabSet {
  card_count: number;
}

export const AUDIENCE_OPTIONS: { value: VocabAudience; label: string }[] = [
  { value: 'primary', label: '小学' },
  { value: 'junior', label: '初中' },
  { value: 'senior', label: '高中' },
  { value: 'university', label: '大学' },
  { value: 'vocational', label: '职业培训' },
];

export const audienceLabel = (a: string) =>
  AUDIENCE_OPTIONS.find(o => o.value === a)?.label || a;

export async function listMySets(): Promise<VocabSetWithCount[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('vocab_sets')
    .select('*, vocab_cards(count)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((s: any) => ({
    ...s,
    card_count: s.vocab_cards?.[0]?.count ?? 0,
  }));
}

export async function listPlatformSets(): Promise<VocabSetWithCount[]> {
  const { data, error } = await supabase
    .from('vocab_sets')
    .select('*, vocab_cards(count)')
    .or('status.eq.approved,is_system.eq.true')
    .order('is_system', { ascending: false })
    .order('approved_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((s: any) => ({
    ...s,
    card_count: s.vocab_cards?.[0]?.count ?? 0,
  }));
}

export async function loadCards(setId: string): Promise<VocabCard[]> {
  const { data, error } = await supabase
    .from('vocab_cards')
    .select('*')
    .eq('set_id', setId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export interface CreateSetInput {
  title: string;
  audience: VocabAudience;
  description: string;
  cards: { word: string; definition: string; example?: string }[];
  submit: boolean;
  authorName: string;
}

export async function createSet(input: CreateSetInput): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: setRow, error: setErr } = await supabase
    .from('vocab_sets')
    .insert({
      user_id: user.id,
      title: input.title,
      audience: input.audience,
      description: input.description,
      status: 'private',
      author_name: input.authorName,
    })
    .select('id')
    .single();
  if (setErr) throw setErr;
  const setId = setRow.id;

  const cardRows = input.cards.map((c, i) => ({
    set_id: setId,
    word: c.word,
    definition: c.definition,
    example: c.example || '',
    sort_order: i,
  }));
  if (cardRows.length) {
    const { error: cardErr } = await supabase.from('vocab_cards').insert(cardRows);
    if (cardErr) throw cardErr;
  }
  if (input.submit) {
    const { error: subErr } = await supabase.rpc('submit_vocab_set', { p_set_id: setId });
    if (subErr) throw subErr;
  }
  return setId;
}

export async function updateSet(
  setId: string,
  patch: { title?: string; audience?: VocabAudience; description?: string },
  cards?: { word: string; definition: string; example?: string }[],
): Promise<void> {
  const updates: any = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.audience !== undefined) updates.audience = patch.audience;
  if (patch.description !== undefined) updates.description = patch.description;
  const { error } = await supabase.from('vocab_sets').update(updates).eq('id', setId);
  if (error) throw error;

  if (cards) {
    // Replace all cards
    const { error: delErr } = await supabase.from('vocab_cards').delete().eq('set_id', setId);
    if (delErr) throw delErr;
    if (cards.length) {
      const rows = cards.map((c, i) => ({
        set_id: setId,
        word: c.word,
        definition: c.definition,
        example: c.example || '',
        sort_order: i,
      }));
      const { error: insErr } = await supabase.from('vocab_cards').insert(rows);
      if (insErr) throw insErr;
    }
  }
}

export async function deleteSet(setId: string): Promise<void> {
  const { error } = await supabase.from('vocab_sets').delete().eq('id', setId);
  if (error) throw error;
}

export async function submitSet(setId: string): Promise<void> {
  const { error } = await supabase.rpc('submit_vocab_set', { p_set_id: setId });
  if (error) throw error;
}

export async function withdrawSet(setId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_vocab_set', { p_set_id: setId });
  if (error) throw error;
}

export async function approveSet(setId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_vocab_set', { p_set_id: setId });
  if (error) throw error;
}

export async function rejectSet(setId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('reject_vocab_set', {
    p_set_id: setId,
    p_reason: reason,
  });
  if (error) throw error;
}

export interface PendingSetRow {
  id: string;
  title: string;
  audience: string;
  description: string;
  author_name: string;
  author_email: string;
  card_count: number;
  created_at: string;
}

export async function listPendingSets(): Promise<PendingSetRow[]> {
  const { data, error } = await supabase.rpc('admin_list_pending_vocab_sets');
  if (error) throw error;
  return (data as any[] | null) || [];
}

/** Convert DB cards to MemoryAid CardItem shape used by MatchGame/FlashCard */
export function toCardItems(cards: VocabCard[]) {
  return cards.map(c => ({
    id: c.id,
    word: c.word,
    definition: c.definition,
    example: c.example || undefined,
    wordImage: c.word_image || undefined,
    definitionImage: c.definition_image || undefined,
  }));
}
