/**
 * When a teacher signs in, move content created on this device while signed
 * out into their account, so it shows up on every phone and browser:
 *  - whiteboards / quiz sessions owned only by a local creator_token get bound
 *    to the account (server checks token possession);
 *  - local-only question bank, categories and papers are uploaded and the
 *    local copies cleared.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  getLocalQuestions, saveLocalQuestions, getLocalCategories, saveLocalCategories,
  getLocalPapers, saveLocalPapers, getSessionTokens,
} from '@/components/quiz/quizTypes';

const BOARD_TOKENS_KEY = 'board-creator-tokens';
const inflight = new Map<string, Promise<void>>();

function readTokens(key: string): string[] {
  try { return Object.values(JSON.parse(localStorage.getItem(key) || '{}')).filter((v): v is string => typeof v === 'string' && v.length >= 16); }
  catch { return []; }
}

async function uploadLocalQuiz(userId: string) {
  const cats = getLocalCategories();
  const catMap = new Map<string, string>();
  // insert parents before children
  const pending = [...cats];
  let guard = 0;
  while (pending.length && guard++ < 20) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const c = pending[i];
      if (c.parent_id && !catMap.has(c.parent_id) && cats.some(x => x.id === c.parent_id)) continue;
      const { data, error } = await supabase.from('quiz_categories').insert({
        user_id: userId, name: c.name, sort_order: c.sort_order ?? 0,
        parent_id: c.parent_id ? catMap.get(c.parent_id) ?? null : null,
      } as any).select('id').single();
      if (error) throw error;
      catMap.set(c.id, (data as any).id);
      pending.splice(i, 1);
    }
  }
  if (cats.length) saveLocalCategories([]);

  const qs = getLocalQuestions();
  if (qs.length) {
    const rows = qs.map(q => ({
      user_id: userId, type: q.type, content: q.content, options: q.options,
      correct_answer: q.correct_answer, tags: q.tags || '',
      category_id: q.category_id ? catMap.get(q.category_id) ?? null : null,
      is_starred: !!q.is_starred,
    }));
    const { error } = await supabase.from('quiz_questions').insert(rows as any);
    if (error) throw error;
    saveLocalQuestions([]);
  }

  const papers = getLocalPapers();
  if (papers.length) {
    const rows = papers.map(p => ({
      user_id: userId, title: p.title, description: p.description || '',
      questions: p.questions as any, template: p.template as any,
      total_score: p.total_score || 0, is_template: !!p.is_template,
    }));
    const { error } = await supabase.from('quiz_papers').insert(rows as any);
    if (error) throw error;
    saveLocalPapers([]);
  }
}

export function syncGuestContent(userId: string): Promise<void> {
  const existing = inflight.get(userId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const boardTokens = readTokens(BOARD_TOKENS_KEY);
      const quizTokens = Object.values(getSessionTokens()).filter(t => t && t.length >= 16);
      if (boardTokens.length || quizTokens.length) {
        await (supabase as any).rpc('claim_guest_content', { p_board_tokens: boardTokens, p_quiz_tokens: quizTokens });
      }
      await uploadLocalQuiz(userId);
    } catch (e) {
      console.warn('[guest-content-sync] failed', e);
    }
  })();
  inflight.set(userId, p);
  return p;
}
