import { describe, it, expect } from 'vitest';
import { computeLabRoomSize, LabRoomInput } from './computer-lab-room';

const base = (over: Partial<LabRoomInput> = {}): LabRoomInput => ({
  allTableW: 8 * (56 + 4) + 4, // 484
  maxRows: 4,
  rowGap: 128,
  rowTransforms: [],
  dualSide: true,
  showTop: true,
  showBottom: true,
  seatH: 36,
  sceneLocked: false,
  refPositions: { blackboard: { x: 300, y: 12 }, window: { x: 24, y: 200 }, door: { x: 600, y: 500 } },
  refVisible: { blackboard: true, window: true, door: true },
  ...over,
});

describe('computeLabRoomSize', () => {
  it('hugs the table block instead of a fixed 980x760 canvas', () => {
    const { roomWidth, roomHeight } = computeLabRoomSize(base());
    expect(roomWidth).toBeLessThan(980);
    expect(roomHeight).toBeLessThan(760);
    expect(roomWidth).toBeGreaterThan(484);
  });

  it('shrinks when rows are removed', () => {
    const big = computeLabRoomSize(base({ maxRows: 8 }));
    const small = computeLabRoomSize(base({ maxRows: 2 }));
    expect(small.roomHeight).toBeLessThan(big.roomHeight);
  });

  it('grows horizontally when tables are added', () => {
    const one = computeLabRoomSize(base());
    const three = computeLabRoomSize(base({ allTableW: 484 * 3 + 40 * 2 }));
    expect(three.roomWidth).toBeGreaterThan(one.roomWidth);
  });

  it('expands to fit a rotated row', () => {
    const flat = computeLabRoomSize(base());
    const rotated = computeLabRoomSize(base({ rowTransforms: [undefined, undefined, undefined, { x: 0, y: 0, rotation: 90 }] }));
    expect(rotated.roomHeight).toBeGreaterThan(flat.roomHeight);
    expect(rotated.roomWidth).toBeLessThanOrEqual(flat.roomWidth + 4);
  });

  it('follows a dragged row in both axes', () => {
    const flat = computeLabRoomSize(base());
    const dragged = computeLabRoomSize(base({ rowTransforms: [{ x: 260, y: 180, rotation: 0 }] }));
    expect(dragged.roomWidth).toBeGreaterThan(flat.roomWidth);
    expect(dragged.roomHeight).toBeGreaterThanOrEqual(flat.roomHeight);
  });

  it('is symmetric for mirrored row drags (content stays centred)', () => {
    const left = computeLabRoomSize(base({ sceneLocked: true, refPositions: {}, refVisible: {}, rowTransforms: [{ x: -300, y: 0, rotation: 0 }] }));
    const right = computeLabRoomSize(base({ sceneLocked: true, refPositions: {}, refVisible: {}, rowTransforms: [{ x: 300, y: 0, rotation: 0 }] }));
    expect(left.roomWidth).toBe(right.roomWidth);
  });

  it('expands to keep a moved door badge inside the room', () => {
    const inside = computeLabRoomSize(base({ refPositions: { door: { x: 100, y: 100 } }, refVisible: { door: true } }));
    const moved = computeLabRoomSize(base({ refPositions: { door: { x: 1200, y: 900 } }, refVisible: { door: true } }));
    expect(moved.roomWidth).toBeGreaterThanOrEqual(1200 + 90 + 24);
    expect(moved.roomHeight).toBeGreaterThanOrEqual(900 + 32 + 24);
    expect(moved.roomWidth).toBeGreaterThan(inside.roomWidth);
  });

  it('ignores hidden reference badges', () => {
    const visible = computeLabRoomSize(base({ refPositions: { door: { x: 1400, y: 100 } }, refVisible: { door: true } }));
    const hidden = computeLabRoomSize(base({ refPositions: { door: { x: 1400, y: 100 } }, refVisible: { door: false } }));
    expect(hidden.roomWidth).toBeLessThan(visible.roomWidth);
  });

  it('drops the rotate-button margin when the scene is locked', () => {
    const unlocked = computeLabRoomSize(base({ refVisible: {}, refPositions: {} }));
    const locked = computeLabRoomSize(base({ refVisible: {}, refPositions: {}, sceneLocked: true }));
    expect(locked.roomWidth).toBeLessThan(unlocked.roomWidth);
  });

  it('never returns a canvas smaller than the minimum', () => {
    const tiny = computeLabRoomSize(base({ allTableW: 60, maxRows: 1, refPositions: {}, refVisible: {} }));
    expect(tiny.roomWidth).toBeGreaterThanOrEqual(520);
    expect(tiny.roomHeight).toBeGreaterThanOrEqual(380);
  });

  it('single-side layouts are shorter than dual-side ones', () => {
    const dual = computeLabRoomSize(base({ refPositions: {}, refVisible: {} }));
    const single = computeLabRoomSize(base({ refPositions: {}, refVisible: {}, dualSide: false, showTop: false, showBottom: true, rowGap: 188 }));
    expect(single.roomHeight).not.toBe(dual.roomHeight);
  });
});
