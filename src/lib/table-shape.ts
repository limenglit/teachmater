/**
 * Shared table-shape geometry for the smart classroom / banquet scenes.
 *
 * Both the teacher editor (SmartClassroom) and the student mobile check-in
 * view must place seats in exactly the same order and at the same relative
 * positions, otherwise names appear in the wrong seat boxes and tables look
 * misaligned. This module is the single source of truth for that math.
 *
 * Reference coordinate space: the teacher editor's 160x160 table tile with the
 * table centred at (80, 80) and round-table seats orbiting at r = 52.
 */

export type TableShape = 'round' | 'square' | 'rect' | 'custom';

export const REFERENCE_ROUND_ORBIT = 52;

export interface TableShapeOptions {
  seatsPerTable: number;
  squareSidePeople?: number;
  customLongPeople?: number;
  customShortPeople?: number;
}

export interface TableGeometry {
  /** Seat centres, in the same order as the seat_data array for that table. */
  positions: { x: number; y: number }[];
  /** Table body: circle for round tables, rect for the others. */
  body:
    | { kind: 'circle'; cx: number; cy: number; r: number }
    | { kind: 'rect'; x: number; y: number; w: number; h: number };
  /** Half extents (from centre) covered by seats, used for layout spacing. */
  extentX: number;
  extentY: number;
}

const along = (from: [number, number], to: [number, number], n: number) =>
  Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => {
    const t = (i + 1) / (n + 1);
    return { x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t };
  });

export function normalizeTableShape(value: unknown): TableShape {
  return value === 'square' || value === 'rect' || value === 'custom' ? value : 'round';
}

/**
 * Compute the table geometry in the reference (teacher) coordinate space,
 * centred on (cx, cy). Seat order starts at the top-left of the top edge and
 * runs clockwise for non-round tables; round tables start at 12 o'clock.
 */
export function getTableGeometry(
  shape: TableShape,
  cx: number,
  cy: number,
  options: TableShapeOptions,
): TableGeometry {
  const seatOffset = 20;
  const seatsPerTable = Math.max(1, Math.floor(options.seatsPerTable || 1));

  if (shape === 'round') {
    const positions = Array.from({ length: seatsPerTable }, (_, i) => {
      const angle = (2 * Math.PI * i) / seatsPerTable - Math.PI / 2;
      return {
        x: cx + REFERENCE_ROUND_ORBIT * Math.cos(angle),
        y: cy + REFERENCE_ROUND_ORBIT * Math.sin(angle),
      };
    });
    return {
      positions,
      body: { kind: 'circle', cx, cy, r: 36 },
      extentX: REFERENCE_ROUND_ORBIT,
      extentY: REFERENCE_ROUND_ORBIT,
    };
  }

  if (shape === 'square') {
    const half = 32;
    const s = options.squareSidePeople === 1 ? 1 : 2;
    const positions = [
      ...along([cx - half, cy - half - seatOffset], [cx + half, cy - half - seatOffset], s),
      ...along([cx + half + seatOffset, cy - half], [cx + half + seatOffset, cy + half], s),
      ...along([cx + half, cy + half + seatOffset], [cx - half, cy + half + seatOffset], s),
      ...along([cx - half - seatOffset, cy + half], [cx - half - seatOffset, cy - half], s),
    ];
    return {
      positions,
      body: { kind: 'rect', x: cx - half, y: cy - half, w: half * 2, h: half * 2 },
      extentX: half + seatOffset,
      extentY: half + seatOffset,
    };
  }

  if (shape === 'custom') {
    const L = Math.max(1, Math.floor(options.customLongPeople ?? 3));
    const W = Math.max(1, Math.floor(options.customShortPeople ?? 2));
    const hw = Math.max(28, L * 14);
    const hh = Math.max(20, W * 14);
    const positions = [
      ...along([cx - hw, cy - hh - seatOffset], [cx + hw, cy - hh - seatOffset], L),
      ...along([cx + hw + seatOffset, cy - hh], [cx + hw + seatOffset, cy + hh], W),
      ...along([cx + hw, cy + hh + seatOffset], [cx - hw, cy + hh + seatOffset], L),
      ...along([cx - hw - seatOffset, cy + hh], [cx - hw - seatOffset, cy - hh], W),
    ];
    return {
      positions,
      body: { kind: 'rect', x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 },
      extentX: hw + seatOffset,
      extentY: hh + seatOffset,
    };
  }

  // rect: 2 on the long sides (top/bottom), 1 on the short sides (left/right)
  const hw = 42;
  const hh = 25;
  const positions = [
    ...along([cx - hw, cy - hh - seatOffset], [cx + hw, cy - hh - seatOffset], 2),
    ...along([cx + hw + seatOffset, cy - hh], [cx + hw + seatOffset, cy + hh], 1),
    ...along([cx + hw, cy + hh + seatOffset], [cx - hw, cy + hh + seatOffset], 2),
    ...along([cx - hw - seatOffset, cy + hh], [cx - hw - seatOffset, cy - hh], 1),
  ];
  return {
    positions,
    body: { kind: 'rect', x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 },
    extentX: hw + seatOffset,
    extentY: hh + seatOffset,
  };
}

/** Seat count implied purely by the table shape (round tables are free-form). */
export function seatsForShape(shape: TableShape, options: TableShapeOptions): number {
  if (shape === 'square') return 4 * (options.squareSidePeople === 1 ? 1 : 2);
  if (shape === 'rect') return 6;
  if (shape === 'custom') {
    return 2 * (Math.max(1, Math.floor(options.customLongPeople ?? 3)) + Math.max(1, Math.floor(options.customShortPeople ?? 2)));
  }
  return Math.max(1, Math.floor(options.seatsPerTable || 1));
}

/** Read the shape options out of a persisted scene_config payload. */
export function readTableShapeConfig(sceneConfig: Record<string, unknown> | null | undefined, fallbackSeats: number): {
  shape: TableShape;
  options: TableShapeOptions;
} {
  const cfg = sceneConfig || {};
  const shape = normalizeTableShape(cfg.tableShape);
  const seatsPerTable = Number(cfg.seatsPerTable) > 0 ? Number(cfg.seatsPerTable) : fallbackSeats;
  const options: TableShapeOptions = {
    seatsPerTable,
    squareSidePeople: Number(cfg.squareSidePeople) === 1 ? 1 : 2,
    customLongPeople: Number(cfg.customLongPeople) > 0 ? Number(cfg.customLongPeople) : 3,
    customShortPeople: Number(cfg.customShortPeople) > 0 ? Number(cfg.customShortPeople) : 2,
  };
  return { shape, options };
}
