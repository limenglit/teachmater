import { memo, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { qrRenderProps, normalizeQrSize } from '@/lib/qr-config';

interface QRActionPanelProps {
  url: string;
  qrSize?: number;
  scanTip?: string;
  actions?: ReactNode;
  qrContainerRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}

function QRActionPanel({
  url,
  qrSize,
  scanTip,
  actions,
  qrContainerRef,
  className,
}: QRActionPanelProps) {
  const size = normalizeQrSize(qrSize);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);

  // 渲染成 <img>（PNG）而非 inline canvas/svg：
  // 微信内置浏览器只有对 <img> 才支持「长按识别二维码」，
  // 同时 PNG 位图在鸿蒙/荣耀等国产扫码引擎上兼容性最好。
  //
  // 性能：使用 canvas.toBlob（异步、不阻塞主线程）替代同步的 toDataURL，
  // 避免在座位图等大场景下生成二维码时出现明显卡顿；同时用 objectURL 代替
  // 长 base64 字符串，减少一次大字符串的内存与 React 属性开销。
  useEffect(() => {
    let cancelled = false;

    const release = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    const build = () => {
      const canvas = canvasHostRef.current?.querySelector('canvas');
      if (!canvas) return;
      try {
        canvas.toBlob((blob) => {
          if (cancelled) return;
          if (!blob) {
            setPngUrl(null);
            return;
          }
          release();
          const next = URL.createObjectURL(blob);
          objectUrlRef.current = next;
          setPngUrl(next);
        }, 'image/png');
      } catch {
        if (!cancelled) setPngUrl(null);
      }
    };

    setPngUrl(null);
    // 等 qrcode.react 完成本帧绘制后再取像素，避免读到空白 canvas。
    const raf = requestAnimationFrame(build);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      release();
    };
  }, [url, size]);

  return (
    <div className={className || 'flex flex-col items-center gap-3 py-4'}>
      <div
        ref={qrContainerRef}
        data-qr-ready={pngUrl ? 'true' : 'false'}
        className="p-4 rounded-xl border border-border shadow-sm"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        {/* 离屏 canvas：用于生成 PNG 与下载 */}
        <div ref={canvasHostRef} className={pngUrl ? 'hidden' : undefined}>
          <QRCodeCanvas value={url} {...qrRenderProps(size)} />
        </div>
        {pngUrl ? (
          <img
            src={pngUrl}
            width={size}
            height={size}
            alt="二维码，可长按识别或使用相机扫码"
            style={{ display: 'block', width: size, height: size, imageRendering: 'pixelated' }}
            draggable={false}
          />
        ) : null}
      </div>
      {scanTip ? (
        <p className="text-[11px] leading-4 text-muted-foreground text-center">{scanTip}</p>
      ) : null}
      <p className="text-[11px] leading-4 text-muted-foreground text-center break-all max-w-[280px]">{url}</p>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{actions}</div> : null}
    </div>
  );
}

// 二维码内容变化频率极低，但常挂在高频刷新的面板（签到倒计时、实时人数）内，
// memo 可避免每秒重复渲染 canvas 造成的卡顿。
export default memo(QRActionPanel);
