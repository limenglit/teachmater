import type { RefObject } from 'react';

function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

/** 二维码位图是否已经绘制完成（canvas 有尺寸 / img 已解码 / 存在 svg）。 */
export function isQrReady(root: HTMLElement | null | undefined): boolean {
  if (!root) return false;
  if (root.getAttribute('data-qr-ready') === 'true') return true;

  const img = root.querySelector('img') as HTMLImageElement | null;
  if (img && img.src && (img.complete ? img.naturalWidth > 0 : false)) return true;

  const canvas = root.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas && canvas.width > 0 && canvas.height > 0) return true;

  return !!root.querySelector('svg');
}

/** 在下载前等待二维码资源就绪，最长等待 timeoutMs。 */
export async function waitForQrReady(root: HTMLElement | null | undefined, timeoutMs = 3000): Promise<boolean> {
  if (isQrReady(root)) return true;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve());
    });
    if (isQrReady(root)) return true;
  }
  return false;
}

/**
 * 从二维码容器中导出 PNG。
 * QRActionPanel 渲染的是 canvas + PNG <img>（微信长按识别需要），
 * 不再有 inline <svg>，因此下载按 canvas → img → svg 的顺序回退。
 *
 * 性能：优先 canvas.toBlob（异步，不阻塞主线程），避免大尺寸二维码
 * 同步 toDataURL 造成的界面卡顿。
 */
export async function downloadQrFromContainer(root: HTMLElement | null | undefined, filename: string) {
  if (!root) throw new Error('QR not ready');
  const name = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;

  const ready = await waitForQrReady(root);
  if (!ready) throw new Error('QR not ready');

  const canvas = root.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas && canvas.width > 0) {
    const blob = await new Promise<Blob | null>(resolve => {
      try {
        canvas.toBlob(b => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });
    if (blob) {
      const url = URL.createObjectURL(blob);
      try {
        triggerDownload(url, name);
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      return;
    }
    triggerDownload(canvas.toDataURL('image/png'), name);
    return;
  }

  const img = root.querySelector('img') as HTMLImageElement | null;
  if (img && img.src && (img.src.startsWith('data:image/png') || img.src.startsWith('blob:'))) {
    triggerDownload(img.src, name);
    return;
  }

  const svg = root.querySelector('svg') as SVGSVGElement | null;
  if (!svg) throw new Error('QR not ready');
  await downloadSvgAsPng(svg, name);
}

/** @deprecated 使用 downloadQrFromContainer。 */
export function downloadQrPng(containerRef: RefObject<HTMLDivElement | null>, filename: string) {
  void downloadQrFromContainer(containerRef.current, filename);
}





export async function downloadSvgAsPng(svgElement: SVGSVGElement, filename: string) {
  const widthAttr = Number(svgElement.getAttribute('width'));
  const heightAttr = Number(svgElement.getAttribute('height'));
  const width = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : 256;
  const height = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : 256;

  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  if (!clonedSvg.getAttribute('xmlns')) {
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clonedSvg.getAttribute('xmlns:xlink')) {
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }

  const svgText = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load QR SVG image'));
      img.src = objectUrl;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to PNG'));
        }
      }, 'image/png');
    });

    const pngUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(pngUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
