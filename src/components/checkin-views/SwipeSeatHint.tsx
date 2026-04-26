import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface Props {
  total: number;
  index: number;
  label?: string;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Compact mobile hint that shows the current recommended-seat label and lets
 * the user step through nearest empty seats with arrows (in addition to swipe).
 * Visual-only — does not change the user's actual assigned seat.
 */
export default function SwipeSeatHint({ total, index, label, onPrev, onNext }: Props) {
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-accent/40 border border-accent/60 px-3 py-2 text-xs">
      <button
        onClick={onPrev}
        disabled={index === 0}
        className="shrink-0 w-7 h-7 rounded-md bg-card border border-border flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        aria-label="上一个推荐空位"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0 text-center text-foreground/80">
        <div className="flex items-center justify-center gap-1 text-[10px] text-accent-foreground/70 leading-none mb-0.5">
          <Sparkles className="w-3 h-3" />
          推荐附近空位 ({index + 1}/{total})
        </div>
        <div className="font-medium truncate">{label || '附近空位'}</div>
        <div className="text-[10px] text-muted-foreground leading-none mt-0.5">← 左右滑动地图切换 →</div>
      </div>
      <button
        onClick={onNext}
        disabled={index >= total - 1}
        className="shrink-0 w-7 h-7 rounded-md bg-card border border-border flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        aria-label="下一个推荐空位"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
