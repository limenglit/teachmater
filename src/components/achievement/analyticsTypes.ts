export interface ScoringRule {
  enabled: boolean;
  points_per?: number;
  points_per_like?: number;
  weight: number;
}

export interface ScoringRules {
  board_participate: ScoringRule;
  board_quality: ScoringRule;
  task_complete: ScoringRule;
  barrage_participate: ScoringRule;
  quiz_participate: ScoringRule;
  checkin: ScoringRule;
}

export const DEFAULT_RULES: ScoringRules = {
  board_participate: { enabled: true, points_per: 2, weight: 20 },
  board_quality: { enabled: true, points_per_like: 1, weight: 10 },
  task_complete: { enabled: true, points_per: 3, weight: 25 },
  barrage_participate: { enabled: true, points_per: 1, weight: 15 },
  quiz_participate: { enabled: true, points_per: 2, weight: 15 },
  checkin: { enabled: true, points_per: 1, weight: 15 },
};

export type DimensionKey = keyof ScoringRules;

export const DIMENSION_KEYS: DimensionKey[] = [
  'board_participate', 'board_quality', 'task_complete',
  'barrage_participate', 'quiz_participate', 'checkin',
];

export interface StudentDimensionData {
  name: string;
  board_participate: number;
  board_quality: number;
  task_complete: number;
  barrage_participate: number;
  quiz_participate: number;
  checkin: number;
  totalScore: number;
}
