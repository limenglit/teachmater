/**
 * 通用「请假池」逻辑（教室场景之外的座位场景复用）。
 *
 * 交互约定与教室场景保持一致：
 * - 双击座位上的姓名 → 移入请假池，座位空出；
 * - 双击请假池条目（或拖回座位）→ 恢复原位，原位被占用时安排到最近的空位。
 */

export interface LeavePoolEntry {
  /** 学生姓名 */
  name: string;
  /** 原座位第一维索引（桌号 / 排号） */
  i: number;
  /** 原座位第二维索引（座位号） */
  j: number;
  /** 展示用原座位描述，例如「3桌2号」 */
  label: string;
}

/** 二维姓名网格：清空 [i][j]。 */
export function clearGridSeat(grid: string[][], i: number, j: number): string[][] {
  return grid.map((row, ri) => (ri === i ? row.map((cell, ci) => (ci === j ? '' : cell)) : row));
}

/** 在二维姓名网格中查找某个姓名所在的座位。 */
export function findInGrid(grid: string[][], name: string): { i: number; j: number } | null {
  const target = name.trim();
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i] || [];
    for (let j = 0; j < row.length; j++) {
      if ((row[j] || '').trim() === target) return { i, j };
    }
  }
  return null;
}

/**
 * 把姓名放回网格：优先原位，原位被占用/关闭则取第一个可用空位。
 * 返回 null 表示没有可用空位。
 */
export function restoreIntoGrid(
  grid: string[][],
  entry: LeavePoolEntry,
  isClosed: (i: number, j: number) => boolean,
): { grid: string[][]; i: number; j: number } | null {
  const isFree = (i: number, j: number) =>
    Array.isArray(grid[i]) && j < grid[i].length && !(grid[i][j] || '').trim() && !isClosed(i, j);

  let target: { i: number; j: number } | null = null;
  if (isFree(entry.i, entry.j)) {
    target = { i: entry.i, j: entry.j };
  } else {
    outer: for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < (grid[i]?.length || 0); j++) {
        if (isFree(i, j)) { target = { i, j }; break outer; }
      }
    }
  }
  if (!target) return null;
  const next = grid.map((row, ri) => (ri === target!.i ? row.map((cell, ci) => (ci === target!.j ? entry.name : cell)) : row));
  return { grid: next, i: target.i, j: target.j };
}
