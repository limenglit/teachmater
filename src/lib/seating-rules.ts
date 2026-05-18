/**
 * Pure seating rule algorithms and validators for regression testing.
 *
 * Each rule exposes:
 *   - arrange(students, layout): produces a (Student|null)[][] grid
 *   - validate(grid): returns { pass, issues[] } with human-readable reasons
 *
 * Designed for offline/test use — no React, no localStorage.
 */

import type { Student, StudentGender } from '@/hooks/useStudentStore';

export interface GridLayout {
  rows: number;
  cols: number;
}

export type SeatGrid = (Student | null)[][];

export interface RuleResult {
  pass: boolean;
  issues: string[];
  stats?: Record<string, number | string>;
}

export interface RuleReport extends RuleResult {
  ruleId: string;
  ruleLabel: string;
  grid: SeatGrid;
}

/* -------------------- helpers -------------------- */

const emptyGrid = (rows: number, cols: number): SeatGrid =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

const flatPlaced = (grid: SeatGrid): { s: Student; r: number; c: number }[] => {
  const out: { s: Student; r: number; c: number }[] = [];
  grid.forEach((row, r) => row.forEach((s, c) => { if (s) out.push({ s, r, c }); }));
  return out;
};

const fitLayout = (n: number, preferred?: GridLayout): GridLayout => {
  if (preferred && preferred.rows * preferred.cols >= n) return preferred;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.6)));
  const rows = Math.max(1, Math.ceil(n / cols));
  return { rows, cols };
};

const groupBy = <T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> => {
  const out = {} as Record<K, T[]>;
  for (const item of arr) {
    const k = key(item);
    (out[k] ||= []).push(item);
  }
  return out;
};

/* -------------------- Rule 1: Smart classroom cluster -------------------- */

export function arrangeSmartCluster(
  students: Student[],
  preferred?: GridLayout,
  groupCount = 4,
): SeatGrid {
  const layout = fitLayout(students.length, preferred);
  const grid = emptyGrid(layout.rows, layout.cols);
  const groups: Student[][] = Array.from({ length: groupCount }, () => []);
  students.forEach((s, i) => groups[i % groupCount].push(s));
  const blocksPerRow = Math.ceil(Math.sqrt(groupCount));
  const blockRows = Math.ceil(groupCount / blocksPerRow);
  const blockH = Math.max(1, Math.floor(layout.rows / blockRows));
  const blockW = Math.max(1, Math.floor(layout.cols / blocksPerRow));
  groups.forEach((group, gi) => {
    const bRow = Math.floor(gi / blocksPerRow);
    const bCol = gi % blocksPerRow;
    const startR = bRow * blockH;
    const startC = bCol * blockW;
    let placed = 0;
    for (let mi = 0; placed < group.length; mi++) {
      const lr = mi % blockH;
      const lc = Math.floor(mi / blockH);
      const r = startR + lr;
      const c = startC + lc;
      if (r >= layout.rows || c >= layout.cols) break;
      grid[r][c] = group[placed++];
    }
  });
  return grid;
}

export function validateSmartCluster(grid: SeatGrid, groupCount = 4): RuleResult {
  const placed = flatPlaced(grid);
  if (placed.length === 0) return { pass: false, issues: ['没有学生被安排座位'] };

  const blocksPerRow = Math.ceil(Math.sqrt(groupCount));
  const issues: string[] = [];
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const blockRows = Math.ceil(groupCount / blocksPerRow);
  const blockH = Math.max(1, Math.floor(rows / blockRows));
  const blockW = Math.max(1, Math.floor(cols / blocksPerRow));

  for (let gi = 0; gi < groupCount; gi++) {
    const bRow = Math.floor(gi / blocksPerRow);
    const bCol = gi % blocksPerRow;
    const startR = bRow * blockH;
    const startC = bCol * blockW;
    
    let filled = 0;
    for (let r = startR; r < startR + blockH; r++) {
      for (let c = startC; c < startC + blockW; c++) {
        if (grid[r]?.[c]) filled++;
      }
    }
    if (filled === 0) issues.push(`第 ${gi + 1} 组对应的座位块 (行 ${startR + 1}-${startR + blockH}, 列 ${startC + 1}-${startC + blockW}) 没有任何学生`);
  }
  return { pass: issues.length === 0, issues, stats: { 组数: groupCount, 已安排: placed.length } };
}

/* -------------------- Rule 2: Concert hall — alternating gender rows -------------------- */

export function arrangeGenderAlternateRows(
  students: Student[],
  preferred?: GridLayout,
): SeatGrid {
  const layout = fitLayout(students.length, preferred);
  const grid = emptyGrid(layout.rows, layout.cols);
  const males = students.filter(s => s.gender === 'male');
  const females = students.filter(s => s.gender === 'female');
  const others = students.filter(s => s.gender !== 'male' && s.gender !== 'female');
  const balanced = males.length >= females.length
    ? { primary: males, secondary: [...females, ...others] }
    : { primary: females, secondary: [...males, ...others] };

  let pIdx = 0, sIdx = 0;
  for (let r = 0; r < layout.rows; r++) {
    const useSecondary = r % 2 === 1;
    for (let c = 0; c < layout.cols; c++) {
      if (useSecondary && sIdx < balanced.secondary.length) grid[r][c] = balanced.secondary[sIdx++];
      else if (!useSecondary && pIdx < balanced.primary.length) grid[r][c] = balanced.primary[pIdx++];
    }
    for (let c = 0; c < layout.cols; c++) {
      if (grid[r][c]) continue;
      if (useSecondary && pIdx < balanced.primary.length) grid[r][c] = balanced.primary[pIdx++];
      else if (!useSecondary && sIdx < balanced.secondary.length) grid[r][c] = balanced.secondary[sIdx++];
    }
  }
  return grid;
}

export function validateGenderAlternateRows(grid: SeatGrid): RuleResult {
  const issues: string[] = [];
  let lastDominant: StudentGender | null = null;
  let alternations = 0;
  let rowsChecked = 0;
  grid.forEach((row, rIdx) => {
    const populated = row.filter(Boolean) as Student[];
    if (populated.length === 0) return;
    rowsChecked++;
    const counts: Record<string, number> = { male: 0, female: 0, unknown: 0 };
    populated.forEach(s => { counts[s.gender ?? 'unknown']++; });
    const dominant: StudentGender = counts.male >= counts.female ? 'male' : 'female';
    const purity = counts[dominant] / populated.length;
    if (purity < 0.8) {
      issues.push(`第 ${rIdx + 1} 行性别不纯：男 ${counts.male} / 女 ${counts.female} / 未知 ${counts.unknown}`);
    }
    if (lastDominant && lastDominant !== dominant) alternations++;
    if (lastDominant && lastDominant === dominant && purity >= 0.8) {
      issues.push(`第 ${rIdx + 1} 行与上一行性别相同（均为 ${dominant === 'male' ? '男' : '女'}），未达成交错`);
    }
    lastDominant = dominant;
  });
  return {
    pass: issues.length === 0,
    issues,
    stats: { 行数: rowsChecked, 性别交替次数: alternations },
  };
}

/* -------------------- Rule 3: Banquet hall — cluster by unit (org) -------------------- */

export function arrangeUnitCluster(
  students: Student[],
  preferred?: GridLayout,
): SeatGrid {
  const layout = fitLayout(students.length, preferred);
  const grid = emptyGrid(layout.rows, layout.cols);
  const byOrg = groupBy(students, s => (s.organization || '未指定') as string);
  const orgs = Object.keys(byOrg).sort((a, b) => byOrg[b].length - byOrg[a].length);
  let r = 0, c = 0;
  for (const org of orgs) {
    for (const s of byOrg[org]) {
      if (r >= layout.rows) return grid;
      grid[r][c] = s;
      c++;
      if (c >= layout.cols) { c = 0; r++; }
    }
    if (c !== 0) { c = 0; r++; }
  }
  return grid;
}

export function validateUnitCluster(grid: SeatGrid): RuleResult {
  const issues: string[] = [];
  const seen: Record<string, { rows: Set<number>; count: number }> = {};
  grid.forEach((row, rIdx) => row.forEach((s) => {
    if (!s) return;
    const org = s.organization || '未指定';
    seen[org] ||= { rows: new Set(), count: 0 };
    seen[org].rows.add(rIdx);
    seen[org].count++;
  }));

  Object.entries(seen).forEach(([org, info]) => {
    const rows = [...info.rows].sort((a, b) => a - b);
    if (rows.length === 0) return;
    const span = rows[rows.length - 1] - rows[0] + 1;
    const expectedSpan = Math.max(1, Math.ceil(info.count / (grid[0]?.length ?? 1)));
    if (span > expectedSpan + 1) {
      issues.push(`单位「${org}」分散在 ${rows.length} 行（跨度 ${span} 行，期望 ≤ ${expectedSpan + 1} 行）`);
    }
  });
  return { pass: issues.length === 0, issues, stats: { 单位数: Object.keys(seen).length } };
}

/* -------------------- Rule 4: Gender interleave within row (smart classroom) -------------------- */

export function arrangeGenderInterleave(
  students: Student[],
  preferred?: GridLayout,
): SeatGrid {
  const layout = fitLayout(students.length, preferred);
  const grid = emptyGrid(layout.rows, layout.cols);
  const males = students.filter(s => s.gender === 'male');
  const females = students.filter(s => s.gender === 'female');
  const others = students.filter(s => s.gender !== 'male' && s.gender !== 'female');
  let a = males, b = females;
  if (males.length < females.length) { a = females; b = males; }
  b = [...b, ...others];

  let aIdx = 0, bIdx = 0;
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const wantA = (r + c) % 2 === 0;
      if (wantA && aIdx < a.length) grid[r][c] = a[aIdx++];
      else if (!wantA && bIdx < b.length) grid[r][c] = b[bIdx++];
      else if (aIdx < a.length) grid[r][c] = a[aIdx++];
      else if (bIdx < b.length) grid[r][c] = b[bIdx++];
    }
  }
  return grid;
}

export function validateGenderInterleave(grid: SeatGrid): RuleResult {
  const issues: string[] = [];
  let adjacentSame = 0;
  let adjacentTotal = 0;
  grid.forEach((row, r) => row.forEach((s, c) => {
    if (!s || (s.gender !== 'male' && s.gender !== 'female')) return;
    const right = row[c + 1];
    if (right && (right.gender === 'male' || right.gender === 'female')) {
      adjacentTotal++;
      if (right.gender === s.gender) adjacentSame++;
    }
    const below = grid[r + 1]?.[c];
    if (below && (below.gender === 'male' || below.gender === 'female')) {
      adjacentTotal++;
      if (below.gender === s.gender) adjacentSame++;
    }
  }));
  const ratio = adjacentTotal === 0 ? 0 : adjacentSame / adjacentTotal;
  if (ratio > 0.3) {
    issues.push(`相邻同性别比例 ${(ratio * 100).toFixed(1)}%（>30% 视为未达成交错）`);
  }
  return {
    pass: issues.length === 0,
    issues,
    stats: { 相邻同性别: adjacentSame, 相邻总对: adjacentTotal, 同性别比例: `${(ratio * 100).toFixed(1)}%` },
  };
}

/* -------------------- Rule registry -------------------- */

export interface RuleDef {
  id: string;
  label: string;
  description: string;
  requires: Array<'gender' | 'organization'>;
  arrange: (students: Student[], layout?: GridLayout) => SeatGrid;
  validate: (grid: SeatGrid) => RuleResult;
}

export const SEATING_RULES: RuleDef[] = [
  {
    id: 'smartCluster',
    label: '智慧教室 · 智能集中分组',
    description: '将学生按轮询拆分为若干组，每组分配独立座位块（默认 4 组）',
    requires: [],
    arrange: (s, l) => arrangeSmartCluster(s, l, 4),
    validate: (g) => validateSmartCluster(g, 4),
  },
  {
    id: 'genderAlternateRows',
    label: '音乐厅 · 一行男一行女',
    description: '按行交替排列性别，奇数行男、偶数行女（或相反）',
    requires: ['gender'],
    arrange: arrangeGenderAlternateRows,
    validate: validateGenderAlternateRows,
  },
  {
    id: 'unitCluster',
    label: '宴会厅 · 按单位集中',
    description: '相同单位坐在邻近行，便于团队互动',
    requires: ['organization'],
    arrange: arrangeUnitCluster,
    validate: validateUnitCluster,
  },
  {
    id: 'genderInterleave',
    label: '智慧教室 · 男女交错',
    description: '在每行内男女交替坐，避免相邻同性别',
    requires: ['gender'],
    arrange: arrangeGenderInterleave,
    validate: validateGenderInterleave,
  },
];

export function runAllRules(students: Student[], layout?: GridLayout): RuleReport[] {
  return SEATING_RULES.map(rule => {
    const grid = rule.arrange(students, layout);
    const result = rule.validate(grid);
    const missingField = rule.requires.find(field => !students.some(s => {
      if (field === 'gender') return s.gender === 'male' || s.gender === 'female';
      if (field === 'organization') return !!s.organization;
      return false;
    }));
    if (missingField) {
      return {
        ruleId: rule.id,
        ruleLabel: rule.label,
        grid,
        pass: false,
        issues: [`数据缺少必填字段「${missingField === 'gender' ? '性别' : '单位'}」，规则无法生效`],
        stats: result.stats,
      };
    }
    return { ruleId: rule.id, ruleLabel: rule.label, grid, ...result };
  });
}
