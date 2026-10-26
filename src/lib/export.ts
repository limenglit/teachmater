import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { sortSeatIndex, planSeatIndexLayout, fitIndexName, seatIndexLabel, INDEX_PAGE, INDEX_CELL_GAP, INDEX_LETTER_SPACING, type SeatIndexEntry, type SeatIndexLayout } from './seat-index';
import { get2d, drawTextBlock, drawIndexPage } from './canvas-text';
import { withLegacyColors } from './html2canvas-colors';

const COPYRIGHT_TEXT = '教创搭子出品 |https://teachmater.lovable.app|洛阳理工学院|limeng@lit.edu.cn';

export const BASELINE_FIX_ATTR = 'data-export-baseline-fix';

/** System CJK fonts first: they exist for both the page and the canvas. */
export const EXPORT_FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC","Hiragino Sans GB",SimHei,sans-serif';

/**
 * Text written by the exporter (title, footer, index table). A non-zero
 * letter-spacing makes html2canvas place every character at its own measured
 * position instead of drawing whole word runs, whose canvas width can exceed
 * the page width and push glyphs into each other. Kerning and ligatures are
 * off so the page advances match the canvas's per-character advances.
 */
export const exportTextCss = (letterSpacingPx: number) =>
  `font-family:${EXPORT_FONT};letter-spacing:${letterSpacingPx}px;font-kerning:none;font-variant-ligatures:none;font-feature-settings:normal;white-space:nowrap;`;

/**
 * html2canvas measures each font's baseline in the live page with a 1x1 <img>
 * placed after sample text. Tailwind's preflight makes every img display:block,
 * which drops that probe onto its own line, so every glyph is drawn several
 * pixels too low: row/column pills, seat names and index rows sink onto their
 * borders. Keep the probe inline only for the duration of the capture.
 */
async function renderCanvas(el: HTMLElement, opts: Parameters<typeof html2canvas>[1]) {
  const fix = document.createElement('style');
  fix.setAttribute(BASELINE_FIX_ATTR, '');
  fix.textContent = 'img[width="1"][height="1"]{display:inline !important;vertical-align:baseline;}';
  document.head.appendChild(fix);
  try {
    return await withLegacyColors(() => html2canvas(el, opts));
  } finally {
    fix.remove();
  }
}

async function captureWithHeaderFooter(element: HTMLElement, title: string) {
  const clone = element.cloneNode(true) as HTMLElement;

  // The room's zoom is presentation-only. Preserve child transforms (translated
  // labels, rotated seats/tables): clearing every transform stacks them together.
  const neutralize = (root: HTMLElement) => {
    const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
    for (const el of all) {
      const s = el.style;
      if (s.zoom) s.zoom = '';
    }
    root.querySelectorAll<HTMLElement>('[data-export-exclude]').forEach(el => el.remove());
    // html2canvas clips text inside <input> (e.g. editable group names); print
    // them as plain text with the live value instead.
    const liveInputs = element.querySelectorAll('input');
    root.querySelectorAll('input').forEach((inp, i) => {
      const live = liveInputs[i] as HTMLInputElement | undefined;
      const value = live?.value ?? (inp as HTMLInputElement).value;
      if ((inp as HTMLInputElement).type === 'hidden' || !value) return;
      const span = document.createElement('span');
      span.textContent = value;
      span.className = inp.className.replace(/\bh-\d+\b/g, '');
      span.style.display = 'inline-block';
      span.style.whiteSpace = 'nowrap';
      span.style.lineHeight = '1.75rem';
      span.style.flex = '1 1 auto';
      inp.replaceWith(span);
    });
    // Print-only content (e.g. the unit color legend): reveal it at the chart's
    // width without letting a long single-line legend widen the exported room.
    root.querySelectorAll<HTMLElement>('[data-export-only]').forEach(el => {
      el.classList.remove('hidden');
      el.style.display = 'flex';
      el.style.width = '0';
      el.style.minWidth = '100%';
      el.style.boxSizing = 'border-box';
    });
    // Classroom grid zoom has no frame; its natural grid width is already
    // unscaled, so drop only this screen-level transform, not seat positions.
    root.querySelectorAll<HTMLElement>('[data-export-unscale]').forEach(el => {
      el.style.transform = 'none';
    });
    root.querySelectorAll<HTMLElement>('[class*="overflow"], [class*="max-h"], [class*="max-w"]').forEach(el => {
      el.style.overflow = 'visible';
      el.style.overflowX = 'visible';
      el.style.overflowY = 'visible';
      el.style.maxHeight = 'none';
      el.style.maxWidth = 'none';
      // Only scroll viewports should expand. Seat labels may use overflow-hidden
      // to keep names inside fixed cells; changing their dimensions shifts rows.
      if (el.classList.contains('overflow-auto') || el.classList.contains('overflow-scroll') ||
          el.classList.contains('overflow-x-auto') || el.classList.contains('overflow-y-auto')) {
        el.style.height = 'auto';
        el.style.width = 'auto';
      }
    });
    // All room scenes use a fixed-size child scaled inside an equally scaled
    // frame. Size that frame from the unscaled scene, not the current zoom.
    root.querySelectorAll<HTMLElement>('[data-zoom-frame], [class*="mx-auto"]').forEach(frame => {
      const scene = frame.firstElementChild as HTMLElement | null;
      if (!scene || !/^scale\([\d.]+\)$/.test(scene.style.transform)) return;
      scene.style.transform = 'none';
      if (scene.style.width) frame.style.width = scene.style.width;
      if (scene.style.height) frame.style.height = scene.style.height;
      frame.style.maxWidth = 'none';
    });
  };
  neutralize(clone);

  // Hide disabled seats in exported files: keep slot for grid alignment but
  // remove visible border/background/text so the cell does not appear.
  clone.querySelectorAll<HTMLElement>('[data-disabled-seat="true"]').forEach((el) => {
    el.style.visibility = 'hidden';
    el.style.background = 'transparent';
    el.style.border = 'none';
    el.style.color = 'transparent';
    el.textContent = '';
  });

  // First, measure natural content size by mounting clone off-screen at auto width
  const sizer = document.createElement('div');
  sizer.style.position = 'fixed';
  sizer.style.left = '0';
  sizer.style.top = '0';
  sizer.style.visibility = 'hidden';
  sizer.style.display = 'inline-block';
  sizer.appendChild(clone);
  document.body.appendChild(sizer);
  const naturalWidth = Math.max(clone.scrollWidth, clone.offsetWidth, 1);
  document.body.removeChild(sizer);

  // The live scrollWidth reflects zoom, not the exported room dimensions.
  const width = naturalWidth;
  // A chart rendered in a narrow viewport can retain that viewport's fixed
  // width on the clone. Give it the measured export width before centering,
  // otherwise the expanded room can extend past the PNG/PDF right edge.
  clone.style.width = `${width}px`;
  clone.style.minWidth = `${width}px`;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  // html2canvas clips fixed elements placed far outside the viewport, even
  // when scrollWidth is correct. Keep the capture at 0,0 and move it back
  // offscreen only after rendering.
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.visibility = 'hidden';
  wrapper.style.background = '#ffffff';
  wrapper.style.width = `${width + 48}px`;
  // Safe clearance so podium/door markers at the room edge never touch the
  // title or copyright line.
  wrapper.style.padding = '20px 24px 16px';
  wrapper.style.boxSizing = 'border-box';

  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText = `${exportTextCss(2)}text-align:center;color:#000000;font-size:22px;font-weight:700;line-height:1.4;margin-bottom:16px;white-space:normal;word-break:break-all;`;

  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.justifyContent = 'center';
  content.style.alignItems = 'flex-start';
  content.style.width = '100%';
  // Inner box constrained to natural width centered via flex
  const innerBox = document.createElement('div');
  innerBox.style.display = 'inline-block';
  innerBox.style.margin = '0 auto';
  innerBox.appendChild(clone);
  content.appendChild(innerBox);

  const footer = document.createElement('div');
  footer.textContent = COPYRIGHT_TEXT;
  footer.style.cssText = `${exportTextCss(1)}margin-top:16px;text-align:center;color:#333333;font-size:11px;line-height:1.5;white-space:normal;word-break:break-all;`;

  wrapper.appendChild(heading);
  wrapper.appendChild(content);
  wrapper.appendChild(footer);
  document.body.appendChild(wrapper);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    // Use the post-layout extent: absolutely positioned room details and long
    // rows can extend past the initial scrollWidth measured in the sizer.
    wrapper.style.width = `${Math.max(wrapper.scrollWidth, width + 48)}px`;
    const maxDimension = Math.max(wrapper.scrollWidth, wrapper.scrollHeight);
    const scale = Math.min(3, 12000 / maxDimension, Math.sqrt(36_000_000 / (wrapper.scrollWidth * wrapper.scrollHeight)));
    wrapper.style.visibility = 'visible';
    const canvas = await renderCanvas(wrapper, {
      backgroundColor: '#ffffff',
      // 3x improves name legibility; cap extreme rooms to avoid oversized
      // canvases on mobile browsers while preserving the entire chart.
      scale,
      useCORS: true,
      // Lock offsets: page scroll otherwise shifts the capture and clips the
      // podium row or footer.
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(document.documentElement.clientWidth, wrapper.scrollWidth),
      windowHeight: Math.max(document.documentElement.clientHeight, wrapper.scrollHeight),
    });
    // Repaint title and footer with native canvas text: html2canvas places
    // glyphs from page measurements, which overlap whenever the canvas font
    // is wider (system font substitution, browser zoom).
    const ctx = get2d(canvas);
    if (ctx) {
      const base = wrapper.getBoundingClientRect();
      const boxOf = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
      };
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawTextBlock(ctx, title, boxOf(heading), { size: 22, weight: 700, color: '#000000', spacing: 2, lineHeight: 1.4, minSize: 14 });
      drawTextBlock(ctx, COPYRIGHT_TEXT, boxOf(footer), { size: 11, weight: 400, color: '#333333', spacing: 1, lineHeight: 1.5, minSize: 8 });
      ctx.restore();
    }
    return { canvas, scale };
  } finally {
    document.body.removeChild(wrapper);
  }
}

export async function exportToPNG(element: HTMLElement, filename: string, title?: string) {
  const { canvas } = await captureWithHeaderFooter(element, title || filename);
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function exportToPDF(element: HTMLElement, filename: string, title?: string, seatIndex?: SeatIndexEntry[], seatIndexNote?: string) {
  const { canvas, scale: canvasScale } = await captureWithHeaderFooter(element, title || filename);
  const imgData = canvas.toDataURL('image/png');
  const imgW = canvas.width;
  const imgH = canvas.height;

  // Select the smallest standard sheet where the chart remains legible at
  // roughly its natural print size (96dpi). Larger rooms need a larger sheet,
  // not a tiny A4 rendering of dozens of seats.
  const sheets = [
    { name: 'a4', short: 210, long: 297 },
    { name: 'a3', short: 297, long: 420 },
    { name: 'a2', short: 420, long: 594 },
    { name: 'a1', short: 594, long: 841 },
  ];
  const margin = 6;
  const aspect = imgW / imgH;
  const orientation: 'portrait' | 'landscape' = aspect >= 1 ? 'landscape' : 'portrait';
  const naturalW = imgW / canvasScale;
  const naturalH = imgH / canvasScale;
  const sheet = sheets.find(({ short, long }) => {
    const w = orientation === 'landscape' ? long : short;
    const h = orientation === 'landscape' ? short : long;
    return naturalW * 0.25 <= w - margin * 2 && naturalH * 0.25 <= h - margin * 2;
  }) ?? sheets[sheets.length - 1];
  const page = orientation === 'landscape' ? { w: sheet.long, h: sheet.short } : { w: sheet.short, h: sheet.long };

  const pdf = new jsPDF({ orientation, unit: 'mm', format: sheet.name });
  const pageW = page.w;
  const pageH = page.h;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  // Keep the entire seating chart on one page: slicing a raster image in
  // arbitrary rows cuts names, seats and tables across page boundaries.
  const scale = Math.min(usableW / imgW, usableH / imgH, 0.25 / canvasScale);
  const scaledTotalH = imgH * scale; // total height in mm at usable width
  const scaledW = imgW * scale;
  pdf.addImage(imgData, 'PNG', (pageW - scaledW) / 2, (pageH - scaledTotalH) / 2, scaledW, scaledTotalH);

  if (seatIndex && seatIndex.length > 0) {
    const { sortBy, entries } = sortSeatIndex(seatIndex);
    const layout = planSeatIndexLayout(entries);
    const pages = Math.ceil(entries.length / layout.perPage);
    for (let p = 0; p < pages; p++) {
      const chunk = entries.slice(p * layout.perPage, (p + 1) * layout.perPage);
      const idxCanvas = await renderIndexPage(chunk, layout, `${title || filename} · 学生座位快速索引`,
        `按${sortBy === 'number' ? '学号' : '姓名拼音'}排序 · 共 ${entries.length} 人${seatIndexNote ? ` · ${seatIndexNote}` : ''}${pages > 1 ? ` · 第 ${p + 1}/${pages} 页` : ''}`);
      pdf.addPage('a4', 'portrait');
      // The index canvas is a fixed A4-shaped page, so every page maps onto
      // the full sheet at the same scale and font sizes stay identical.
      pdf.addImage(idxCanvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }
  }

  pdf.save(`${filename}.pdf`);
}

export async function renderIndexPage(entries: SeatIndexEntry[], layout: SeatIndexLayout, heading: string, sub: string) {
  if (document.fonts?.ready) await document.fonts.ready;
  // Native canvas text: the canvas measures what it draws, so names and seat
  // text keep their spacing on every system font. DOM capture is the fallback.
  const native = drawIndexPage(entries, layout, heading, sub, COPYRIGHT_TEXT);
  if (native) return native;
  const P = INDEX_PAGE;
  const wrap = document.createElement('div');
  // Letter-spacing is inherited by every cell, so all index text is placed
  // character by character (see exportTextCss).
  wrap.style.cssText = `${exportTextCss(INDEX_LETTER_SPACING)}position:fixed;left:0;top:0;width:${P.width}px;height:${P.height}px;overflow:hidden;padding:28px ${P.padX}px 0;box-sizing:border-box;background:#fff;color:#111;`;
  const h = document.createElement('div');
  h.textContent = heading;
  h.style.cssText = 'text-align:center;font-size:20px;font-weight:700;line-height:1.4;letter-spacing:1px;white-space:normal;word-break:break-all;';
  const s = document.createElement('div');
  s.textContent = sub;
  s.style.cssText = 'text-align:center;font-size:12px;color:#555;line-height:1.5;margin:4px 0 14px;white-space:normal;';

  const hasNumber = layout.numberWidth > 0;
  const cols = hasNumber
    ? `${layout.numberWidth}px minmax(0,1fr) ${layout.seatWidth}px`
    : `minmax(0,1fr) ${layout.seatWidth}px`;
  const cellGap = INDEX_CELL_GAP;
  const makeLine = (cells: string[], isHeader: boolean, idx = 0) => {
    const line = document.createElement('div');
    const border = isHeader ? '1.5px solid #111' : `1px solid ${(idx + 1) % 5 === 0 ? '#9a9a9a' : '#e2e2e2'}`;
    line.style.cssText = `display:grid;grid-template-columns:${cols};column-gap:${cellGap}px;align-items:center;height:${P.rowHeight}px;border-bottom:${border};box-sizing:border-box;white-space:nowrap;`;
    cells.forEach((text, i) => {
      const span = document.createElement('span');
      span.textContent = text;
      const isNum = hasNumber && i === 0;
      const isSeat = i === cells.length - 1;
      // Centred by the row's flex/grid alignment; renderCanvas keeps the
      // html2canvas baseline probe inline, so no padding offset is needed.
      let css = 'display:block;line-height:1.25;min-width:0;';
      if (isHeader) css += 'font-size:11.5px;font-weight:700;color:#444;';
      else if (isNum) css += 'font-size:12px;color:#444;font-variant-numeric:tabular-nums;';
      else if (isSeat) css += 'font-size:12.5px;font-weight:700;color:#111;';
      else css += `font-size:${P.nameFont}px;color:#111;`;
      if (isSeat) css += 'text-align:right;';
      span.style.cssText = css;
      line.appendChild(span);
    });
    return line;
  };

  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${layout.columns},minmax(0,1fr));column-gap:${P.columnGap}px;align-items:start;`;
  // Balance a short last page across all columns instead of one long column.
  const rowsUsed = Math.min(layout.rowsPerPage, Math.ceil(entries.length / layout.columns));
  for (let c = 0; c < layout.columns; c++) {
    const colEntries = entries.slice(c * rowsUsed, (c + 1) * rowsUsed);
    const col = document.createElement('div');
    if (colEntries.length > 0) {
      col.appendChild(makeLine(hasNumber ? ['学号', '姓名', '座位'] : ['姓名', '座位'], true));
      colEntries.forEach((e, i) => {
        const name = fitIndexName(e.name, layout.nameChars);
        const seat = seatIndexLabel(e);
        col.appendChild(makeLine(hasNumber ? [e.studentNumber?.trim() || '—', name, seat] : [name, seat], false, i));
      });
    }
    grid.appendChild(col);
  }

  const foot = document.createElement('div');
  foot.textContent = COPYRIGHT_TEXT;
  foot.style.cssText = `position:absolute;left:0;right:0;bottom:18px;text-align:center;font-size:9px;line-height:12px;color:#666;`;
  wrap.append(h, s, grid, foot);
  document.body.appendChild(wrap);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    return await renderCanvas(wrap, {
      backgroundColor: '#ffffff', scale: 2, x: 0, y: 0, scrollX: 0, scrollY: 0,
      width: P.width, height: P.height, windowWidth: Math.max(document.documentElement.clientWidth, P.width),
      windowHeight: Math.max(document.documentElement.clientHeight, P.height),
    });
  } finally {
    document.body.removeChild(wrap);
  }
}

export async function exportToSVG(element: HTMLElement, filename: string, title?: string) {
  const exportTitle = title || filename;
  // Use html2canvas to capture the element as an image, then embed in SVG
  const { canvas, scale } = await captureWithHeaderFooter(element, exportTitle);
  const dataUrl = canvas.toDataURL('image/png');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${canvas.width / scale}" height="${canvas.height / scale}" viewBox="0 0 ${canvas.width / scale} ${canvas.height / scale}">
  <image width="${canvas.width / scale}" height="${canvas.height / scale}" href="${dataUrl}" />
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
