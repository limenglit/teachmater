import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';

const COPYRIGHT_TEXT = '教创搭子出品 |https://teachmater.lovable.app|洛阳理工学院|limeng@lit.edu.cn';

interface ExportQrCodeOptions {
  value: string;
  className?: string;
}

interface ExportCaptureOptions {
  qrCode?: ExportQrCodeOptions;
}

async function renderQrBadge(container: HTMLElement, qrCode: ExportQrCodeOptions) {
  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.right = '20px';
  host.style.bottom = '12px';
  host.style.background = '#ffffff';
  host.style.border = '1px solid #e5e7eb';
  host.style.borderRadius = '10px';
  host.style.padding = '10px';
  host.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
  host.style.display = 'flex';
  host.style.flexDirection = 'column';
  host.style.alignItems = 'center';
  host.style.gap = '4px';

  const root = createRoot(host);
  root.render(
    createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' } },
      createElement(QRCodeSVG, { value: qrCode.value, size: 92, level: 'M' }),
      createElement(
        'div',
        {
          style: {
            fontSize: '11px',
            color: '#111827',
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontWeight: '600',
            textAlign: 'center',
            maxWidth: '120px',
            wordBreak: 'break-word',
            lineHeight: '1.2',
          },
        },
        qrCode.className || '当前班级'
      ),
      createElement(
        'div',
        {
          style: {
            fontSize: '10px',
            color: '#4b5563',
            fontFamily: '"Microsoft YaHei", sans-serif',
            textAlign: 'center',
          },
        },
        '签到二维码'
      )
    )
  );

  container.appendChild(host);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  return () => {
    root.unmount();
    if (host.parentNode) host.parentNode.removeChild(host);
  };
}

async function captureWithHeaderFooter(element: HTMLElement, title: string, options?: ExportCaptureOptions) {
  const clone = element.cloneNode(true) as HTMLElement;

  // Neutralize zoom transforms and remove scroll clipping on the clone subtree
  // so the export captures the full content centered, regardless of on-screen scale.
  const neutralize = (root: HTMLElement) => {
    const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
    for (const el of all) {
      const s = el.style;
      // Reset transform/scale that might shrink content for screen zoom
      if (s.transform) s.transform = 'none';
      if (s.zoom) s.zoom = '';
      // Allow internal scroll containers to expand to full natural size
      const overflow = s.overflow || s.overflowX || s.overflowY;
      if (overflow && overflow !== 'visible') {
        s.overflow = 'visible';
        s.overflowX = 'visible';
        s.overflowY = 'visible';
      }
      // Drop fixed max-height/height constraints used for on-screen viewport
      if (s.maxHeight) s.maxHeight = 'none';
      if (s.maxWidth) s.maxWidth = 'none';
    }
    // Also strip Tailwind classes like max-h-[80vh] / overflow-auto via style override above isn't enough — add inline overrides via attribute
    root.querySelectorAll<HTMLElement>('[class*="overflow"], [class*="max-h"]').forEach(el => {
      el.style.overflow = 'visible';
      el.style.overflowX = 'visible';
      el.style.overflowY = 'visible';
      el.style.maxHeight = 'none';
      el.style.transform = 'none';
    });
  };
  neutralize(clone);

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

  const width = Math.max(naturalWidth, element.scrollWidth, element.clientWidth, 900);

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-100000px';
  wrapper.style.top = '0';
  wrapper.style.background = '#ffffff';
  wrapper.style.width = `${width + 40}px`;
  wrapper.style.padding = '22px 20px 16px';
  wrapper.style.boxSizing = 'border-box';

  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.textAlign = 'center';
  heading.style.color = '#000000';
  heading.style.fontSize = '28px';
  heading.style.fontWeight = '700';
  heading.style.fontFamily = 'SimHei, "Microsoft YaHei", sans-serif';
  heading.style.lineHeight = '1.2';
  heading.style.marginBottom = '16px';

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
  footer.style.marginTop = '14px';
  footer.style.textAlign = 'center';
  footer.style.color = '#333333';
  footer.style.fontSize = '12px';
  footer.style.fontFamily = '"Microsoft YaHei", sans-serif';
  footer.style.lineHeight = '1.2';

  wrapper.appendChild(heading);
  wrapper.appendChild(content);
  wrapper.appendChild(footer);
  document.body.appendChild(wrapper);

  let cleanupQr: (() => void) | null = null;
  if (options?.qrCode?.value) {
    cleanupQr = await renderQrBadge(wrapper, options.qrCode);
  }

  try {
    return await html2canvas(wrapper, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    });
  } finally {
    cleanupQr?.();
    document.body.removeChild(wrapper);
  }
}

export async function exportToPNG(element: HTMLElement, filename: string, title?: string, options?: ExportCaptureOptions) {
  const canvas = await captureWithHeaderFooter(element, title || filename, options);
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function exportToPDF(element: HTMLElement, filename: string, title?: string, options?: ExportCaptureOptions) {
  const canvas = await captureWithHeaderFooter(element, title || filename, options);
  const imgData = canvas.toDataURL('image/png');
  const imgW = canvas.width;
  const imgH = canvas.height;

  // A4 dimensions in mm
  const pdfW = 210;
  const pdfH = (imgH * pdfW) / imgW;

  const pdf = new jsPDF({
    orientation: pdfH > 297 ? 'portrait' : (imgW > imgH ? 'landscape' : 'portrait'),
    unit: 'mm',
    format: 'a4',
  });

  const pageH = pdf.internal.pageSize.getHeight();
  const pageW = pdf.internal.pageSize.getWidth();
  const ratio = Math.min(pageW / imgW, pageH / imgH) * 0.95;
  const w = imgW * ratio;
  const h = imgH * ratio;
  const x = (pageW - w) / 2;
  const y = 10;

  pdf.addImage(imgData, 'PNG', x, y, w, h);
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
  const canvas = await captureWithHeaderFooter(element, exportTitle);
  const dataUrl = canvas.toDataURL('image/png');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${canvas.width / 2}" height="${canvas.height / 2}" viewBox="0 0 ${canvas.width / 2} ${canvas.height / 2}">
  <image width="${canvas.width / 2}" height="${canvas.height / 2}" href="${dataUrl}" />
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
