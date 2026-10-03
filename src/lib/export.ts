import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const COPYRIGHT_TEXT = '教创搭子出品 |https://teachmater.lovable.app|洛阳理工学院|limeng@lit.edu.cn';

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
  sizer.style.left = '-100000px';
  sizer.style.top = '0';
  sizer.style.visibility = 'hidden';
  sizer.style.display = 'inline-block';
  sizer.appendChild(clone);
  document.body.appendChild(sizer);
  const naturalWidth = Math.max(clone.scrollWidth, clone.offsetWidth, 900);
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
  wrapper.style.left = '-100000px';
  wrapper.style.top = '0';
  wrapper.style.background = '#ffffff';
  wrapper.style.width = `${width + 24}px`;
  wrapper.style.padding = '12px 12px 10px';
  wrapper.style.boxSizing = 'border-box';

  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.textAlign = 'center';
  heading.style.color = '#000000';
  heading.style.fontSize = '22px';
  heading.style.fontWeight = '700';
  heading.style.fontFamily = 'SimHei, "Microsoft YaHei", sans-serif';
  heading.style.lineHeight = '1.2';
  heading.style.marginBottom = '8px';

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
  footer.style.marginTop = '8px';
  footer.style.textAlign = 'center';
  footer.style.color = '#333333';
  footer.style.fontSize = '10px';
  footer.style.fontFamily = '"Microsoft YaHei", sans-serif';
  footer.style.lineHeight = '1.2';

  wrapper.appendChild(heading);
  wrapper.appendChild(content);
  wrapper.appendChild(footer);
  document.body.appendChild(wrapper);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    // Use the post-layout extent: absolutely positioned room details and long
    // rows can extend past the initial scrollWidth measured in the sizer.
    wrapper.style.width = `${Math.max(wrapper.scrollWidth, width + 24)}px`;
    const maxDimension = Math.max(wrapper.scrollWidth, wrapper.scrollHeight);
    const scale = Math.min(3, 12000 / maxDimension);
    const canvas = await html2canvas(wrapper, {
      backgroundColor: '#ffffff',
      // 3x improves name legibility; cap extreme rooms to avoid oversized
      // canvases on mobile browsers while preserving the entire chart.
      scale,
      useCORS: true,
    });
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

export async function exportToPDF(element: HTMLElement, filename: string, title?: string) {
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

  pdf.save(`${filename}.pdf`);
}

export async function exportToSVG(element: HTMLElement, filename: string, title?: string) {
  const exportTitle = title || filename;
  const width = Math.max(element.scrollWidth, element.clientWidth, 900);
  const clone = element.cloneNode(true) as HTMLElement;

  // Render to canvas first for accurate measurement
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-100000px';
  wrapper.style.top = '0';
  wrapper.style.width = `${width}px`;
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  const contentHeight = wrapper.scrollHeight;
  document.body.removeChild(wrapper);

  const padding = 20;
  const titleHeight = 40;
  const footerHeight = 30;
  const totalHeight = padding + titleHeight + contentHeight + footerHeight + padding;
  const totalWidth = width + padding * 2;

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
