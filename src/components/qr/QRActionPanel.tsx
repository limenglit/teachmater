import type { ReactNode, RefObject } from 'react';
import { QRCodeSVG } from 'qrcode.react';

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
  qrSize = 200,
  scanTip,
  actions,
  qrContainerRef,
  className,
}: QRActionPanelProps) {
  return (
    <div className={className || 'flex flex-col items-center gap-3 py-4'}>
      <div ref={qrContainerRef} className="bg-background p-4 rounded-xl border border-border shadow-sm">
        <QRCodeSVG value={url} size={qrSize} level="M" />
      </div>
      {scanTip ? (
        <p className="text-[11px] leading-4 text-muted-foreground text-center">{scanTip}</p>
      ) : null}
      <p className="text-[11px] leading-4 text-muted-foreground text-center break-all max-w-[280px]">{url}</p>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{actions}</div> : null}
    </div>
  );
}
