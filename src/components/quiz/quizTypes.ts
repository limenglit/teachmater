// Shared types and utilities for the quiz module
export interface QuizQuestion {
  id: string;
  user_id: string;
  type: 'single' | 'multi' | 'tf' | 'short';
  content: string;
  options: string[];
  correct_answer: string | string[];
  tags: string;
  category_id?: string | null;
  is_starred?: boolean;
  created_at: string;
}

export interface QuizCategory {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface QuizPaper {
  id: string;
  user_id: string;
  title: string;
  description: string;
  questions: PaperQuestion[];
  template: PaperTemplate | null;
  total_score: number;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaperQuestion {
  question_id: string;
  question: QuizQuestion;
  score: number;
  order: number;
}

export interface PaperTemplate {
  rules: TemplateRule[];
}

export interface TemplateRule {
  type: QuizQuestion['type'];
  count: number;
  score_each: number;
  tags?: string;
}

export interface QuizSession {
  id: string;
  user_id: string | null;
  creator_token: string;
  title: string;
  questions: QuizQuestion[];
  status: string;
  student_names: string[];
  created_at: string;
  ended_at: string | null;
}

export type QuestionType = 'single' | 'multi' | 'tf' | 'short';

// Local storage keys
export const SESSION_TOKENS_KEY = 'quiz-session-tokens';
export const LOCAL_QUESTIONS_KEY = 'quiz-local-questions';
export const LOCAL_PAPERS_KEY = 'quiz-local-papers';
export const LOCAL_CATEGORIES_KEY = 'quiz-local-categories';

export function getSessionTokens(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SESSION_TOKENS_KEY) || '{}'); } catch { return {}; }
}
export function saveSessionToken(sessionId: string, token: string) {
  const tokens = getSessionTokens();
  tokens[sessionId] = token;
  localStorage.setItem(SESSION_TOKENS_KEY, JSON.stringify(tokens));
}
export function getSessionToken(sessionId: string): string | null {
  return getSessionTokens()[sessionId] || null;
}

export function getLocalQuestions(): QuizQuestion[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_QUESTIONS_KEY) || '[]'); } catch { return []; }
}
export function saveLocalQuestions(questions: QuizQuestion[]) {
  localStorage.setItem(LOCAL_QUESTIONS_KEY, JSON.stringify(questions));
}

export function getLocalPapers(): QuizPaper[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_PAPERS_KEY) || '[]'); } catch { return []; }
}
export function saveLocalPapers(papers: QuizPaper[]) {
  localStorage.setItem(LOCAL_PAPERS_KEY, JSON.stringify(papers));
}

export function getLocalCategories(): QuizCategory[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_CATEGORIES_KEY) || '[]'); } catch { return []; }
}
export function saveLocalCategories(cats: QuizCategory[]) {
  localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(cats));
}
