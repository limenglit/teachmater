// PPT export using pptxgenjs
import pptxgen from 'pptxgenjs';
import { PPTOutline, PPT_COLOR_SCHEMES, PPTFontSize } from './pptTypes';

export async function exportPPTX(
  outline: PPTOutline,
  colorSchemeId: string,
  templateId: string,
  fontFace: string = 'Microsoft YaHei',
  fontSizeConfig?: PPTFontSize
): Promise<void> {
  const colorScheme = PPT_COLOR_SCHEMES.find(c => c.id === colorSchemeId) || PPT_COLOR_SCHEMES[0];
  const titleFS = fontSizeConfig?.titleSize || 32;
  const bodyFS = fontSizeConfig?.bodySize || 16;
  const captionFS = fontSizeConfig?.captionSize || 12;
  
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
        x: 0.5, y: 2.5, w: '90%', h: 1.5,
        fontSize: titleFS + 12,
        bold: true, color: primaryColor, fontFace, align: 'center',
      });
      if (slide.subtitle) {
        pptSlide.addText(slide.subtitle, {
          x: 0.5, y: 4.2, w: '90%', h: 0.8,
          fontSize: bodyFS + 4, color: textColor, fontFace, align: 'center',
        });
      }
      if (outline.keywords.length > 0) {
        pptSlide.addText(outline.keywords.join('  •  '), {
          x: 0.5, y: 5.2, w: '90%', h: 0.5,
          fontSize: captionFS, color: accentColor, fontFace, align: 'center',
        });
      }
    } else if (slide.type === 'toc') {
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '90%',
        fontSize: titleFS, bold: true, color: primaryColor, fontFace,
      });
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`${i + 1}. ${item}`, {
            x: 1, y: 1.2 + i * 0.6, w: '80%',
            fontSize: bodyFS + 2, color: textColor, fontFace,
          });
        });
      }
    } else if (slide.type === 'section') {
      pptSlide.addShape('rect', {
        x: 0, y: 2.2, w: '100%', h: 1.5,
        fill: { color: primaryColor },
      });
      pptSlide.addText(slide.title, {
        x: 0.5, y: 2.4, w: '90%',
        fontSize: titleFS + 4, bold: true, color: 'FFFFFF', fontFace, align: 'center',
      });
    } else if (slide.type === 'conclusion') {
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '90%',
        fontSize: titleFS, bold: true, color: primaryColor, fontFace,
      });
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`✓ ${item}`, {
            x: 0.8, y: 1.4 + i * 0.7, w: '85%',
            fontSize: bodyFS + 2, color: textColor, fontFace,
          });
        });
      }
    } else if (slide.type === 'two-column') {
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '90%',
        fontSize: titleFS - 4, bold: true, color: primaryColor, fontFace,
      });
      pptSlide.addShape('rect', {
        x: 0.5, y: 0.9, w: 1.5, h: 0.06,
        fill: { color: accentColor },
      });
      if (slide.leftTitle) {
        pptSlide.addText(slide.leftTitle, {
          x: 0.5, y: 1.2, w: '42%',
          fontSize: bodyFS + 2, bold: true, color: secondaryColor, fontFace,
        });
      }
      if (slide.leftBullets) {
        slide.leftBullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 0.6, y: 1.6 + i * 0.5, w: '42%',
            fontSize: bodyFS - 2, color: textColor, fontFace,
          });
        });
      }
      pptSlide.addShape('rect', {
        x: 4.9, y: 1.2, w: 0.02, h: 3.5,
        fill: { color: accentColor },
      });
      if (slide.rightTitle) {
        pptSlide.addText(slide.rightTitle, {
          x: 5.1, y: 1.2, w: '42%',
          fontSize: bodyFS + 2, bold: true, color: secondaryColor, fontFace,
        });
      }
      if (slide.rightBullets) {
        slide.rightBullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 5.2, y: 1.6 + i * 0.5, w: '42%',
            fontSize: bodyFS - 2, color: textColor, fontFace,
          });
        });
      }
    } else if (slide.type === 'image-text') {
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '90%',
        fontSize: titleFS - 4, bold: true, color: primaryColor, fontFace,
      });
      if (slide.imageUrl) {
        try {
          pptSlide.addImage({
            path: slide.imageUrl, x: 0.5, y: 1.1, w: 4, h: 3.5,
          });
        } catch {
          pptSlide.addShape('rect', { x: 0.5, y: 1.1, w: 4, h: 3.5, fill: { color: accentColor } });
          pptSlide.addText('🖼️', { x: 0.5, y: 2.4, w: 4, h: 1, fontSize: 48, align: 'center', fontFace });
        }
      } else {
        pptSlide.addShape('rect', { x: 0.5, y: 1.1, w: 4, h: 3.5, fill: { color: accentColor } });
        pptSlide.addText('🖼️', { x: 0.5, y: 2.4, w: 4, h: 1, fontSize: 48, align: 'center', fontFace });
        pptSlide.addText(slide.imagePlaceholder || '图片占位符', {
          x: 0.5, y: 3.4, w: 4, h: 0.5, fontSize: captionFS, align: 'center', color: 'FFFFFF', fontFace,
        });
      }
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 5, y: 1.3 + i * 0.6, w: '48%',
            fontSize: bodyFS, color: textColor, fontFace,
          });
        });
      }
    } else if (slide.imageUrl && !['title', 'section'].includes(slide.type)) {
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '55%',
        fontSize: titleFS - 4, bold: true, color: primaryColor, fontFace,
      });
      pptSlide.addShape('rect', { x: 0.5, y: 0.9, w: 1.5, h: 0.06, fill: { color: accentColor } });
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 0.8, y: 1.2 + i * 0.65, w: '50%',
            fontSize: bodyFS, color: textColor, fontFace,
          });
        });
      }
      try {
        pptSlide.addImage({ path: slide.imageUrl, x: 6, y: 1.1, w: 3.5, h: 3.5 });
      } catch { /* ignore image errors */ }
    } else if (slide.type === 'comparison') {
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '90%',
        fontSize: titleFS - 4, bold: true, color: primaryColor, fontFace,
      });
      pptSlide.addShape('roundRect', { x: 0.5, y: 1.1, w: 4.3, h: 3.8, fill: { color: primaryColor } });
      if (slide.leftTitle) {
        pptSlide.addText(slide.leftTitle, {
          x: 0.6, y: 1.2, w: 4.1, fontSize: bodyFS + 4, bold: true, color: 'FFFFFF', fontFace, align: 'center',
        });
      }
      if (slide.leftBullets) {
        slide.leftBullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 0.8, y: 1.8 + i * 0.55, w: 3.8, fontSize: bodyFS - 2, color: 'FFFFFF', fontFace,
          });
        });
      }
      pptSlide.addText('VS', {
        x: 4.5, y: 2.5, w: 1, h: 0.8, fontSize: 24, bold: true, color: accentColor, fontFace, align: 'center',
      });
      pptSlide.addShape('roundRect', { x: 5.2, y: 1.1, w: 4.3, h: 3.8, fill: { color: secondaryColor } });
      if (slide.rightTitle) {
        pptSlide.addText(slide.rightTitle, {
          x: 5.3, y: 1.2, w: 4.1, fontSize: bodyFS + 4, bold: true, color: 'FFFFFF', fontFace, align: 'center',
        });
      }
      if (slide.rightBullets) {
        slide.rightBullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 5.4, y: 1.8 + i * 0.55, w: 3.8, fontSize: bodyFS - 2, color: 'FFFFFF', fontFace,
          });
        });
      }
    } else if (slide.type === 'quote') {
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '90%',
        fontSize: titleFS - 4, bold: true, color: primaryColor, fontFace,
      });
      pptSlide.addText('"', {
        x: 0.5, y: 1.2, w: 1, fontSize: 96, color: accentColor, fontFace: 'Georgia',
      });
      if (slide.quoteText) {
        pptSlide.addText(slide.quoteText, {
          x: 1.2, y: 2, w: '75%', fontSize: bodyFS + 8, italic: true, color: textColor, fontFace,
        });
      }
      if (slide.quoteAuthor) {
        pptSlide.addText(`— ${slide.quoteAuthor}`, {
          x: 1.2, y: 3.8, w: '75%', fontSize: bodyFS, color: secondaryColor, fontFace, align: 'right',
        });
      }
    } else if (slide.type === 'timeline') {
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '90%',
        fontSize: titleFS - 4, bold: true, color: primaryColor, fontFace,
      });
      pptSlide.addShape('rect', { x: 0.5, y: 2.5, w: 9, h: 0.04, fill: { color: accentColor } });
      const items = slide.timelineItems || [];
      const spacing = items.length > 1 ? 8 / (items.length - 1) : 0;
      items.forEach((item, i) => {
        const x = 0.8 + i * spacing;
        pptSlide.addShape('ellipse', { x: x - 0.1, y: 2.4, w: 0.25, h: 0.25, fill: { color: primaryColor } });
        pptSlide.addText(item.year, {
          x: x - 0.5, y: 1.8, w: 1, fontSize: bodyFS - 2, bold: true, color: primaryColor, fontFace, align: 'center',
        });
        pptSlide.addText(item.text, {
          x: x - 0.7, y: 2.9, w: 1.5, fontSize: captionFS - 1, color: textColor, fontFace, align: 'center',
        });
      });
    } else {
      // Default content slide
      pptSlide.addText(slide.title, {
        x: 0.5, y: 0.3, w: '90%',
        fontSize: titleFS - 4, bold: true, color: primaryColor, fontFace,
      });
      pptSlide.addShape('rect', { x: 0.5, y: 0.9, w: 1.5, h: 0.06, fill: { color: accentColor } });
      if (slide.bullets) {
        slide.bullets.forEach((item, i) => {
          pptSlide.addText(`• ${item}`, {
            x: 0.8, y: 1.2 + i * 0.65, w: '85%',
            fontSize: bodyFS, color: textColor, fontFace,
          });
        });
      }
    }

    // Page number (except title)
    if (index > 0) {
      pptSlide.addText(`${index}`, {
        x: 9, y: 5, w: 0.5, fontSize: captionFS - 2, color: accentColor, fontFace,
      });
    }
  });

  await pptx.writeFile({ fileName: `${outline.title || 'presentation'}.pptx` });
}
