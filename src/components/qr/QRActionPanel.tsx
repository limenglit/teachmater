import { useEffect, useRef, useState } from 'react';
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

export default function QRActionPanel({
  url,
  qrSize,
  scanTip,
  actions,
  qrContainerRef,
  className,
}: QRActionPanelProps) {
  const size = normalizeQrSize(qrSize);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);

  // 渲染成 <img>（PNG）而非 inline canvas/svg：
  // 微信内置浏览器只有对 <img> 才支持「长按识别二维码」，
  // 同时 PNG 位图在鸿蒙/荣耀等国产扫码引擎上兼容性最好。
  useEffect(() => {
    const canvas = canvasHostRef.current?.querySelector('canvas');
    if (!canvas) return;
    try {
      setPngUrl(canvas.toDataURL('image/png'));
    } catch {
      setPngUrl(null);
    }
  }, [url, size]);

  return (
    <div className={className || 'flex flex-col items-center gap-3 py-4'}>
      <div
        ref={qrContainerRef}
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
