/**
 * html2canvas 1.4.1 only understands rgb()/rgba()/hsl()/hsla() colors and throws
 * "Attempting to parse an unsupported color function" for anything else. The
 * Tailwind v4 build emits modern colors (opacity utilities such as bg-muted/10
 * compute to oklab(...)), which made every PNG/PDF export fail.
 *
 * While a capture runs, window.getComputedStyle is wrapped so every modern color
 * function in a computed value is rewritten to an rgba() that html2canvas can
 * parse. The browser itself converts the color: it is painted onto a 1x1
 * canvas and the pixel is read back. The original method is restored as soon
 * as the last concurrent capture finishes.
 */

type Sampler = (color: string) => [number, number, number, number] | null;

// One level of nested parentheses covers color-mix(in oklab, oklab(...) 30%, ...).
const MODERN_COLOR_RE = /\b(?:oklab|oklch|lab|lch|hwb|color-mix|color)\((?:[^()]|\([^()]*\))*\)/gi;
// Trailing "/ alpha" of a single color function, e.g. oklab(0.5 0.1 0.1 / 0.3).
const ALPHA_RE = /\/\s*([\d.]+)(%?)\s*\)$/;

const cache = new Map<string, string>();

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** Rewrites every modern color function in a CSS value to rgba(). */
export function rewriteModernColors(value: string, sample: Sampler): string {
  if (!value || value.indexOf('(') === -1) return value;
  return value.replace(MODERN_COLOR_RE, match => {
    const hit = cache.get(match);
    if (hit) return hit;
    let alpha: number | null = null;
    let opaque = match;
    if (!/^color-mix/i.test(match)) {
      const m = match.match(ALPHA_RE);
      if (m) {
        alpha = parseFloat(m[1]) / (m[2] ? 100 : 1);
        opaque = match.replace(ALPHA_RE, ')');
      }
    }
    const px = sample(opaque);
    if (!px) return match;
    const [r, g, b, a] = px;
    const finalAlpha = alpha ?? a / 255;
    const out = `rgba(${r}, ${g}, ${b}, ${round(Math.max(0, Math.min(1, finalAlpha)))})`;
    cache.set(match, out);
    return out;
  });
}

let sampleCtx: CanvasRenderingContext2D | null | undefined;

const canvasSampler: Sampler = color => {
  if (sampleCtx === undefined) {
    try {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      sampleCtx = c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null;
    } catch {
      sampleCtx = null;
    }
  }
  const ctx = sampleCtx;
  if (!ctx) return null;
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  } catch {
    return null;
  }
};

function wrapDeclaration(decl: CSSStyleDeclaration, sample: Sampler): CSSStyleDeclaration {
  return new Proxy(decl, {
    get(target, prop) {
      const v = Reflect.get(target, prop, target);
      if (typeof v === 'string') return rewriteModernColors(v, sample);
      if (typeof v === 'function') {
        if (prop === 'getPropertyValue') {
          return (name: string) => rewriteModernColors(target.getPropertyValue(name), sample);
        }
        if (prop === 'item') return (i: number) => target.item(i);
        return v.bind(target);
      }
      return v;
    },
  });
}

let depth = 0;
let original: typeof window.getComputedStyle | null = null;

/** Runs fn with computed styles reporting html2canvas-compatible colors. */
export async function withLegacyColors<T>(fn: () => Promise<T>, sample: Sampler = canvasSampler): Promise<T> {
  if (typeof window === 'undefined') return fn();
  if (depth === 0) {
    original = window.getComputedStyle;
    const base = original;
    window.getComputedStyle = function (el: Element, pseudo?: string | null) {
      return wrapDeclaration(base.call(window, el, pseudo), sample);
    } as typeof window.getComputedStyle;
  }
  depth++;
  try {
    return await fn();
  } finally {
    depth--;
    if (depth === 0 && original) {
      window.getComputedStyle = original;
      original = null;
    }
  }
}
