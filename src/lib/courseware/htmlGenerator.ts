// Self-contained HTML generator: turns Outline + CoursewareConfig into a standalone HTML file
// (single document with inline CSS/JS, no external network deps required at runtime apart from optional Google Fonts).

import type {
  CoursewareConfig,
  CustomColors,
  FontPairId,
  Outline,
  PaletteId,
  Slide,
  Style,
  TransitionId,
} from '@/stores/coursewareStore';

interface PaletteTriplet {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  fg: string;
  muted: string;
}

const PALETTES: Record<Exclude<PaletteId, 'custom'>, PaletteTriplet> = {
  'calm-blue':       { primary: '#2563eb', secondary: '#60a5fa', accent: '#06b6d4', bg: '#ffffff', fg: '#0f172a', muted: '#64748b' },
  'energetic-orange':{ primary: '#ea580c', secondary: '#fb923c', accent: '#f59e0b', bg: '#fffbeb', fg: '#1c1917', muted: '#78716c' },
  'tech-gray':       { primary: '#334155', secondary: '#94a3b8', accent: '#0ea5e9', bg: '#f8fafc', fg: '#0f172a', muted: '#64748b' },
  'green-growth':    { primary: '#059669', secondary: '#34d399', accent: '#10b981', bg: '#f0fdf4', fg: '#064e3b', muted: '#4b5563' },
  'dark-navy':       { primary: '#60a5fa', secondary: '#94a3b8', accent: '#22d3ee', bg: '#0f172a', fg: '#e2e8f0', muted: '#94a3b8' },
  'warm-beige':      { primary: '#92400e', secondary: '#d97706', accent: '#b45309', bg: '#fef9f0', fg: '#451a03', muted: '#78716c' },
};

const STYLE_BG: Partial<Record<Style, Partial<PaletteTriplet>>> = {
  minimalist: { bg: '#fafafa', fg: '#171717' },
  'dark-neon': { bg: '#0a0a0a', fg: '#e5e5e5' },
  editorial: { bg: '#ffffff', fg: '#111827' },
  infographic: { bg: '#ecfdf5', fg: '#064e3b' },
};

const FONT_PAIRS: Record<FontPairId, { heading: string; body: string; google?: string }> = {
  'noto-sc':           { heading: '"Noto Serif SC", serif', body: '"Noto Sans SC", sans-serif', google: 'family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@600;700' },
  'inter-source':      { heading: '"Source Serif Pro", serif', body: 'Inter, system-ui, sans-serif', google: 'family=Inter:wght@400;500;700&family=Source+Serif+Pro:wght@600;700' },
  'playfair-source':   { heading: '"Playfair Display", serif', body: '"Source Sans Pro", sans-serif', google: 'family=Playfair+Display:wght@600;700&family=Source+Sans+Pro:wght@400;600' },
  'space-grotesk-dm':  { heading: '"Space Grotesk", sans-serif', body: '"DM Sans", sans-serif', google: 'family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@600;700' },
  'caveat-noto':       { heading: 'Caveat, cursive', body: '"Noto Sans SC", sans-serif', google: 'family=Caveat:wght@600;700&family=Noto+Sans+SC:wght@400;500;700' },
  'jb-mono':           { heading: '"JetBrains Mono", monospace', body: 'Inter, system-ui, sans-serif', google: 'family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@600;700' },
};

function resolvePalette(palette: PaletteId, custom: CustomColors, style: Style): PaletteTriplet {
  const base: PaletteTriplet =
    palette === 'custom'
      ? { primary: custom.primary, secondary: custom.secondary, accent: custom.accent, bg: '#ffffff', fg: '#0f172a', muted: '#64748b' }
      : { ...PALETTES[palette] };
  return { ...base, ...(STYLE_BG[style] || {}) };
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bullets(items: string[] | undefined): string {
  const arr = (items || []).map((x) => (x || '').trim()).filter(Boolean);
  if (!arr.length) return '';
  return `<ul class="bullets">${arr.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
}

function renderSlide(slide: Slide, index: number, total: number, cfg: CoursewareConfig): string {
  const title = escapeHtml(slide.title || '');
  let body = '';
  switch (slide.type) {
    case 'title':
      body = `<div class="title-slide"><h1>${title}</h1>${slide.bullets?.[0] ? `<p class="subtitle">${escapeHtml(slide.bullets[0])}</p>` : ''}</div>`;
      return wrap(body, slide, index, total, cfg, 'title');
    case 'toc':
      body = `<h2>${title}</h2>${bullets(slide.bullets)}`;
      break;
    case 'two-column':
    case 'comparison':
      body = `<h2>${title}</h2>
        <div class="two-col">
          <div class="col"><h3>${escapeHtml(slide.leftTitle || '')}</h3>${bullets(slide.leftBullets)}</div>
          <div class="col"><h3>${escapeHtml(slide.rightTitle || '')}</h3>${bullets(slide.rightBullets)}</div>
        </div>`;
      break;
    case 'image-text':
      body = `<h2>${title}</h2>
        <div class="image-text">
          <div class="img-ph"><span>IMG</span></div>
          <div class="text">${bullets(slide.bullets)}</div>
        </div>`;
      break;
    case 'quote':
      body = `<div class="quote-slide">
        <blockquote>${escapeHtml(slide.quoteText || '')}</blockquote>
        ${slide.quoteAuthor ? `<cite>— ${escapeHtml(slide.quoteAuthor)}</cite>` : ''}
      </div>`;
      break;
    case 'timeline':
      body = `<h2>${title}</h2>
        <ol class="timeline">
          ${(slide.timelineItems || []).map((it) => `
            <li><span class="year">${escapeHtml(it.year)}</span><span class="text">${escapeHtml(it.text)}</span></li>
          `).join('')}
        </ol>`;
      break;
    case 'conclusion':
      body = `<div class="conclusion-slide"><h2>${title}</h2>${bullets(slide.bullets)}</div>`;
      break;
    case 'content':
    default:
      body = `<h2>${title}</h2>${bullets(slide.bullets)}`;
      break;
  }
  return wrap(body, slide, index, total, cfg, slide.type);
}

function wrap(inner: string, slide: Slide, index: number, total: number, cfg: CoursewareConfig, typeCls: string): string {
  const pageNum = cfg.showPageNumbers
    ? `<div class="page-num pn-${cfg.pageNumberPosition}">${index + 1} / ${total}</div>`
    : '';
  const footer = cfg.footer ? `<div class="footer">${escapeHtml(cfg.footer)}</div>` : '';
  const notes = slide.speakerNotes ? `<aside class="notes" hidden>${escapeHtml(slide.speakerNotes)}</aside>` : '';
  return `<section class="slide slide-${typeCls}" data-idx="${index}" data-slide-id="${escapeHtml(slide.id)}">
    <div class="slide-inner">${inner}</div>
    ${footer}${pageNum}${notes}
  </section>`;
}

function styleCss(style: Style, p: PaletteTriplet): string {
  switch (style) {
    case 'hand-drawn':
      return `.slide{border:2px dashed ${p.primary};border-radius:24px;} h1,h2,h3{font-family:Caveat,cursive;}`;
    case 'dark-neon':
      return `.slide{background:${p.bg};color:${p.fg};} h1,h2{text-shadow:0 0 12px ${p.accent};} .bullets li::marker{color:${p.accent};}`;
    case 'editorial':
      return `.slide-inner{max-width:90%;} h2{border-bottom:4px solid ${p.primary};padding-bottom:.4em;}`;
    case 'corporate':
      return `.slide{border-top:8px solid ${p.primary};}`;
    case 'creative':
      return `.slide{background:linear-gradient(135deg, ${p.bg} 0%, ${p.secondary}22 100%);}`;
    case 'infographic':
      return `.bullets li{background:${p.primary}11;padding:.6em .9em;border-left:4px solid ${p.primary};margin:.4em 0;border-radius:6px;list-style:none;}`;
    case 'minimalist':
      return `.slide{padding:6%;} h2{font-weight:300;letter-spacing:.02em;}`;
    case 'icon':
    default:
      return `.slide-inner h2::before{content:"◆";color:${p.accent};margin-right:.4em;}`;
  }
}

function transitionCss(t: TransitionId): string {
  switch (t) {
    case 'fade':
      return `.slide.active{animation:cw-fade .35s ease both;} @keyframes cw-fade{from{opacity:0}to{opacity:1}}`;
    case 'slide':
      return `.slide.active{animation:cw-slide .35s ease both;} @keyframes cw-slide{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}`;
    case 'zoom':
      return `.slide.active{animation:cw-zoom .35s ease both;} @keyframes cw-zoom{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}`;
    default:
      return '';
  }
}

export function generateCoursewareHtml(outline: Outline, config: CoursewareConfig): string {
  const p = resolvePalette(config.palette, config.customColors, config.style);
  const fonts = FONT_PAIRS[config.fontPair];
  const ratio = config.ratio === '16:9' ? '16 / 9' : '4 / 3';
  const fontsHref = fonts.google ? `https://fonts.googleapis.com/css2?${fonts.google}&display=swap` : '';
  const slidesHtml = outline.slides.map((s, i) => renderSlide(s, i, outline.slides.length, config)).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(outline.title)}</title>
${fontsHref ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${fontsHref}" rel="stylesheet">` : ''}
<style>
:root{
  --cw-primary:${p.primary}; --cw-secondary:${p.secondary}; --cw-accent:${p.accent};
  --cw-bg:${p.bg}; --cw-fg:${p.fg}; --cw-muted:${p.muted};
  --cw-font-h:${fonts.heading}; --cw-font-b:${fonts.body};
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#111;color:var(--cw-fg);font-family:var(--cw-font-b);}
.deck{display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px;}
.slide{position:relative;width:min(96vw,1280px);aspect-ratio:${ratio};background:var(--cw-bg);color:var(--cw-fg);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:4%;}
.slide-inner{width:100%;}
h1{font-family:var(--cw-font-h);font-size:clamp(28px,4.2vw,56px);margin:0 0 .3em;color:var(--cw-primary);}
h2{font-family:var(--cw-font-h);font-size:clamp(22px,3.2vw,40px);margin:0 0 .6em;color:var(--cw-primary);}
h3{font-family:var(--cw-font-h);font-size:clamp(18px,2vw,24px);margin:.2em 0 .4em;color:var(--cw-secondary);}
p,li{font-size:clamp(14px,1.6vw,20px);line-height:1.55;}
.subtitle{color:var(--cw-muted);font-size:clamp(16px,2vw,24px);}
.bullets{margin:0;padding-left:1.2em;}
.bullets li{margin:.35em 0;}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:32px;}
.image-text{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center;}
.img-ph{aspect-ratio:4/3;background:linear-gradient(135deg,var(--cw-secondary)33,var(--cw-primary)22);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--cw-muted);font-weight:600;letter-spacing:.2em;}
.quote-slide{text-align:center;}
.quote-slide blockquote{font-family:var(--cw-font-h);font-size:clamp(22px,3vw,36px);margin:0 0 .6em;color:var(--cw-primary);}
.quote-slide cite{color:var(--cw-muted);font-style:normal;}
.timeline{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.5em;}
.timeline li{display:flex;gap:1em;align-items:baseline;border-left:3px solid var(--cw-accent);padding-left:1em;}
.timeline .year{font-weight:700;color:var(--cw-accent);min-width:5em;}
.title-slide{text-align:center;}
.footer{position:absolute;left:4%;bottom:2%;color:var(--cw-muted);font-size:12px;}
.page-num{position:absolute;bottom:2%;color:var(--cw-muted);font-size:12px;}
.pn-left{left:4%}.pn-center{left:50%;transform:translateX(-50%)}.pn-right{right:4%}
${styleCss(config.style, p)}
${transitionCss(config.transition)}
@media print{
  body{background:#fff;}
  .deck{padding:0;gap:0;}
  .slide{box-shadow:none;border-radius:0;page-break-after:always;width:100%;}
}
</style>
</head>
<body>
<main class="deck" id="cw-deck">
${slidesHtml}
</main>
<script>
(function(){
  var slides=document.querySelectorAll('.slide');
  slides.forEach(function(s){s.classList.add('active');});
  document.addEventListener('keydown',function(e){
    if(e.key!=='ArrowDown'&&e.key!=='ArrowUp'&&e.key!=='PageDown'&&e.key!=='PageUp')return;
    var dir=(e.key==='ArrowDown'||e.key==='PageDown')?1:-1;
    var y=window.scrollY,h=window.innerHeight;
    var targets=Array.prototype.map.call(slides,function(s){return s.getBoundingClientRect().top+window.scrollY;});
    var idx=0;for(var i=0;i<targets.length;i++){if(targets[i]<=y+8)idx=i;}
    var next=Math.max(0,Math.min(slides.length-1,idx+dir));
    window.scrollTo({top:targets[next]-12,behavior:'smooth'});
    e.preventDefault();
  });
})();
</script>
</body>
</html>`;
}
