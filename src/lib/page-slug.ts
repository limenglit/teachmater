const HTML_EXTENSION_RE = /\.html?$/i;
const SAFE_SLUG_RE = /^[\p{L}\p{N}](?:[\p{L}\p{N}._-]*[\p{L}\p{N}])?$/u;

export const PAGE_SLUG_MIN_LENGTH = 1;
export const PAGE_SLUG_MAX_LENGTH = 80;

export function normalizePageSlug(raw: string): string {
  return raw
    .normalize('NFC')
    .trim()
    .replace(HTML_EXTENSION_RE, '')
    .replace(/[\u3000\s]+/gu, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/[A-Z]/g, (c) => c.toLowerCase());
}

export function validatePageSlug(slug: string): string | null {
  const length = [...slug].length;
  if (length < PAGE_SLUG_MIN_LENGTH || length > PAGE_SLUG_MAX_LENGTH) {
    return `页面名长度需为 ${PAGE_SLUG_MIN_LENGTH}-${PAGE_SLUG_MAX_LENGTH} 个字符`;
  }
  if (!SAFE_SLUG_RE.test(slug)) {
    return '页面名需包含中文、英文字母或数字，可搭配 -、_、.；文件名里的空格和标点会自动转换为 -';
  }
  return null;
}

function toUtf8Hex(value: string): string {
  return Array.from(new TextEncoder().encode(value.normalize('NFC')))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function getPageStoragePath(userId: string, slug: string): string {
  return `${userId}/${toUtf8Hex(slug)}.html`;
}

export function getPublicPageUrl(origin: string, username: string, slug: string): string {
  return `${origin}/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}

export function decodePageRouteParam(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i;

export const PAGE_IMAGES_DIR = 'images';
export const MAX_PAGE_IMAGE_BYTES = 5 * 1024 * 1024;

/** 规范化图片文件名：保留扩展名，非安全字符转为 -，中文转为 unicode 安全的短横线形式。 */
export function normalizePageImageName(raw: string): string {
  const name = raw.normalize('NFC').trim();
  const extMatch = name.match(IMAGE_EXT_RE);
  const ext = (extMatch ? extMatch[0] : '').toLowerCase();
  const base = (ext ? name.slice(0, name.length - ext.length) : name)
    .replace(/[\u3000\s]+/gu, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .toLowerCase();
  return `${base || 'image'}${ext || '.png'}`;
}

export function isSupportedPageImage(fileName: string): boolean {
  return IMAGE_EXT_RE.test(fileName);
}

/** 图片在 storage 中的路径：<userId>/images/<name> */
export function getPageImageStoragePath(userId: string, fileName: string): string {
  return `${userId}/${PAGE_IMAGES_DIR}/${fileName}`;
}

export function getPageImagesFolder(userId: string): string {
  return `${userId}/${PAGE_IMAGES_DIR}`;
}

/**
 * 在 HTML 中注入 <base href="...">，让页面里的相对路径（如 images/a.png）
 * 指向该用户在存储中的资源目录。已有 <base> 时不覆盖。
 *
 * 注意：<base> 会改变锚点（#id）等所有相对 URL 的解析基准，渲染公开页面时
 * 请改用 rewriteRelativeAssetUrls。
 */
export function injectAssetBase(html: string, baseUrl: string): string {
  if (!baseUrl) return html;
  if (/<base\s/i.test(html)) return html;
  const tag = `<base href="${baseUrl}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${tag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${tag}</head>`);
  }
  return `${tag}\n${html}`;
}

const ABSOLUTE_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#|\?)/i;

function joinAssetUrl(baseUrl: string, relative: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${relative.replace(/^\.\//, '')}`;
}

/**
 * 只把资源类相对路径（img/script/link/source/video/audio 等）改写为存储绝对地址，
 * 不影响页面内锚点（#toc）与普通 <a> 链接。
 */
export function rewriteRelativeAssetUrls(html: string, baseUrl: string): string {
  if (!baseUrl || !html) return html;

  const rewriteAttr = (tagRe: RegExp, attr: string, input: string) =>
    input.replace(tagRe, (tag) => {
      const attrRe = new RegExp(`(\\s${attr}\\s*=\\s*)(["'])(.*?)\\2`, 'i');
      return tag.replace(attrRe, (full, prefix, quote, value: string) => {
        const trimmed = value.trim();
        if (!trimmed || ABSOLUTE_URL_RE.test(trimmed)) return full;
        return `${prefix}${quote}${joinAssetUrl(baseUrl, trimmed)}${quote}`;
      });
    });

  let out = html;
  const mediaTagRe = /<(?:img|script|source|video|audio|embed|track|input)\b[^>]*>/gi;
  out = rewriteAttr(mediaTagRe, 'src', out);
  out = rewriteAttr(/<(?:video|img)\b[^>]*>/gi, 'poster', out);
  out = rewriteAttr(/<link\b[^>]*>/gi, 'href', out);
  return out;
}
