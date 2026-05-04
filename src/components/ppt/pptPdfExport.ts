import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PPTOutline, PPT_COLOR_SCHEMES, type PPTFontSize, type PPTSlide } from './pptTypes';

const SLIDE_WIDTH = 1600;
const SLIDE_HEIGHT = 900;

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, styles?: Partial<CSSStyleDeclaration>) {
  const element = document.createElement(tag);
  if (styles) Object.assign(element.style, styles);
  return element;
}

function addBox(root: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  const element = createElement('div', { position: 'absolute', ...styles });
  root.appendChild(element);
  return element;
}

function addText(
  root: HTMLElement,
  text: string,
  options: {
    left: number;
    top: number;
    width: number;
    color: string;
    fontSize: number;
    fontFamily: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: 'left' | 'center' | 'right';
    lineHeight?: number;
  },
) {
  const element = createElement('div', {
    position: 'absolute',
    left: `${options.left}px`,
    top: `${options.top}px`,
    width: `${options.width}px`,
    color: options.color,
    fontSize: `${options.fontSize}px`,
    fontFamily: options.fontFamily,
    fontWeight: options.fontWeight || '400',
    fontStyle: options.fontStyle || 'normal',
    textAlign: options.textAlign || 'left',
    lineHeight: String(options.lineHeight || 1.45),
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  });
  element.textContent = text;
  root.appendChild(element);
  return element;
}

function addBullets(
  root: HTMLElement,
  bullets: string[] | undefined,
  options: {
    left: number;
    top: number;
    width: number;
    gap: number;
    fontSize: number;
    color: string;
    fontFamily: string;
    bullet?: string;
  },
) {
  if (!bullets?.length) return;
  bullets.forEach((item, index) => {
    addText(root, `${options.bullet || '•'} ${item}`, {
      left: options.left,
      top: options.top + index * options.gap,
      width: options.width,
      fontSize: options.fontSize,
      color: options.color,
      fontFamily: options.fontFamily,
    });
  });
}

function addImageOrPlaceholder(
  root: HTMLElement,
  slide: PPTSlide,
  colors: typeof PPT_COLOR_SCHEMES[number],
  fontFace: string,
) {
  if (slide.imageUrl) {
    const image = createElement('img', {
      position: 'absolute',
      left: '80px',
      top: '180px',
      width: '650px',
      height: '520px',
      objectFit: 'cover',
      borderRadius: '18px',
    }) as HTMLImageElement;
    image.src = slide.imageUrl;
    root.appendChild(image);
    return;
  }

  const box = addBox(root, {
    left: '80px',
    top: '180px',
    width: '650px',
    height: '520px',
    background: colors.accent,
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '120px',
  });
  box.textContent = '🖼️';

  addText(root, slide.imagePlaceholder || '图片占位符', {
    left: 110,
    top: 610,
    width: 590,
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: fontFace,
  });
}

function addTitle(root: HTMLElement, slide: PPTSlide, color: string, fontSize: number, fontFace: string) {
  addText(root, slide.title, {
    left: 80,
    top: 50,
    width: 1440,
    fontSize,
    color,
    fontFamily: fontFace,
    fontWeight: '700',
    lineHeight: 1.3,
  });
}

function renderSlide(
  slide: PPTSlide,
  outline: PPTOutline,
  slideIndex: number,
  colorSchemeId: string,
  fontFace: string,
  fontSizeConfig?: PPTFontSize,
) {
  const colors = PPT_COLOR_SCHEMES.find((scheme) => scheme.id === colorSchemeId) || PPT_COLOR_SCHEMES[0];
  const titleFS = fontSizeConfig?.titleSize || 32;
  const bodyFS = fontSizeConfig?.bodySize || 16;
  const captionFS = fontSizeConfig?.captionSize || 12;

  const root = createElement('div', {
    width: `${SLIDE_WIDTH}px`,
    height: `${SLIDE_HEIGHT}px`,
    position: 'relative',
    overflow: 'hidden',
    background: colors.background,
    color: colors.text,
    fontFamily: fontFace,
  });

  if (slide.type === 'title') {
    addText(root, slide.title, {
      left: 140,
      top: 250,
      width: 1320,
      fontSize: titleFS + 26,
      color: colors.primary,
      textAlign: 'center',
      fontFamily: fontFace,
      fontWeight: '700',
      lineHeight: 1.25,
    });
    if (slide.subtitle) {
      addText(root, slide.subtitle, {
        left: 180,
        top: 420,
        width: 1240,
        fontSize: bodyFS + 10,
        color: colors.text,
        textAlign: 'center',
        fontFamily: fontFace,
      });
    }
    if (outline.keywords.length > 0) {
      addText(root, outline.keywords.join('  •  '), {
        left: 180,
        top: 540,
        width: 1240,
        fontSize: captionFS + 8,
        color: colors.accent,
        textAlign: 'center',
        fontFamily: fontFace,
      });
    }
  } else if (slide.type === 'toc') {
    addTitle(root, slide, colors.primary, titleFS + 2, fontFace);
    addBullets(root, slide.bullets?.map((item, index) => `${index + 1}. ${item}`), {
      left: 130,
      top: 190,
      width: 1260,
      gap: 72,
      fontSize: bodyFS + 8,
      color: colors.text,
      fontFamily: fontFace,
      bullet: '',
    });
  } else if (slide.type === 'section') {
    addBox(root, {
      left: '0',
      top: '300px',
      width: '100%',
      height: '220px',
      background: colors.primary,
    });
    addText(root, slide.title, {
      left: 140,
      top: 360,
      width: 1320,
      fontSize: titleFS + 20,
      color: '#ffffff',
      textAlign: 'center',
      fontFamily: fontFace,
      fontWeight: '700',
      lineHeight: 1.25,
    });
  } else if (slide.type === 'conclusion') {
    addTitle(root, slide, colors.primary, titleFS + 4, fontFace);
    addBullets(root, slide.bullets, {
      left: 110,
      top: 200,
      width: 1320,
      gap: 78,
      fontSize: bodyFS + 8,
      color: colors.text,
      fontFamily: fontFace,
      bullet: '✓',
    });
  } else if (slide.type === 'two-column') {
    addTitle(root, slide, colors.primary, titleFS, fontFace);
    addBox(root, {
      left: '80px',
      top: '112px',
      width: '220px',
      height: '8px',
      background: colors.accent,
    });
    addBox(root, {
      left: '800px',
      top: '170px',
      width: '2px',
      height: '620px',
      background: colors.accent,
      opacity: '0.8',
    });
    if (slide.leftTitle) {
      addText(root, slide.leftTitle, {
        left: 110,
        top: 170,
        width: 610,
        fontSize: bodyFS + 10,
        color: colors.secondary,
        fontFamily: fontFace,
        fontWeight: '700',
      });
    }
    if (slide.rightTitle) {
      addText(root, slide.rightTitle, {
        left: 860,
        top: 170,
        width: 610,
        fontSize: bodyFS + 10,
        color: colors.secondary,
        fontFamily: fontFace,
        fontWeight: '700',
      });
    }
    addBullets(root, slide.leftBullets, {
      left: 110,
      top: 250,
      width: 610,
      gap: 58,
      fontSize: bodyFS + 2,
      color: colors.text,
      fontFamily: fontFace,
    });
    addBullets(root, slide.rightBullets, {
      left: 860,
      top: 250,
      width: 610,
      gap: 58,
      fontSize: bodyFS + 2,
      color: colors.text,
      fontFamily: fontFace,
    });
  } else if (slide.type === 'image-text') {
    addTitle(root, slide, colors.primary, titleFS, fontFace);
    addImageOrPlaceholder(root, slide, colors, fontFace);
    addBullets(root, slide.bullets, {
      left: 800,
      top: 220,
      width: 700,
      gap: 72,
      fontSize: bodyFS + 4,
      color: colors.text,
      fontFamily: fontFace,
    });
  } else if (slide.type === 'comparison') {
    addTitle(root, slide, colors.primary, titleFS, fontFace);
    addBox(root, {
      left: '80px',
      top: '180px',
      width: '610px',
      height: '560px',
      background: colors.primary,
      borderRadius: '24px',
    });
    addBox(root, {
      left: '910px',
      top: '180px',
      width: '610px',
      height: '560px',
      background: colors.secondary,
      borderRadius: '24px',
    });
    addText(root, 'VS', {
      left: 720,
      top: 410,
      width: 160,
      fontSize: 48,
      color: colors.accent,
      textAlign: 'center',
      fontFamily: fontFace,
      fontWeight: '700',
    });
    if (slide.leftTitle) {
      addText(root, slide.leftTitle, {
        left: 120,
        top: 220,
        width: 530,
        fontSize: bodyFS + 12,
        color: '#ffffff',
        textAlign: 'center',
        fontFamily: fontFace,
        fontWeight: '700',
      });
    }
    if (slide.rightTitle) {
      addText(root, slide.rightTitle, {
        left: 950,
        top: 220,
        width: 530,
        fontSize: bodyFS + 12,
        color: '#ffffff',
        textAlign: 'center',
        fontFamily: fontFace,
        fontWeight: '700',
      });
    }
    addBullets(root, slide.leftBullets, {
      left: 130,
      top: 320,
      width: 510,
      gap: 60,
      fontSize: bodyFS + 2,
      color: '#ffffff',
      fontFamily: fontFace,
    });
    addBullets(root, slide.rightBullets, {
      left: 960,
      top: 320,
      width: 510,
      gap: 60,
      fontSize: bodyFS + 2,
      color: '#ffffff',
      fontFamily: fontFace,
    });
  } else if (slide.type === 'quote') {
    addTitle(root, slide, colors.primary, titleFS, fontFace);
    addText(root, '"', {
      left: 80,
      top: 170,
      width: 120,
      fontSize: 140,
      color: colors.accent,
      fontFamily: 'Georgia',
    });
    if (slide.quoteText) {
      addText(root, slide.quoteText, {
        left: 220,
        top: 250,
        width: 1160,
        fontSize: bodyFS + 18,
        color: colors.text,
        fontFamily: fontFace,
        fontStyle: 'italic',
        lineHeight: 1.6,
      });
    }
    if (slide.quoteAuthor) {
      addText(root, `— ${slide.quoteAuthor}`, {
        left: 900,
        top: 700,
        width: 480,
        fontSize: bodyFS + 4,
        color: colors.secondary,
        textAlign: 'right',
        fontFamily: fontFace,
      });
    }
  } else if (slide.type === 'timeline') {
    addTitle(root, slide, colors.primary, titleFS, fontFace);
    addBox(root, {
      left: '120px',
      top: '460px',
      width: '1360px',
      height: '6px',
      background: colors.accent,
    });
    const items = slide.timelineItems || [];
    const spacing = items.length > 1 ? 1240 / (items.length - 1) : 0;
    items.forEach((item, index) => {
      const x = 180 + index * spacing;
      addBox(root, {
        left: `${x - 12}px`,
        top: '443px',
        width: '24px',
        height: '24px',
        background: colors.primary,
        borderRadius: '999px',
      });
      addText(root, item.year, {
        left: x - 80,
        top: 370,
        width: 160,
        fontSize: bodyFS + 2,
        color: colors.primary,
        textAlign: 'center',
        fontFamily: fontFace,
        fontWeight: '700',
      });
      addText(root, item.text, {
        left: x - 110,
        top: 500,
        width: 220,
        fontSize: captionFS + 2,
        color: colors.text,
        textAlign: 'center',
        fontFamily: fontFace,
      });
    });
  } else {
    addTitle(root, slide, colors.primary, titleFS, fontFace);
    addBox(root, {
      left: '80px',
      top: '112px',
      width: '220px',
      height: '8px',
      background: colors.accent,
    });
    addBullets(root, slide.bullets, {
      left: 110,
      top: 180,
      width: 1320,
      gap: 72,
      fontSize: bodyFS + 4,
      color: colors.text,
      fontFamily: fontFace,
    });
  }

  if (slideIndex > 0) {
    addText(root, String(slideIndex), {
      left: 1460,
      top: 835,
      width: 80,
      fontSize: captionFS + 4,
      color: colors.accent,
      textAlign: 'right',
      fontFamily: fontFace,
    });
  }

  return root;
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
    });
  }));
}

async function captureSlide(node: HTMLElement) {
  await waitForImages(node);
  return html2canvas(node, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  });
}

export async function exportPDF(
  outline: PPTOutline,
  colorSchemeId: string,
  fontFace: string = 'Microsoft YaHei',
  fontSizeConfig?: PPTFontSize,
): Promise<void> {
  const host = createElement('div', {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${SLIDE_WIDTH}px`,
    background: '#ffffff',
  });
  document.body.appendChild(host);

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [297, 167],
  });

  try {
    for (let index = 0; index < outline.slides.length; index++) {
      const slideNode = renderSlide(outline.slides[index], outline, index, colorSchemeId, fontFace, fontSizeConfig);
      host.appendChild(slideNode);
      const canvas = await captureSlide(slideNode);
      const image = canvas.toDataURL('image/png');
      if (index > 0) {
        pdf.addPage([297, 167], 'landscape');
      }
      pdf.addImage(image, 'PNG', 0, 0, 297, 167);
      host.removeChild(slideNode);
    }

    pdf.save(`${outline.title || 'presentation'}.pdf`);
  } finally {
    document.body.removeChild(host);
  }
}
