// Pure utility functions for the quiz module
import type { QuizQuestion, QuizPaper, PaperQuestion, TemplateRule } from '@/components/quiz/quizTypes';

// ── Question filtering ──────────────────────────────────

export interface QuestionFilter {
  type?: string;       // 'all' | QuestionType
  categoryId?: string; // 'all' | category id
  starred?: boolean;
  search?: string;
}

export function filterQuestions(questions: QuizQuestion[], filter: QuestionFilter): QuizQuestion[] {
  return questions.filter(q => {
    if (filter.type && filter.type !== 'all' && q.type !== filter.type) return false;
    if (filter.categoryId && filter.categoryId !== 'all' && (q.category_id || '') !== filter.categoryId) return false;
    if (filter.starred && !q.is_starred) return false;
    if (filter.search?.trim()) {
      const s = filter.search.trim().toLowerCase();
      if (!q.content.toLowerCase().includes(s) && !q.tags.toLowerCase().includes(s)) return false;
    }
    return true;
  });
}

// ── Question CRUD helpers (guest/local mode) ────────────

export function addLocalQuestion(
  questions: QuizQuestion[],
  data: Omit<QuizQuestion, 'id' | 'user_id' | 'created_at'>
): QuizQuestion[] {
  const newQ: QuizQuestion = {
    id: crypto.randomUUID(),
    user_id: 'local',
    created_at: new Date().toISOString(),
    ...data,
  };
  return [newQ, ...questions];
}

export function updateLocalQuestion(
  questions: QuizQuestion[],
  id: string,
  data: Partial<QuizQuestion>
): QuizQuestion[] {
  return questions.map(q => q.id === id ? { ...q, ...data } : q);
}

export function deleteLocalQuestion(questions: QuizQuestion[], id: string): QuizQuestion[] {
  return questions.filter(q => q.id !== id);
}

export function toggleStarQuestion(questions: QuizQuestion[], id: string): QuizQuestion[] {
  return questions.map(q => q.id === id ? { ...q, is_starred: !q.is_starred } : q);
}

// ── Paper question assembly ─────────────────────────────

export function addQuestionToPaper(paperQs: PaperQuestion[], q: QuizQuestion): PaperQuestion[] {
  const defaultScore = q.type === 'short' ? 10 : q.type === 'multi' ? 4 : q.type === 'tf' ? 2 : 3;
  return [...paperQs, {
    question_id: q.id,
    question: q,
    score: defaultScore,
    order: paperQs.length,
  }];
}

export function removeFromPaper(paperQs: PaperQuestion[], idx: number): PaperQuestion[] {
  return paperQs.filter((_, i) => i !== idx).map((pq, i) => ({ ...pq, order: i }));
}

export function movePaperQuestion(paperQs: PaperQuestion[], idx: number, dir: -1 | 1): PaperQuestion[] {
  const target = idx + dir;
  if (target < 0 || target >= paperQs.length) return paperQs;
  const arr = [...paperQs];
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  return arr.map((pq, i) => ({ ...pq, order: i }));
}

export function updatePaperQuestionScore(paperQs: PaperQuestion[], idx: number, score: number): PaperQuestion[] {
  return paperQs.map((pq, i) => i === idx ? { ...pq, score } : pq);
}

export function computePaperTotalScore(paperQs: PaperQuestion[]): number {
  return paperQs.reduce((s, pq) => s + pq.score, 0);
}

// ── Auto-generate paper ─────────────────────────────────

export interface AutoGenerateResult {
  questions: PaperQuestion[];
  warnings: string[];  // e.g. "single: 3/10 available"
}

export function autoGeneratePaper(
  allQuestions: QuizQuestion[],
  rules: TemplateRule[],
  tagFilter?: string,
): AutoGenerateResult {
  const result: PaperQuestion[] = [];
  const warnings: string[] = [];
  let order = 0;

  for (const rule of rules) {
    let pool = allQuestions.filter(q => q.type === rule.type);
    if (tagFilter?.trim()) {
      const tags = tagFilter.split(/[,，、]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      pool = pool.filter(q => tags.some(tag => q.tags.toLowerCase().includes(tag)));
    }
    // Shuffle
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, rule.count);
    if (picked.length < rule.count) {
      warnings.push(`${rule.type}: ${picked.length}/${rule.count}`);
    }
    for (const q of picked) {
      result.push({ question_id: q.id, question: q, score: rule.score_each, order: order++ });
    }
  }

  return { questions: result, warnings };
}

export function computeAutoTotalScore(rules: TemplateRule[]): number {
  return rules.reduce((s, r) => s + r.count * r.score_each, 0);
}

// ── Paper CRUD helpers (guest/local mode) ────────────────

export function deleteLocalPaper(papers: QuizPaper[], id: string): QuizPaper[] {
  return papers.filter(p => p.id !== id);
}

export function duplicateLocalPaper(papers: QuizPaper[], paper: QuizPaper): QuizPaper[] {
  const newPaper: QuizPaper = {
    ...paper,
    id: crypto.randomUUID(),
    title: paper.title + ' (copy)',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return [newPaper, ...papers];
}
