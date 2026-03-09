// PPT export using pptxgenjs
import pptxgen from 'pptxgenjs';
import { PPTOutline, PPT_COLOR_SCHEMES } from './pptTypes';

export async function exportPPTX(
  outline: PPTOutline,
  colorSchemeId: string,
  templateId: string
): Promise<void> {
  const colorScheme = PPT_COLOR_SCHEMES.find(c => c.id === colorSchemeId) || PPT_COLOR_SCHEMES[0];
  
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = outline.title;
  pptx.author = 'TeachMate PPT Generator';
  
  // Define master slide colors
  const primaryColor = colorScheme.primary.replace('#', '');
  const bgColor = colorScheme.background.replace('#', '');
  const textColor = colorScheme.text.replace('#', '');
  const accentColor = colorScheme.accent.replace('#', '');
  const secondaryColor = colorScheme.secondary.replace('#', '');

  outline.slides.forEach((slide, index) => {
    const pptSlide = pptx.addSlide();
    pptSlide.background = { color: bgColor };

    if (slide.type === 'title') {
      // Title slide
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 2.5,
        w: '90%',
        h: 1.5,
        fontSize: 44,
        bold: true,
        color: primaryColor,
        fontFace: 'Microsoft YaHei',
        align: 'center',
      });
      if (slide.subtitle) {
        pptSlide.addText(slide.subtitle, {
          x: 0.5,
          y: 4.2,
          w: '90%',
          h: 0.8,
          fontSize: 20,
          color: textColor,
          fontFace: 'Microsoft YaHei',
          align: 'center',
        });
      }
      // Keywords as tags
      if (outline.keywords.length > 0) {
        pptSlide.addText(outline.keywords.join('  •  '), {
          x: 0.5,
          y: 5.2,
          w: '90%',
          h: 0.5,
          fontSize: 12,
          color: accentColor,
          fontFace: 'Microsoft YaHei',
          align: 'center',
        });
      }
    } else if (slide.type === 'toc') {
      // Table of contents
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 32,
        bold: true,
        color: primaryColor,
        fontFace: 'Microsoft YaHei',
      });
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`${i + 1}. ${item}`, {
            x: 1,
            y: 1.2 + i * 0.6,
            w: '80%',
            fontSize: 18,
            color: textColor,
            fontFace: 'Microsoft YaHei',
          });
        });
      }
    } else if (slide.type === 'section') {
      // Section divider
      pptSlide.addShape('rect', {
        x: 0,
        y: 2.2,
        w: '100%',
        h: 1.5,
        fill: { color: primaryColor },
      });
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 2.4,
        w: '90%',
        fontSize: 36,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Microsoft YaHei',
        align: 'center',
      });
    } else if (slide.type === 'conclusion') {
      // Conclusion slide
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 32,
        bold: true,
        color: primaryColor,
        fontFace: 'Microsoft YaHei',
      });
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`✓ ${item}`, {
            x: 0.8,
            y: 1.4 + i * 0.7,
            w: '85%',
            fontSize: 18,
            color: textColor,
            fontFace: 'Microsoft YaHei',
          });
        });
      }
    } else if (slide.type === 'two-column') {
      // Two-column layout
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 28,
        bold: true,
        color: primaryColor,
        fontFace: 'Microsoft YaHei',
      });
      pptSlide.addShape('rect', {
        x: 0.5,
        y: 0.9,
        w: 1.5,
        h: 0.06,
        fill: { color: accentColor },
      });
      
      // Left column header
      if (slide.leftTitle) {
        pptSlide.addText(slide.leftTitle, {
          x: 0.5,
          y: 1.2,
          w: '42%',
          fontSize: 18,
          bold: true,
          color: secondaryColor,
          fontFace: 'Microsoft YaHei',
        });
      }
      // Left column bullets
      if (slide.leftBullets) {
        slide.leftBullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 0.6,
            y: 1.6 + i * 0.5,
            w: '42%',
            fontSize: 14,
            color: textColor,
            fontFace: 'Microsoft YaHei',
          });
        });
      }
      
      // Vertical divider
      pptSlide.addShape('rect', {
        x: 4.9,
        y: 1.2,
        w: 0.02,
        h: 3.5,
        fill: { color: accentColor },
      });
      
      // Right column header
      if (slide.rightTitle) {
        pptSlide.addText(slide.rightTitle, {
          x: 5.1,
          y: 1.2,
          w: '42%',
          fontSize: 18,
          bold: true,
          color: secondaryColor,
          fontFace: 'Microsoft YaHei',
        });
      }
      // Right column bullets
      if (slide.rightBullets) {
        slide.rightBullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 5.2,
            y: 1.6 + i * 0.5,
            w: '42%',
            fontSize: 14,
            color: textColor,
            fontFace: 'Microsoft YaHei',
          });
        });
      }
    } else if (slide.type === 'image-text') {
      // Image-text layout
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 28,
        bold: true,
        color: primaryColor,
        fontFace: 'Microsoft YaHei',
      });
      
      // Image (left side) - use real image if available
      if (slide.imageUrl) {
        try {
          pptSlide.addImage({
            path: slide.imageUrl,
            x: 0.5,
            y: 1.1,
            w: 4,
            h: 3.5,
          });
        } catch {
          // Fallback to placeholder
          pptSlide.addShape('rect', {
            x: 0.5, y: 1.1, w: 4, h: 3.5,
            fill: { color: accentColor },
          });
          pptSlide.addText('🖼️', {
            x: 0.5, y: 2.4, w: 4, h: 1,
            fontSize: 48, align: 'center', fontFace: 'Microsoft YaHei',
          });
        }
      } else {
        pptSlide.addShape('rect', {
          x: 0.5,
          y: 1.1,
          w: 4,
          h: 3.5,
          fill: { color: accentColor },
        });
        pptSlide.addText('🖼️', {
          x: 0.5,
          y: 2.4,
          w: 4,
          h: 1,
          fontSize: 48,
          align: 'center',
          fontFace: 'Microsoft YaHei',
        });
        pptSlide.addText(slide.imagePlaceholder || '图片占位符', {
          x: 0.5,
          y: 3.4,
          w: 4,
          h: 0.5,
          fontSize: 12,
          align: 'center',
          color: 'FFFFFF',
          fontFace: 'Microsoft YaHei',
        });
      }
      
      // Text content (right side)
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 5,
            y: 1.3 + i * 0.6,
            w: '48%',
            fontSize: 16,
            color: textColor,
            fontFace: 'Microsoft YaHei',
          });
        });
      }

      // For any slide type with imageUrl that isn't image-text, add as corner image
    } else if (slide.imageUrl && !['title', 'section'].includes(slide.type)) {
      // This handles content/conclusion/etc slides with user-added images
      // Standard layout first
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '55%',
        fontSize: 28, bold: true, color: primaryColor, fontFace: 'Microsoft YaHei',
      });
      pptSlide.addShape('rect', {
        x: 0.5, y: 0.9, w: 1.5, h: 0.06,
        fill: { color: accentColor },
      });
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 0.8, y: 1.2 + i * 0.65, w: '50%',
            fontSize: 16, color: textColor, fontFace: 'Microsoft YaHei',
          });
        });
      }
      try {
        pptSlide.addImage({
          path: slide.imageUrl,
          x: 6, y: 1.1, w: 3.5, h: 3.5,
        });
      } catch { /* ignore image errors */ }
    } else if (slide.type === 'comparison') {
      // Comparison layout
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 28,
        bold: true,
        color: primaryColor,
        fontFace: 'Microsoft YaHei',
      });
      
      // Left side (Option A)
      pptSlide.addShape('roundRect', {
        x: 0.5,
        y: 1.1,
        w: 4.3,
        h: 3.8,
        fill: { color: primaryColor },
      });
      if (slide.leftTitle) {
        pptSlide.addText(slide.leftTitle, {
          x: 0.6,
          y: 1.2,
          w: 4.1,
          fontSize: 20,
          bold: true,
          color: 'FFFFFF',
          fontFace: 'Microsoft YaHei',
          align: 'center',
        });
      }
      if (slide.leftBullets) {
        slide.leftBullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 0.8,
            y: 1.8 + i * 0.55,
            w: 3.8,
            fontSize: 14,
            color: 'FFFFFF',
            fontFace: 'Microsoft YaHei',
          });
        });
      }
      
      // VS indicator
      pptSlide.addText('VS', {
        x: 4.5,
        y: 2.5,
        w: 1,
        h: 0.8,
        fontSize: 24,
        bold: true,
        color: accentColor,
        fontFace: 'Microsoft YaHei',
        align: 'center',
      });
      
      // Right side (Option B)
      pptSlide.addShape('roundRect', {
        x: 5.2,
        y: 1.1,
        w: 4.3,
        h: 3.8,
        fill: { color: secondaryColor },
      });
      if (slide.rightTitle) {
        pptSlide.addText(slide.rightTitle, {
          x: 5.3,
          y: 1.2,
          w: 4.1,
          fontSize: 20,
          bold: true,
          color: 'FFFFFF',
          fontFace: 'Microsoft YaHei',
          align: 'center',
        });
      }
      if (slide.rightBullets) {
        slide.rightBullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 5.4,
            y: 1.8 + i * 0.55,
            w: 3.8,
            fontSize: 14,
            color: 'FFFFFF',
            fontFace: 'Microsoft YaHei',
          });
        });
      }
    } else if (slide.type === 'quote') {
      // Quote layout
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 28,
        bold: true,
        color: primaryColor,
        fontFace: 'Microsoft YaHei',
      });
      
      // Large quote mark
      pptSlide.addText('"', {
        x: 0.5,
        y: 1.2,
        w: 1,
        fontSize: 96,
        color: accentColor,
        fontFace: 'Georgia',
      });
      
      // Quote text
      if (slide.quoteText) {
        pptSlide.addText(slide.quoteText, {
          x: 1.2,
          y: 2,
          w: '75%',
          fontSize: 24,
          italic: true,
          color: textColor,
          fontFace: 'Microsoft YaHei',
        });
      }
      
      // Quote author
      if (slide.quoteAuthor) {
        pptSlide.addText(`— ${slide.quoteAuthor}`, {
          x: 1.2,
          y: 3.8,
          w: '75%',
          fontSize: 16,
          color: secondaryColor,
          fontFace: 'Microsoft YaHei',
          align: 'right',
        });
      }
    } else if (slide.type === 'timeline') {
      // Timeline layout
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 28,
        bold: true,
        color: primaryColor,
        fontFace: 'Microsoft YaHei',
      });
      
      // Timeline line
      pptSlide.addShape('rect', {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 0.04,
        fill: { color: accentColor },
      });
      
      // Timeline items
      const items = slide.timelineItems || [];
      const spacing = items.length > 1 ? 8 / (items.length - 1) : 0;
      items.forEach((item, i) => {
        const x = 0.8 + i * spacing;
        // Dot
        pptSlide.addShape('ellipse', {
          x: x - 0.1,
          y: 2.4,
          w: 0.25,
          h: 0.25,
          fill: { color: primaryColor },
        });
        // Year
        pptSlide.addText(item.year, {
          x: x - 0.5,
          y: 1.8,
          w: 1,
          fontSize: 14,
          bold: true,
          color: primaryColor,
          fontFace: 'Microsoft YaHei',
          align: 'center',
        });
        // Text
        pptSlide.addText(item.text, {
          x: x - 0.7,
          y: 2.9,
          w: 1.5,
          fontSize: 11,
          color: textColor,
          fontFace: 'Microsoft YaHei',
          align: 'center',
        });
      });
    } else {
      // Default content slide
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 28,
        bold: true,
        color: primaryColor,
        fontFace: 'Microsoft YaHei',
      });
      // Accent line
      pptSlide.addShape('rect', {
        x: 0.5,
        y: 0.9,
        w: 1.5,
        h: 0.06,
        fill: { color: accentColor },
      });
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 0.8,
            y: 1.2 + i * 0.65,
            w: '85%',
            fontSize: 16,
            color: textColor,
            fontFace: 'Microsoft YaHei',
          });
        });
      }
    }

    // Page number (except title)
    if (index > 0) {
      pptSlide.addText(`${index}`, {
        x: 9,
        y: 5,
        w: 0.5,
        fontSize: 10,
        color: accentColor,
        fontFace: 'Microsoft YaHei',
      });
    }
  });

  await pptx.writeFile({ fileName: `${outline.title || 'presentation'}.pptx` });
}
