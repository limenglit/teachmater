// PPT export using pptxgenjs
import pptxgen from 'pptxgenjs';
import { PPTOutline, PPTColorScheme, PPT_COLOR_SCHEMES } from './pptTypes';

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
    } else {
      // Content slide
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
