import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportToPNG(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  });
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function exportToPDF(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  });
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
