/**
 * Native canvas text for exporter-written text (chart title/footer and the
 * PDF seat index). The canvas measures and draws with the same font, so
 * characters can never be pushed into each other the way html2canvas does
 * when the page font and the canvas font differ (system fonts, page zoom).
 */
import { fitIndexName, seatIndexLabel, INDEX_PAGE, INDEX_CELL_GAP, type SeatIndexEntry, type SeatIndexLayout } from './seat-index';

export const CANVAS_FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC","Hiragino Sans GB",SimHei,sans-serif';

export function get2d(canvas: HTMLCanvasElement | null | undefined): CanvasRenderingContext2D | null {
  try {
    return typeof canvas?.getContext === 'function' ? canvas.getContext('2d') : null;
  } catch {
    return null;
  }
}

const chars = (t: string) => Array.from(t);

/** Width of text drawn one character at a time with extra spacing. */
export function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  const cs = chars(text);
  return cs.reduce((w, ch) => w + ctx.measureText(ch).width, 0) + spacing * Math.max(0, cs.length - 1);
}

/** Draw text character by character; y is the vertical middle. */
export function drawSpaced(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number,
  align: 'left' | 'center' | 'right' = 'left',
) {
  const w = spacedWidth(ctx, text, spacing);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const ch of chars(text)) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

/** Truncate with … so the spaced text fits maxWidth. */
export function fitSpaced(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, spacing: number) {
  if (spacedWidth(ctx, text, spacing) <= maxWidth) return text;
  const cs = chars(text);
  for (let n = cs.length - 1; n >= 1; n--) {
    const t = `${cs.slice(0, n).join('')}…`;
    if (spacedWidth(ctx, t, spacing) <= maxWidth) return t;
  }
  return '…';
}

/** Break text into lines that fit maxWidth (any character may break). */
export function wrapSpaced(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, spacing: number) {
  const lines: string[] = [];
  let line = '';
  for (const ch of chars(text)) {
    const next = line + ch;
    if (line && spacedWidth(ctx, next, spacing) > maxWidth) {
      lines.push(line);
      line = ch;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Paint centred, wrapped text inside a box (CSS px, already scaled by the
 * caller's transform). Shrinks the font until all lines fit the box height.
 */
export function drawTextBlock(
  ctx: CanvasRenderingContext2D, text: string,
  box: { x: number; y: number; w: number; h: number },
  o: { size: number; weight: number; color: string; spacing: number; lineHeight: number; minSize?: number },
) {
  let size = o.size;
  let lines: string[] = [];
  for (;;) {
    ctx.font = `${o.weight} ${size}px ${CANVAS_FONT}`;
    lines = wrapSpaced(ctx, text, box.w, o.spacing);
    if (lines.length * size * o.lineHeight <= box.h + 0.5 || size <= (o.minSize ?? 8)) break;
    size -= 0.5;
  }
  const lh = size * o.lineHeight;
  const top = box.y + (box.h - lines.length * lh) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
  ctx.fillStyle = o.color;
  lines.forEach((l, i) => drawSpaced(ctx, l, box.x + box.w / 2, top + lh * (i + 0.5), o.spacing, 'center'));
}

/** Character spacing (px) used for each kind of index text. */
export const INDEX_SPACING = { heading: 1.5, sub: 0.6, header: 1, number: 0.4, name: 1, seat: 0.8, footer: 0.4 } as const;

/** Draw one fixed-A4 seat index page natively. Returns null without canvas 2D. */
export function drawIndexPage(
  entries: SeatIndexEntry[], layout: SeatIndexLayout, heading: string, sub: string, footer: string, scale = 2,
): HTMLCanvasElement | null {
  const P = INDEX_PAGE;
  const canvas = document.createElement('canvas');
  canvas.width = P.width * scale;
  canvas.height = P.height * scale;
  const ctx = get2d(canvas);
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, P.width, P.height);
  const usable = P.width - P.padX * 2;

  drawTextBlock(ctx, heading, { x: P.padX, y: 24, w: usable, h: 30 }, { size: 20, weight: 700, color: '#111111', spacing: INDEX_SPACING.heading, lineHeight: 1.4, minSize: 13 });
  drawTextBlock(ctx, sub, { x: P.padX, y: 58, w: usable, h: 20 }, { size: 12, weight: 400, color: '#555555', spacing: INDEX_SPACING.sub, lineHeight: 1.5, minSize: 9 });

  const tableTop = 94;
  const rh = P.rowHeight;
  const hasNumber = layout.numberWidth > 0;
  const colW = (usable - P.columnGap * (layout.columns - 1)) / layout.columns;
  const nameX = hasNumber ? layout.numberWidth + INDEX_CELL_GAP : 0;
  const nameMax = colW - nameX - layout.seatWidth - INDEX_CELL_GAP;
  const rowsUsed = Math.min(layout.rowsPerPage, Math.ceil(entries.length / layout.columns));

  const cell = (text: string, x: number, y: number, size: number, weight: number, color: string, spacing: number, align: 'left' | 'right', max: number) => {
    ctx.font = `${weight} ${size}px ${CANVAS_FONT}`;
    ctx.fillStyle = color;
    drawSpaced(ctx, fitSpaced(ctx, text, max, spacing), x, y, spacing, align);
  };

  for (let c = 0; c < layout.columns; c++) {
    const col = entries.slice(c * rowsUsed, (c + 1) * rowsUsed);
    if (col.length === 0) continue;
    const x0 = P.padX + c * (colW + P.columnGap);
    const hy = tableTop + rh / 2;
    if (hasNumber) cell('学号', x0, hy, 11.5, 700, '#444444', INDEX_SPACING.header, 'left', layout.numberWidth);
    cell('姓名', x0 + nameX, hy, 11.5, 700, '#444444', INDEX_SPACING.header, 'left', nameMax);
    cell('座位', x0 + colW, hy, 11.5, 700, '#444444', INDEX_SPACING.header, 'right', layout.seatWidth);
    ctx.fillStyle = '#111111';
    ctx.fillRect(x0, tableTop + rh - 1.5, colW, 1.5);
    col.forEach((e, i) => {
      const top = tableTop + rh * (i + 1);
      const y = top + rh / 2;
      if (hasNumber) cell(e.studentNumber?.trim() || '—', x0, y, 12, 400, '#444444', INDEX_SPACING.number, 'left', layout.numberWidth);
      cell(fitIndexName(e.name, layout.nameChars + 2), x0 + nameX, y, P.nameFont, 400, '#111111', INDEX_SPACING.name, 'left', nameMax);
      cell(seatIndexLabel(e), x0 + colW, y, 12.5, 700, '#111111', INDEX_SPACING.seat, 'right', layout.seatWidth);
      ctx.fillStyle = (i + 1) % 5 === 0 ? '#9a9a9a' : '#e2e2e2';
      ctx.fillRect(x0, top + rh - 1, colW, 1);
    });
  }

  drawTextBlock(ctx, footer, { x: P.padX, y: P.height - 32, w: usable, h: 14 }, { size: 9, weight: 400, color: '#666666', spacing: INDEX_SPACING.footer, lineHeight: 1.3, minSize: 7 });
  return canvas;
}
