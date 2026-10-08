/**
 * 平台统一二维码参数。
 *
 * 目标：兼容 iOS 相机 / 安卓原生相机 / 鸿蒙(HarmonyOS) / 荣耀(MagicOS) 扫码
 * 以及微信「扫一扫」与「长按识别」。
 *
 * 关键点：
 * - 纠错等级 Q(25%)：投屏反光、打印模糊、被局部遮挡时仍可识别。
 * - 静区(quiet zone) 4 个模块：部分国产扫码引擎无静区时会直接识别失败。
 * - 纯黑白 + 不透明白底：避免主题深色模式下反色导致无法识别。
 * - 最小渲染尺寸 200px：低端手机摄像头在小图上易失焦。
 */
export const QR_LEVEL = 'M' as const;
export const QR_MARGIN_MODULES = 4;
export const QR_FG_COLOR = '#000000';
export const QR_BG_COLOR = '#FFFFFF';
export const QR_MIN_SIZE = 240;

/** 保证二维码渲染尺寸不低于可靠识别的下限。 */
export function normalizeQrSize(size?: number): number {
  if (typeof size !== 'number' || !Number.isFinite(size)) return QR_MIN_SIZE;
  return Math.max(QR_MIN_SIZE, Math.round(size));
}

/** 统一的 qrcode.react 渲染参数。 */
export function qrRenderProps(size?: number, opts?: { allowSmall?: boolean }) {
  return {
    size: opts?.allowSmall ? Math.round(size ?? QR_MIN_SIZE) : normalizeQrSize(size),
    level: QR_LEVEL,
    marginSize: QR_MARGIN_MODULES,
    fgColor: QR_FG_COLOR,
    bgColor: QR_BG_COLOR,
  };
}


const ALNUM_RE = /^[0-9A-Z $%*+\-./:]+$/;
/**
 * 把分享链接转换为二维码「字母数字模式」载荷：域名与路由不区分大小写、
 * 会话 ID 解析不区分大小写，大写后码点更少、模块更大，
 * 旧款/国产扫码引擎（鸿蒙、荣耀、iPhone 相机远距投屏）识别率显著提高。
 * 含查询参数等无法安全大写的链接保持原样。
 */
export function toQrPayload(url: string): string {
  if (!url || /[?#]/.test(url)) return url;
  const up = url.toUpperCase();
  return ALNUM_RE.test(up) ? up : url;
}
