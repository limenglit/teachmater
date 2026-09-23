/**
 * 统一「对外分享链接」的域名来源。
 *
 * 背景：教师通常在 Lovable 预览/编辑器域名（id-preview--xxx.lovable.app、
 * *.lovableproject.com、localhost）下生成二维码。这些域名：
 *  - 在微信内置浏览器（尤其 iPhone/WKWebView）中会被拦截或无法打开；
 *  - 在国内网络环境下解析/访问不稳定，iOS 相机扫码后 Safari 直接白屏。
 *
 * 因此凡是给学生扫码用的链接，一律改写为线上正式域名，
 * 保证 iOS 微信扫一扫、长按识别、Safari 打开都能正常访问。
 */

/** 线上正式域名（自定义域名优先）。 */
export const PUBLIC_SHARE_ORIGIN = 'https://teachermate.org.cn';

/** 这些 host 属于开发/预览环境，学生端无法可靠访问。 */
function isNonPublicHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return true;
  if (h.endsWith('.local')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  if (h.endsWith('.lovableproject.com')) return true;
  if (h.endsWith('.lovable.dev')) return true;
  // 预览域名形如 id-preview--<uuid>.lovable.app，正式发布域名是 teachmater.lovable.app
  if (h.endsWith('.lovable.app') && (h.startsWith('id-preview--') || h.includes('--'))) return true;
  return false;
}

/**
 * 返回用于二维码 / 分享链接的站点根地址（无结尾斜杠）。
 * 在正式域名下即为当前域名，在预览或本机环境下回退到线上正式域名。
 */
export function getShareOrigin(): string {
  if (typeof window === 'undefined') return PUBLIC_SHARE_ORIGIN;
  const { origin, hostname, protocol } = window.location;
  if (!origin || protocol === 'file:') return PUBLIC_SHARE_ORIGIN;
  if (isNonPublicHost(hostname)) return PUBLIC_SHARE_ORIGIN;
  return origin.replace(/\/+$/, '');
}

/** 拼接分享用的完整链接，path 以 / 开头。 */
export function buildShareUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getShareOrigin()}${p}`;
}
