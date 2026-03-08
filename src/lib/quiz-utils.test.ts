import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  filterQuestions,
  addLocalQuestion,
  updateLocalQuestion,
  deleteLocalQuestion,
  toggleStarQuestion,
  addQuestionToPaper,
  removeFromPaper,
  movePaperQuestion,
  updatePaperQuestionScore,
  computePaperTotalScore,
  autoGeneratePaper,
  computeAutoTotalScore,
  deleteLocalPaper,
  duplicateLocalPaper,
} from './quiz-utils';
import type { QuizQuestion, QuizPaper, PaperQuestion, TemplateRule } from '@/components/quiz/quizTypes';

// ── Fixtures ─────────────────────────────────────────────

const mkQ = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: crypto.randomUUID(),
  user_id: 'local',
  type: 'single',
  content: '测试题目',
  options: ['A选项', 'B选项', 'C选项', 'D选项'],
  correct_answer: 'A',
  tags: '数学',
  category_id: null,
  is_starred: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const sampleQuestions: QuizQuestion[] = [
  mkQ({ id: 'q1', type: 'single', content: '单选题1', tags: '数学', category_id: 'cat1', is_starred: true }),
  mkQ({ id: 'q2', type: 'multi', content: '多选题1', tags: '语文', category_id: 'cat2' }),
  mkQ({ id: 'q3', type: 'tf', content: '判断题1', tags: '数学,物理' }),
  mkQ({ id: 'q4', type: 'short', content: '简答题1', tags: '英语' }),
  mkQ({ id: 'q5', type: 'single', content: '单选题2', tags: '数学', category_id: 'cat1' }),
];

const mkPaperQ = (q: QuizQuestion, score: number, order: number): PaperQuestion => ({
  question_id: q.id, question: q, score, order,
});

// ── filterQuestions ──────────────────────────────────────

describe('filterQuestions', () => {
  it('returns all when no filter applied', () => {
    expect(filterQuestions(sampleQuestions, {})).toHaveLength(5);
  });

  it('filters by type', () => {
    const result = filterQuestions(sampleQuestions, { type: 'single' });
    expect(result).toHaveLength(2);
    expect(result.every(q => q.type === 'single')).toBe(true);
  });

  it('type=all returns all', () => {
    expect(filterQuestions(sampleQuestions, { type: 'all' })).toHaveLength(5);
  });

  it('filters by categoryId', () => {
    const result = filterQuestions(sampleQuestions, { categoryId: 'cat1' });
    expect(result).toHaveLength(2);
  });

  it('categoryId=all returns all', () => {
    expect(filterQuestions(sampleQuestions, { categoryId: 'all' })).toHaveLength(5);
  });

  it('filters starred only', () => {
    const result = filterQuestions(sampleQuestions, { starred: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q1');
  });

  it('filters by search in content', () => {
    const result = filterQuestions(sampleQuestions, { search: '判断' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q3');
  });

  it('filters by search in tags', () => {
    const result = filterQuestions(sampleQuestions, { search: '英语' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q4');
  });

  it('search is case insensitive', () => {
    const qs = [mkQ({ content: 'Hello World', tags: '' })];
    expect(filterQuestions(qs, { search: 'hello' })).toHaveLength(1);
  });

  it('combines multiple filters', () => {
    const result = filterQuestions(sampleQuestions, { type: 'single', categoryId: 'cat1', starred: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q1');
  });

  it('empty search string ignored', () => {
    expect(filterQuestions(sampleQuestions, { search: '  ' })).toHaveLength(5);
  });

  it('no match returns empty', () => {
    expect(filterQuestions(sampleQuestions, { search: 'xyz不存在' })).toHaveLength(0);
  });
});

// ── Question CRUD ────────────────────────────────────────

describe('addLocalQuestion', () => {
  it('prepends a new question', () => {
    const result = addLocalQuestion(sampleQuestions, {
      type: 'single', content: '新题', options: ['A', 'B'],
      correct_answer: 'A', tags: 'test', category_id: null, is_starred: false,
    });
    expect(result).toHaveLength(6);
    expect(result[0].content).toBe('新题');
    expect(result[0].user_id).toBe('local');
  });
});

describe('updateLocalQuestion', () => {
  it('updates matching question', () => {
    const result = updateLocalQuestion(sampleQuestions, 'q1', { content: '修改后' });
    expect(result.find(q => q.id === 'q1')?.content).toBe('修改后');
  });

  it('leaves others untouched', () => {
    const result = updateLocalQuestion(sampleQuestions, 'q1', { content: '修改后' });
    expect(result.find(q => q.id === 'q2')?.content).toBe('多选题1');
  });
});

describe('deleteLocalQuestion', () => {
  it('removes the question', () => {
    const result = deleteLocalQuestion(sampleQuestions, 'q1');
    expect(result).toHaveLength(4);
    expect(result.find(q => q.id === 'q1')).toBeUndefined();
  });

  it('no-op for unknown id', () => {
    expect(deleteLocalQuestion(sampleQuestions, 'unknown')).toHaveLength(5);
  });
});

describe('toggleStarQuestion', () => {
  it('toggles starred to true', () => {
    const result = toggleStarQuestion(sampleQuestions, 'q2');
    expect(result.find(q => q.id === 'q2')?.is_starred).toBe(true);
  });

  it('toggles starred to false', () => {
    const result = toggleStarQuestion(sampleQuestions, 'q1');
    expect(result.find(q => q.id === 'q1')?.is_starred).toBe(false);
  });
});

// ── Paper assembly ───────────────────────────────────────

describe('addQuestionToPaper', () => {
  it('adds question with default score based on type', () => {
    const q = mkQ({ type: 'single' });
    const result = addQuestionToPaper([], q);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(3); // single default
    expect(result[0].order).toBe(0);
  });

  it('short type gets score 10', () => {
    const q = mkQ({ type: 'short' });
    const result = addQuestionToPaper([], q);
    expect(result[0].score).toBe(10);
  });

  it('multi type gets score 4', () => {
    const q = mkQ({ type: 'multi' });
    const result = addQuestionToPaper([], q);
    expect(result[0].score).toBe(4);
  });

  it('tf type gets score 2', () => {
    const q = mkQ({ type: 'tf' });
    const result = addQuestionToPaper([], q);
    expect(result[0].score).toBe(2);
  });

  it('appends and increments order', () => {
    const q1 = mkQ({ id: 'a' });
    const q2 = mkQ({ id: 'b' });
    let paper = addQuestionToPaper([], q1);
    paper = addQuestionToPaper(paper, q2);
    expect(paper).toHaveLength(2);
    expect(paper[1].order).toBe(1);
  });
});

describe('removeFromPaper', () => {
  const paperQs = sampleQuestions.slice(0, 3).map((q, i) => mkPaperQ(q, 5, i));

  it('removes question at index', () => {
    const result = removeFromPaper(paperQs, 1);
    expect(result).toHaveLength(2);
    expect(result.find(pq => pq.question_id === 'q2')).toBeUndefined();
  });

  it('reorders after removal', () => {
    const result = removeFromPaper(paperQs, 0);
    expect(result[0].order).toBe(0);
    expect(result[1].order).toBe(1);
  });
});

describe('movePaperQuestion', () => {
  const paperQs = sampleQuestions.slice(0, 3).map((q, i) => mkPaperQ(q, 5, i));

  it('moves question up', () => {
    const result = movePaperQuestion(paperQs, 1, -1);
    expect(result[0].question_id).toBe('q2');
    expect(result[1].question_id).toBe('q1');
  });

  it('moves question down', () => {
    const result = movePaperQuestion(paperQs, 0, 1);
    expect(result[0].question_id).toBe('q2');
    expect(result[1].question_id).toBe('q1');
  });

  it('no-op when moving first item up', () => {
    const result = movePaperQuestion(paperQs, 0, -1);
    expect(result[0].question_id).toBe('q1');
  });

  it('no-op when moving last item down', () => {
    const result = movePaperQuestion(paperQs, 2, 1);
    expect(result[2].question_id).toBe('q3');
  });

  it('updates order values', () => {
    const result = movePaperQuestion(paperQs, 2, -1);
    expect(result.map(pq => pq.order)).toEqual([0, 1, 2]);
  });
});

describe('updatePaperQuestionScore', () => {
  const paperQs = sampleQuestions.slice(0, 2).map((q, i) => mkPaperQ(q, 5, i));

  it('updates score at index', () => {
    const result = updatePaperQuestionScore(paperQs, 0, 10);
    expect(result[0].score).toBe(10);
    expect(result[1].score).toBe(5); // unchanged
  });
});

describe('computePaperTotalScore', () => {
  it('sums all scores', () => {
    const paperQs = [mkPaperQ(mkQ(), 3, 0), mkPaperQ(mkQ(), 5, 1), mkPaperQ(mkQ(), 10, 2)];
    expect(computePaperTotalScore(paperQs)).toBe(18);
  });

  it('returns 0 for empty paper', () => {
    expect(computePaperTotalScore([])).toBe(0);
  });
});

// ── Auto-generate paper ──────────────────────────────────

describe('autoGeneratePaper', () => {
  const pool = sampleQuestions;

  it('picks correct number by type', () => {
    const rules: TemplateRule[] = [{ type: 'single', count: 2, score_each: 3 }];
    const { questions } = autoGeneratePaper(pool, rules);
    expect(questions).toHaveLength(2);
    expect(questions.every(pq => pq.question.type === 'single')).toBe(true);
  });

  it('assigns correct score_each', () => {
    const rules: TemplateRule[] = [{ type: 'tf', count: 1, score_each: 5 }];
    const { questions } = autoGeneratePaper(pool, rules);
    expect(questions[0].score).toBe(5);
  });

  it('warns when insufficient questions', () => {
    const rules: TemplateRule[] = [{ type: 'short', count: 10, score_each: 5 }];
    const { questions, warnings } = autoGeneratePaper(pool, rules);
    expect(questions.length).toBeLessThan(10);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('short');
  });

  it('filters by tags', () => {
    const rules: TemplateRule[] = [{ type: 'single', count: 10, score_each: 3 }];
    const { questions } = autoGeneratePaper(pool, rules, '数学');
    // Only q1 and q5 are single+数学
    expect(questions).toHaveLength(2);
  });

  it('handles multiple tag filters (comma separated)', () => {
    const rules: TemplateRule[] = [
      { type: 'single', count: 10, score_each: 3 },
      { type: 'tf', count: 10, score_each: 2 },
    ];
    const { questions } = autoGeneratePaper(pool, rules, '物理');
    // Only q3 (tf) has 物理 tag
    expect(questions).toHaveLength(1);
    expect(questions[0].question.type).toBe('tf');
  });

  it('handles multiple rules', () => {
    const rules: TemplateRule[] = [
      { type: 'single', count: 1, score_each: 3 },
      { type: 'tf', count: 1, score_each: 2 },
    ];
    const { questions } = autoGeneratePaper(pool, rules);
    expect(questions).toHaveLength(2);
    expect(questions[0].order).toBe(0);
    expect(questions[1].order).toBe(1);
  });

  it('returns empty for zero-count rules', () => {
    const rules: TemplateRule[] = [{ type: 'single', count: 0, score_each: 3 }];
    const { questions, warnings } = autoGeneratePaper(pool, rules);
    expect(questions).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('empty tag filter ignored', () => {
    const rules: TemplateRule[] = [{ type: 'single', count: 2, score_each: 3 }];
    const { questions } = autoGeneratePaper(pool, rules, '  ');
    expect(questions).toHaveLength(2);
  });
});

describe('computeAutoTotalScore', () => {
  it('calculates total from rules', () => {
    const rules: TemplateRule[] = [
      { type: 'single', count: 10, score_each: 3 },
      { type: 'multi', count: 5, score_each: 4 },
    ];
    expect(computeAutoTotalScore(rules)).toBe(50);
  });

  it('returns 0 for empty rules', () => {
    expect(computeAutoTotalScore([])).toBe(0);
  });
});

// ── Paper CRUD ───────────────────────────────────────────

describe('deleteLocalPaper', () => {
  const papers: QuizPaper[] = [
    { id: 'p1', user_id: 'local', title: 'Paper 1', description: '', questions: [], template: null, total_score: 100, is_template: false, created_at: '', updated_at: '' },
    { id: 'p2', user_id: 'local', title: 'Paper 2', description: '', questions: [], template: null, total_score: 50, is_template: false, created_at: '', updated_at: '' },
  ];

  it('removes paper by id', () => {
    expect(deleteLocalPaper(papers, 'p1')).toHaveLength(1);
  });

  it('no-op for unknown id', () => {
    expect(deleteLocalPaper(papers, 'unknown')).toHaveLength(2);
  });
});

describe('duplicateLocalPaper', () => {
  const paper: QuizPaper = {
    id: 'p1', user_id: 'local', title: 'Original', description: 'desc',
    questions: [], template: null, total_score: 100, is_template: false,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  };

  it('creates a copy with new id and title suffix', () => {
    const result = duplicateLocalPaper([], paper);
    expect(result).toHaveLength(1);
    expect(result[0].id).not.toBe('p1');
    expect(result[0].title).toBe('Original (copy)');
  });

  it('preserves original paper data', () => {
    const result = duplicateLocalPaper([], paper);
    expect(result[0].description).toBe('desc');
    expect(result[0].total_score).toBe(100);
  });

  it('prepends to existing papers', () => {
    const existing: QuizPaper[] = [{ ...paper, id: 'p2', title: 'Existing' }];
    const result = duplicateLocalPaper(existing, paper);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Original (copy)');
  });
});
