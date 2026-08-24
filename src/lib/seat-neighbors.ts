/**
 * Neighbor lookup for the phone-side seat check-in navigation.
 *
 * Given the seat layout and my name, find the seats directly in front of /
 * behind / left of / right of me, so the student page can say
 * "您在 张三 的后面" once one of those neighbours has checked in.
 */

export type NeighborRelation = 'front' | 'back' | 'left' | 'right' | 'side';

export interface SeatNeighbor {
  name: string;
  relation: NeighborRelation;
}

const normalize = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim() : '';

const pick = (grid: (string | null)[][], r: number, c: number) => normalize(grid[r]?.[c]);

const gridNeighbors = (grid: (string | null)[][], r: number, c: number): SeatNeighbor[] => {
  const out: SeatNeighbor[] = [];
  const front = pick(grid, r - 1, c);
  const back = pick(grid, r + 1, c);
  const left = pick(grid, r, c - 1);
  const right = pick(grid, r, c + 1);
  // Priority order: the person in front first, then behind, then sides.
  if (front) out.push({ name: front, relation: 'front' });
  if (back) out.push({ name: back, relation: 'back' });
  if (left) out.push({ name: left, relation: 'left' });
  if (right) out.push({ name: right, relation: 'right' });
  return out;
};

const findInGrid = (grid: (string | null)[][], me: string) => {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      if (pick(grid, r, c) === me) return { r, c };
    }
  }
  return null;
};

/** Neighbours around my seat, ordered by how useful the hint is. */
export function getSeatNeighbors(sceneType: string, seatData: unknown, studentName: string): SeatNeighbor[] {
  const me = normalize(studentName);
  if (!me) return [];

  if ((sceneType === 'classroom' || sceneType === 'concertHall') && Array.isArray(seatData)) {
    const grid = seatData as (string | null)[][];
    const pos = findInGrid(grid, me);
    if (!pos) return [];
    return gridNeighbors(grid, pos.r, pos.c).filter(n => n.name !== me);
  }

  if (sceneType === 'computerLab' && Array.isArray(seatData)) {
    const rows = seatData as Array<{ students?: (string | null)[] }>;
    for (const row of rows) {
      const students = Array.isArray(row?.students) ? row.students : [];
      const idx = students.findIndex(n => normalize(n) === me);
      if (idx >= 0) {
        const out: SeatNeighbor[] = [];
        const left = normalize(students[idx - 1]);
        const right = normalize(students[idx + 1]);
        if (left) out.push({ name: left, relation: 'left' });
        if (right) out.push({ name: right, relation: 'right' });
        return out.filter(n => n.name !== me);
      }
    }
    return [];
  }

  // Table-like scenes (smart classroom / banquet / art studio rings): seats sit
  // around a table or ring, so only "next to" makes sense.
  if (Array.isArray(seatData)) {
    const tables = seatData as unknown[];
    for (const table of tables) {
      const seats = Array.isArray(table)
        ? (table as (string | null)[])
        : Array.isArray((table as { seats?: unknown })?.seats)
          ? ((table as { seats: (string | null)[] }).seats)
          : null;
      if (!seats) continue;
      const idx = seats.findIndex(n => normalize(n) === me);
      if (idx >= 0) {
        const len = seats.length;
        const prev = normalize(seats[(idx - 1 + len) % len]);
        const next = normalize(seats[(idx + 1) % len]);
        const out: SeatNeighbor[] = [];
        if (prev) out.push({ name: prev, relation: 'side' });
        if (next) out.push({ name: next, relation: 'side' });
        return out.filter(n => n.name !== me);
      }
    }
  }

  return [];
}

/** Human readable relative-position hint (Chinese, matching the nav copy). */
export function describeNeighbor(neighbor: SeatNeighbor): string {
  switch (neighbor.relation) {
    case 'front':
      return `您在 ${neighbor.name} 的后面`;
    case 'back':
      return `您在 ${neighbor.name} 的前面`;
    case 'left':
      return `您在 ${neighbor.name} 的右边`;
    case 'right':
      return `您在 ${neighbor.name} 的左边`;
    default:
      return `您在 ${neighbor.name} 的旁边`;
  }
}

/** First neighbour (in priority order) that already checked in. */
export function pickCheckedInNeighbor(neighbors: SeatNeighbor[], checkedNames: string[]): SeatNeighbor | null {
  const set = new Set(checkedNames.map(normalize).filter(Boolean));
  return neighbors.find(n => set.has(normalize(n.name))) ?? null;
}
