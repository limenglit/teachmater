// PPT PDF export using jspdf
import jsPDF from 'jspdf';
import { PPTOutline, PPT_COLOR_SCHEMES, PPTFontSize } from './pptTypes';

export async function exportPDF(
  outline: PPTOutline,
  colorSchemeId: string,
  fontSizeConfig?: PPTFontSize
): Promise<void> {
  const colorScheme = PPT_COLOR_SCHEMES.find(c => c.id === colorSchemeId) || PPT_COLOR_SCHEMES[0];
  const titleFS = fontSizeConfig?.titleSize || 32;
  const bodyFS = fontSizeConfig?.bodySize || 16;
  
  // Create PDF in landscape 16:9 format
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [297, 167], // A4 width, 16:9 height
  });

  const pageWidth = 297;
  const pageHeight = 167;
  
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  };

  const primaryRgb = hexToRgb(colorScheme.primary);
  const textRgb = hexToRgb(colorScheme.text);
  const accentRgb = hexToRgb(colorScheme.accent);
  const secondaryRgb = hexToRgb(colorScheme.secondary);
  const bgRgb = hexToRgb(colorScheme.background);

  outline.slides.forEach((slide, index) => {
    if (index > 0) pdf.addPage();
    
    // Background
    pdf.setFillColor(...bgRgb);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    if (slide.type === 'title') {
      // Title slide
      pdf.setFontSize(titleFS + 4);
      pdf.setTextColor(...primaryRgb);
      pdf.text(slide.title, pageWidth / 2, 70, { align: 'center' });
      
      if (slide.subtitle) {
        pdf.setFontSize(bodyFS);
        pdf.setTextColor(...textRgb);
        pdf.text(slide.subtitle, pageWidth / 2, 90, { align: 'center' });
      }
      
      if (outline.keywords.length > 0) {
        pdf.setFontSize(bodyFS - 6);
        pdf.setTextColor(...accentRgb);
        pdf.text(outline.keywords.join('  •  '), pageWidth / 2, 110, { align: 'center' });
      }
    } else if (slide.type === 'toc') {
      // Table of contents
      pdf.setFontSize(24);
      pdf.setTextColor(...primaryRgb);
      pdf.text(slide.title, 20, 25);
      
      if (slide.bullets) {
        pdf.setFontSize(14);
        pdf.setTextColor(...textRgb);
        slide.bullets.forEach((item, i) => {
          pdf.text(`${i + 1}. ${item}`, 30, 45 + i * 12);
        });
      }
    } else if (slide.type === 'section') {
      // Section divider
      pdf.setFillColor(...primaryRgb);
      pdf.rect(0, 60, pageWidth, 35, 'F');
      
      pdf.setFontSize(28);
      pdf.setTextColor(255, 255, 255);
      pdf.text(slide.title, pageWidth / 2, 82, { align: 'center' });
    } else if (slide.type === 'conclusion') {
      // Conclusion slide
      pdf.setFontSize(24);
      pdf.setTextColor(...primaryRgb);
      pdf.text(slide.title, 20, 25);
      
      if (slide.bullets) {
        pdf.setFontSize(14);
        pdf.setTextColor(...textRgb);
        slide.bullets.forEach((item, i) => {
          pdf.text(`✓ ${item}`, 25, 50 + i * 14);
        });
      }
    } else if (slide.type === 'two-column') {
      // Two-column layout
      pdf.setFontSize(22);
      pdf.setTextColor(...primaryRgb);
      pdf.text(slide.title, 20, 22);
      
      // Accent line
      pdf.setFillColor(...accentRgb);
      pdf.rect(20, 26, 40, 1.5, 'F');
      
      // Left column
      if (slide.leftTitle) {
        pdf.setFontSize(14);
        pdf.setTextColor(...secondaryRgb);
        pdf.text(slide.leftTitle, 25, 42);
      }
      if (slide.leftBullets) {
        pdf.setFontSize(11);
        pdf.setTextColor(...textRgb);
        slide.leftBullets.forEach((item, i) => {
          pdf.text(`• ${item}`, 28, 54 + i * 10);
        });
      }
      
      // Vertical divider
      pdf.setDrawColor(...accentRgb);
      pdf.setLineWidth(0.3);
      pdf.line(pageWidth / 2, 35, pageWidth / 2, 150);
      
      // Right column
      if (slide.rightTitle) {
        pdf.setFontSize(14);
        pdf.setTextColor(...secondaryRgb);
        pdf.text(slide.rightTitle, pageWidth / 2 + 10, 42);
      }
      if (slide.rightBullets) {
        pdf.setFontSize(11);
        pdf.setTextColor(...textRgb);
        slide.rightBullets.forEach((item, i) => {
          pdf.text(`• ${item}`, pageWidth / 2 + 13, 54 + i * 10);
        });
      }
    } else if (slide.type === 'image-text') {
      // Image-text layout
      pdf.setFontSize(22);
      pdf.setTextColor(...primaryRgb);
      pdf.text(slide.title, 20, 22);
      
      // Image placeholder
      pdf.setFillColor(...accentRgb);
      pdf.roundedRect(20, 35, 110, 100, 3, 3, 'F');
      pdf.setFontSize(32);
      pdf.setTextColor(255, 255, 255);
      pdf.text('🖼️', 70, 85, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(slide.imagePlaceholder || '图片占位符', 75, 115, { align: 'center' });
      
      // Text content
      if (slide.bullets) {
        pdf.setFontSize(12);
        pdf.setTextColor(...textRgb);
        slide.bullets.forEach((item, i) => {
          pdf.text(`• ${item}`, 145, 50 + i * 14);
        });
      }
    } else if (slide.type === 'comparison') {
      // Comparison layout
      pdf.setFontSize(22);
      pdf.setTextColor(...primaryRgb);
      pdf.text(slide.title, 20, 22);
      
      // Left box
      pdf.setFillColor(...primaryRgb);
      pdf.roundedRect(20, 35, 115, 110, 5, 5, 'F');
      if (slide.leftTitle) {
        pdf.setFontSize(16);
        pdf.setTextColor(255, 255, 255);
        pdf.text(slide.leftTitle, 78, 50, { align: 'center' });
      }
      if (slide.leftBullets) {
        pdf.setFontSize(11);
        slide.leftBullets.forEach((item, i) => {
          pdf.text(`• ${item}`, 28, 68 + i * 12);
        });
      }
      
      // VS
      pdf.setFontSize(18);
      pdf.setTextColor(...accentRgb);
      pdf.text('VS', pageWidth / 2, 90, { align: 'center' });
      
      // Right box
      pdf.setFillColor(...secondaryRgb);
      pdf.roundedRect(162, 35, 115, 110, 5, 5, 'F');
      if (slide.rightTitle) {
        pdf.setFontSize(16);
        pdf.setTextColor(255, 255, 255);
        pdf.text(slide.rightTitle, 220, 50, { align: 'center' });
      }
      if (slide.rightBullets) {
        pdf.setFontSize(11);
        slide.rightBullets.forEach((item, i) => {
          pdf.text(`• ${item}`, 170, 68 + i * 12);
        });
      }
    } else if (slide.type === 'quote') {
      // Quote layout
      pdf.setFontSize(22);
      pdf.setTextColor(...primaryRgb);
      pdf.text(slide.title, 20, 22);
      
      // Quote mark
      pdf.setFontSize(72);
      pdf.setTextColor(...accentRgb);
      pdf.text('"', 20, 65);
      
      // Quote text
      if (slide.quoteText) {
        pdf.setFontSize(18);
        pdf.setTextColor(...textRgb);
        const lines = pdf.splitTextToSize(slide.quoteText, 220);
        pdf.text(lines, 45, 75);
      }
      
      // Author
      if (slide.quoteAuthor) {
        pdf.setFontSize(12);
        pdf.setTextColor(...secondaryRgb);
        pdf.text(`— ${slide.quoteAuthor}`, pageWidth - 40, 130, { align: 'right' });
      }
    } else if (slide.type === 'timeline') {
      // Timeline layout
      pdf.setFontSize(22);
      pdf.setTextColor(...primaryRgb);
      pdf.text(slide.title, 20, 22);
      
      // Timeline line
      pdf.setDrawColor(...accentRgb);
      pdf.setLineWidth(1);
      pdf.line(30, 85, pageWidth - 30, 85);
      
      // Timeline items
      const items = slide.timelineItems || [];
      const spacing = items.length > 1 ? (pageWidth - 80) / (items.length - 1) : 0;
      items.forEach((item, i) => {
        const x = 40 + i * spacing;
        // Dot
        pdf.setFillColor(...primaryRgb);
        pdf.circle(x, 85, 4, 'F');
        // Year
        pdf.setFontSize(12);
        pdf.setTextColor(...primaryRgb);
        pdf.text(item.year, x, 72, { align: 'center' });
        // Text
        pdf.setFontSize(9);
        pdf.setTextColor(...textRgb);
        const textLines = pdf.splitTextToSize(item.text, 40);
        pdf.text(textLines, x, 98, { align: 'center' });
      });
    } else {
      // Default content slide
      pdf.setFontSize(22);
      pdf.setTextColor(...primaryRgb);
      pdf.text(slide.title, 20, 22);
      
      // Accent line
      pdf.setFillColor(...accentRgb);
      pdf.rect(20, 26, 40, 1.5, 'F');
      
      if (slide.bullets) {
        pdf.setFontSize(13);
        pdf.setTextColor(...textRgb);
        slide.bullets.forEach((item, i) => {
          pdf.text(`• ${item}`, 25, 45 + i * 14);
        });
      }
    }

    // Page number (except title)
    if (index > 0) {
      pdf.setFontSize(9);
      pdf.setTextColor(...accentRgb);
      pdf.text(`${index}`, pageWidth - 15, pageHeight - 8);
    }
  });

  pdf.save(`${outline.title || 'presentation'}.pdf`);
}
