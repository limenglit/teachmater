import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSessionTokens, saveSessionToken, getSessionToken,
  getLocalQuestions, saveLocalQuestions,
  getLocalPapers, saveLocalPapers,
  getLocalCategories, saveLocalCategories,
  SESSION_TOKENS_KEY, LOCAL_QUESTIONS_KEY, LOCAL_PAPERS_KEY, LOCAL_CATEGORIES_KEY,
} from './quizTypes';
import type { QuizQuestion, QuizPaper, QuizCategory } from './quizTypes';

beforeEach(() => localStorage.clear());

describe('Session token helpers', () => {
  it('returns empty object when nothing stored', () => {
    expect(getSessionTokens()).toEqual({});
  });

  it('saves and retrieves a token', () => {
    saveSessionToken('s1', 'tok1');
    expect(getSessionToken('s1')).toBe('tok1');
  });

  it('returns null for unknown session id', () => {
    expect(getSessionToken('unknown')).toBeNull();
  });

  it('stores multiple tokens', () => {
    saveSessionToken('s1', 'tok1');
    saveSessionToken('s2', 'tok2');
    expect(getSessionTokens()).toEqual({ s1: 'tok1', s2: 'tok2' });
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem(SESSION_TOKENS_KEY, '{bad json');
    expect(getSessionTokens()).toEqual({});
  });
});

describe('Local questions helpers', () => {
  it('returns empty array by default', () => {
    expect(getLocalQuestions()).toEqual([]);
  });

  it('saves and retrieves questions', () => {
    const qs: QuizQuestion[] = [{
      id: 'q1', user_id: 'local', type: 'single', content: 'Test?',
      options: ['A', 'B'], correct_answer: 'A', tags: 'test',
      category_id: null, is_starred: false, created_at: '2026-01-01',
    }];
    saveLocalQuestions(qs);
    expect(getLocalQuestions()).toEqual(qs);
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem(LOCAL_QUESTIONS_KEY, 'not json');
    expect(getLocalQuestions()).toEqual([]);
  });
});

describe('Local papers helpers', () => {
  it('returns empty array by default', () => {
    expect(getLocalPapers()).toEqual([]);
  });

  it('saves and retrieves papers', () => {
    const p: QuizPaper[] = [{
      id: 'p1', user_id: 'local', title: 'Paper 1', description: '',
      questions: [], template: null, total_score: 100,
      is_template: false, created_at: '2026-01-01', updated_at: '2026-01-01',
    }];
    saveLocalPapers(p);
    expect(getLocalPapers()).toEqual(p);
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem(LOCAL_PAPERS_KEY, 'corrupt');
    expect(getLocalPapers()).toEqual([]);
  });
});

describe('Local categories helpers', () => {
  it('returns empty array by default', () => {
    expect(getLocalCategories()).toEqual([]);
  });

  it('saves and retrieves categories', () => {
    const cats: QuizCategory[] = [{
      id: 'c1', user_id: 'local', name: 'Math',
      parent_id: null, sort_order: 0, created_at: '2026-01-01',
    }];
    saveLocalCategories(cats);
    expect(getLocalCategories()).toEqual(cats);
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem(LOCAL_CATEGORIES_KEY, '}}');
    expect(getLocalCategories()).toEqual([]);
  });
});
