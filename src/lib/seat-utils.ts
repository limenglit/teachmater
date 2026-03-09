/**
 * Pure utility functions for the SeatChart module.
 * Extracted for testability.
 */

export type SeatMode = 'verticalS' | 'horizontalS' | 'groupCol' | 'groupRow' | 'smartCluster' | 'random' | 'exam';

/** Split names into `count` balanced groups round-robin */
export function splitIntoGroups(names: string[], count: number): string[][] {
  const groups: string[][] = Array.from({ length: count }, () => []);
  names.forEach((n, i) => groups[i % count].push(n));
  return groups;
}

/** Find next unused slot starting from `start`, wrapping around */
export function findNextFree(start: number, max: number, existing: number[]): number | null {
  for (let i = start; i < max; i++) { if (!existing.includes(i)) return i; }
  for (let i = 0; i < start; i++) { if (!existing.includes(i)) return i; }
  return null;
}

/** Map real row index to visual row index accounting for row aisles */
export function getVisualRow(realRow: number, rowAisles: number[]): number {
  let offset = 0;
  for (const a of rowAisles) { if (realRow > a) offset++; }
  return realRow + offset;
}

/** Generate column traversal order based on window/door positions and start preference */
export function getColOrder(cols: number, windowOnLeft: boolean, startFrom: 'door' | 'window'): number[] {
  const doorOnRight = windowOnLeft;
  const startFromRight = (startFrom === 'door' && doorOnRight) || (startFrom === 'window' && !doorOnRight);
  if (startFromRight) return Array.from({ length: cols }, (_, i) => cols - 1 - i);
  return Array.from({ length: cols }, (_, i) => i);
}

/** Create an empty grid */
export function makeGrid(rows: number, cols: number): (string | null)[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

export const seatKey = (r: number, c: number) => `${r}-${c}`;

/** Core auto-seat algorithm – pure function */
export function autoSeat(opts: {
  names: string[];
  rows: number;
  cols: number;
  mode: SeatMode;
  disabledSeats: Set<string>;
  colOrder: number[];
  groupCount?: number;
  examSkipRow?: boolean;
  examSkipCol?: boolean;
}): (string | null)[][] {
  const { names, rows, cols, mode, disabledSeats, colOrder, groupCount = 4, examSkipRow = true, examSkipCol = false } = opts;
  const grid = makeGrid(rows, cols);
  const isAvailable = (r: number, c: number) => !disabledSeats.has(seatKey(r, c));

  switch (mode) {
    case 'verticalS': {
      let idx = 0;
      for (let ci = 0; ci < cols && idx < names.length; ci++) {
        const c = colOrder[ci];
        for (let r = 0; r < rows && idx < names.length; r++) {
          const row = ci % 2 === 0 ? r : rows - 1 - r;
          if (isAvailable(row, c)) grid[row][c] = names[idx++];
        }
      }
      break;
    }
    case 'horizontalS': {
      let idx = 0;
      for (let r = 0; r < rows && idx < names.length; r++) {
        for (let ci = 0; ci < cols && idx < names.length; ci++) {
          const rawCol = r % 2 === 0 ? ci : cols - 1 - ci;
          const c = colOrder[rawCol];
          if (isAvailable(r, c)) grid[r][c] = names[idx++];
        }
      }
      break;
    }
    case 'exam': {
      let idx = 0;
      for (let ci = 0; ci < cols && idx < names.length; ci++) {
        const c = colOrder[ci];
        if (examSkipCol && ci % 2 !== 0) continue;
        for (let r = 0; r < rows && idx < names.length; r++) {
          const row = ci % 2 === 0 ? r : rows - 1 - r;
          if (examSkipRow && row % 2 !== 0) continue;
          if (isAvailable(row, c)) grid[row][c] = names[idx++];
        }
      }
      break;
    }
    case 'groupCol': {
      const groups = splitIntoGroups(names, groupCount);
      groups.forEach((group, gi) => {
        const colIdx = gi % cols;
        const c = colOrder[colIdx];
        let placed = 0;
        for (let r = 0; r < rows && placed < group.length; r++) {
          const row = r + Math.floor(gi / cols) * Math.ceil(names.length / groupCount);
          if (row < rows && isAvailable(row, c)) grid[row][c] = group[placed++];
        }
      });
      break;
    }
    case 'groupRow': {
      const groups = splitIntoGroups(names, groupCount);
      groups.forEach((group, gi) => {
        const row = gi % rows;
        let placed = 0;
        for (let ci = 0; ci < cols && placed < group.length; ci++) {
          const c = colOrder[ci];
          const colShift = ci + Math.floor(gi / rows) * Math.ceil(names.length / groupCount);
          if (row < rows && colShift < cols && isAvailable(row, c)) grid[row][c] = group[placed++];
        }
      });
      break;
    }
    case 'smartCluster': {
      const groups = splitIntoGroups(names, groupCount);
      const blocksPerRow = Math.ceil(Math.sqrt(groupCount));
      const blockRows = Math.ceil(groupCount / blocksPerRow);
      const blockH = Math.floor(rows / blockRows);
      const blockW = Math.floor(cols / blocksPerRow);
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
          if (r >= rows || c >= cols) break;
          if (isAvailable(r, c)) grid[r][c] = group[placed++];
        }
      });
      break;
    }
    case 'random': {
      const shuffled = [...names].sort(() => Math.random() - 0.5);
      let idx = 0;
      for (let r = 0; r < rows && idx < shuffled.length; r++) {
        for (let c = 0; c < cols && idx < shuffled.length; c++) {
          if (isAvailable(r, c)) grid[r][c] = shuffled[idx++];
        }
      }
      break;
    }
  }
  return grid;
}

/** Swap two seats in a grid (returns new grid) */
export function swapSeats(
  grid: (string | null)[][],
  from: { r: number; c: number },
  to: { r: number; c: number }
): (string | null)[][] {
  const next = grid.map(row => [...row]);
  const temp = next[to.r][to.c];
  next[to.r][to.c] = next[from.r][from.c];
  next[from.r][from.c] = temp;
  return next;
}

/** Toggle a disabled seat and return updated set + grid */
export function toggleDisabledSeat(
  disabledSeats: Set<string>,
  grid: (string | null)[][],
  r: number,
  c: number
): { disabledSeats: Set<string>; grid: (string | null)[][] } {
  const key = seatKey(r, c);
  const nextDisabled = new Set(disabledSeats);
  const nextGrid = grid.map(row => [...row]);
  if (nextDisabled.has(key)) {
    nextDisabled.delete(key);
  } else {
    nextDisabled.add(key);
    if (nextGrid[r]) nextGrid[r][c] = null;
  }
  return { disabledSeats: nextDisabled, grid: nextGrid };
}
