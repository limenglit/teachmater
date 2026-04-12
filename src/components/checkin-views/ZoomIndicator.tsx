import { ZoomIn, RotateCcw } from 'lucide-react';

interface Props {
  scale: number;
  onReset: () => void;
}

export default function ZoomIndicator({ scale, onReset }: Props) {
  const pct = Math.round(scale * 100);
  const isZoomed = Math.abs(scale - 1) > 0.05;

  if (!isZoomed) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-1 animate-in fade-in duration-200">
      <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full border border-primary/20">
        <ZoomIn className="w-3 h-3" />
        <span>{pct}%</span>
      </div>
      <button
        onClick={onReset}
        className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        复位
      </button>
    </div>
  );
}
