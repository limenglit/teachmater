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
