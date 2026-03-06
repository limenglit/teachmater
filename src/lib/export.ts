import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const COPYRIGHT_TEXT = '互动课堂派出品 |https://teachmater.lovable.app|洛阳理工学院|limeng@lit.edu.cn';

async function captureWithHeaderFooter(element: HTMLElement, title: string) {
  const clone = element.cloneNode(true) as HTMLElement;
  const width = Math.max(element.scrollWidth, element.clientWidth, 900);

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-100000px';
  wrapper.style.top = '0';
  wrapper.style.background = '#ffffff';
  wrapper.style.width = `${width}px`;
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
  content.appendChild(clone);

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

  try {
    return await html2canvas(wrapper, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    });
  } finally {
    document.body.removeChild(wrapper);
  }
}

export async function exportToPNG(element: HTMLElement, filename: string, title?: string) {
  const canvas = await captureWithHeaderFooter(element, title || filename);
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function exportToPDF(element: HTMLElement, filename: string, title?: string) {
  const canvas = await captureWithHeaderFooter(element, title || filename);
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
