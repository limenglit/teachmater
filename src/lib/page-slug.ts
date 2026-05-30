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

export function getPageStoragePath(userId: string, slug: string): string {
  return `${userId}/${encodeURIComponent(slug)}.html`;
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