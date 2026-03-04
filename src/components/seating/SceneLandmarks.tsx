import { useState, useRef, useEffect, ReactNode } from 'react';
import { ArrowRightLeft } from 'lucide-react';

interface LandmarkItem {
  label: string;
  emoji?: string;
  /** render as bordered box with text (like 窗) instead of plain emoji */
  boxStyle?: boolean;
}

interface SceneLandmarksProps {
  /** Top center landmark (e.g. 讲台, 白板, 主席台) */
  top?: LandmarkItem;
  /** Bottom center landmark (e.g. 入口, 出口) */
  bottom?: LandmarkItem;
  /** Left & right landmarks that can be swapped (e.g. 门 and 窗) */
  sides?: {
    left: LandmarkItem;
    right: LandmarkItem;
    swappable?: boolean;
  };
  /** Show side labels along the content (vertical text) */
  sideLabels?: boolean;
  children: ReactNode;
  printRef?: React.RefObject<HTMLDivElement>;
}

function LandmarkBadge({ item, draggable: isDraggable, offset, onMouseDown }: {
  item: LandmarkItem;
  draggable?: boolean;
  offset?: { x: number; y: number };
  onMouseDown?: (e: React.MouseEvent) => void;
}) {
  if (item.boxStyle) {
    return (
      <span
        className={`inline-flex items-center justify-center w-7 h-7 border-2 border-primary/40 rounded bg-primary/10 text-xs text-primary select-none ${isDraggable ? 'cursor-move' : 'cursor-default'}`}
        title={item.label}
        style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
        onMouseDown={onMouseDown}
      >
        {item.label}
      </span>
    );
  }

  return (
    <span
      className={`text-lg select-none ${isDraggable ? 'cursor-move' : 'cursor-default'}`}
      title={item.label}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
      onMouseDown={onMouseDown}
    >
      {item.emoji || item.label}
    </span>
  );
}

export default function SceneLandmarks({
  top,
  bottom,
  sides,
  sideLabels = true,
  children,
  printRef,
}: SceneLandmarksProps) {
  const [swapped, setSwapped] = useState(false);
  const [topOffset, setTopOffset] = useState({ x: 0, y: 0 });
  const [bottomOffset, setBottomOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{ target: 'top' | 'bottom'; startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - draggingRef.current.startX;
      const dy = e.clientY - draggingRef.current.startY;
      const setter = draggingRef.current.target === 'top' ? setTopOffset : setBottomOffset;
      setter({ x: draggingRef.current.origX + dx, y: draggingRef.current.origY + dy });
    };
    const handleMouseUp = () => { draggingRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startDrag = (target: 'top' | 'bottom', e: React.MouseEvent) => {
    e.stopPropagation();
    const offset = target === 'top' ? topOffset : bottomOffset;
    draggingRef.current = { target, startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  };

  const leftItem = swapped ? sides?.right : sides?.left;
  const rightItem = swapped ? sides?.left : sides?.right;
  const leftLabel = leftItem ? (leftItem.boxStyle ? `▢ ${leftItem.label}侧` : `${leftItem.emoji || ''} ${leftItem.label}侧`) : '';
  const rightLabel = rightItem ? (rightItem.boxStyle ? `▢ ${rightItem.label}侧` : `${rightItem.emoji || ''} ${rightItem.label}侧`) : '';

  return (
    <div ref={printRef}>
      {/* Top landmark bar */}
      {(top || sides) && (
        <div className="mb-4 flex items-center justify-center gap-3">
          {sides && leftItem && <LandmarkBadge item={leftItem} />}
          {top && (
            <div
              className="bg-primary/10 text-primary px-6 py-2 rounded-lg text-sm font-medium border border-primary/20 cursor-move select-none"
              style={{ transform: `translate(${topOffset.x}px, ${topOffset.y}px)` }}
              onMouseDown={e => startDrag('top', e)}
              title="拖动调整位置"
            >
              {top.emoji && `${top.emoji} `}{top.label}
            </div>
          )}
          {sides && rightItem && <LandmarkBadge item={rightItem} />}
          {sides?.swappable && (
            <button
              onClick={() => setSwapped(prev => !prev)}
              className="ml-1 p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="对换位置"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Content with optional side labels */}
      {sideLabels && sides ? (
        <div className="flex justify-center items-stretch gap-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <span className="[writing-mode:vertical-rl] tracking-widest">{leftLabel}</span>
          </div>
          <div className="flex-1 min-w-0">{children}</div>
          <div className="flex items-center text-sm text-muted-foreground">
            <span className="[writing-mode:vertical-rl] tracking-widest">{rightLabel}</span>
          </div>
        </div>
      ) : (
        children
      )}

      {/* Bottom landmark */}
      {bottom && (
        <div className="mt-4 flex items-center justify-center">
          <div
            className="bg-primary/10 text-primary px-6 py-2 rounded-lg text-sm font-medium border border-primary/20 cursor-move select-none"
            style={{ transform: `translate(${bottomOffset.x}px, ${bottomOffset.y}px)` }}
            onMouseDown={e => startDrag('bottom', e)}
            title="拖动调整位置"
          >
            {bottom.emoji && `${bottom.emoji} `}{bottom.label}
          </div>
        </div>
      )}
    </div>
  );
}
