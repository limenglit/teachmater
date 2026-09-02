/**
 * Auto-fit canvas geometry for the computer-lab seating scene.
 *
 * The room box must hug the actual content: every row (with its drag offset
 * and 90° rotations), plus the visible reference badges (blackboard / window /
 * door). Keeping this pure makes the behaviour testable and lets the teacher
 * editor and the exported scene_config stay in sync.
 */

export interface LabRowTransform {
  x?: number;
  y?: number;
  rotation?: number;
}

export interface LabRoomInput {
  allTableW: number;
  maxRows: number;
  rowGap: number;
  rowTransforms: (LabRowTransform | undefined)[];
  dualSide: boolean;
  showTop: boolean;
  showBottom: boolean;
  seatH: number;
  sceneLocked: boolean;
  refPositions: Partial<Record<'blackboard' | 'window' | 'door', { x: number; y: number }>>;
  refVisible: Partial<Record<'blackboard' | 'window' | 'door', boolean>>;
}

export const LAB_ROOM_PAD = 40;
export const LAB_REF_PAD = 24;
export const LAB_BADGE_W = 90;
export const LAB_BADGE_H = 32;
export const LAB_MIN_ROOM_W = 520;
export const LAB_MIN_ROOM_H = 380;
export const LAB_ROTATE_BTN_W = 42;

export function computeLabRoomSize(input: LabRoomInput): { roomWidth: number; roomHeight: number } {
  const { allTableW, maxRows, rowGap, rowTransforms, dualSide, showTop, showBottom, seatH, sceneLocked } = input;
  const rotateBtnW = sceneLocked ? 0 : LAB_ROTATE_BTN_W;

  let halfW = allTableW / 2 + rotateBtnW;
  let maxY = 0;

  for (let ri = 0; ri < Math.max(1, maxRows); ri++) {
    const tf = rowTransforms[ri] || { x: 0, y: 0, rotation: 0 };
    const baseY = 120 + ri * rowGap;
    const rowCenterY = dualSide ? baseY + 20 : baseY + 52;
    const topY = showTop ? baseY - seatH - 8 : baseY;
    const bottomY = showBottom ? (dualSide ? baseY + 28 : baseY + 24 + 8) + seatH : baseY + 24;
    const left = -allTableW / 2;
    const right = allTableW / 2 + rotateBtnW;
    const a = ((tf.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    for (const [dx, y] of [[left, topY], [right, topY], [left, bottomY], [right, bottomY]] as const) {
      const dy = y - rowCenterY;
      const rx = dx * cos - dy * sin + (tf.x ?? 0);
      const ry = rowCenterY + dx * sin + dy * cos + (tf.y ?? 0);
      halfW = Math.max(halfW, Math.abs(rx));
      maxY = Math.max(maxY, ry);
    }
  }

  let roomWidth = Math.max(LAB_MIN_ROOM_W, Math.round(halfW * 2 + LAB_ROOM_PAD * 2));
  let roomHeight = Math.max(LAB_MIN_ROOM_H, Math.round(maxY + LAB_ROOM_PAD));

  for (const key of ['blackboard', 'window', 'door'] as const) {
    if (input.refVisible[key] === false) continue;
    const p = input.refPositions[key];
    if (!p) continue;
    roomWidth = Math.max(roomWidth, Math.round(p.x + LAB_BADGE_W + LAB_REF_PAD));
    roomHeight = Math.max(roomHeight, Math.round(p.y + LAB_BADGE_H + LAB_REF_PAD));
  }

  return { roomWidth, roomHeight };
}
