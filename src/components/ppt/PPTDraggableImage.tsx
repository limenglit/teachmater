import { useState, useRef, useCallback, useEffect } from 'react';
import { Move } from 'lucide-react';

interface ImagePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  src: string;
  position: ImagePosition;
  containerRef: React.RefObject<HTMLDivElement>;
  onChange: (pos: ImagePosition) => void;
}

export default function PPTDraggableImage({ src, position, containerRef, onChange }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const imgRef = useRef<HTMLDivElement>(null);

  const getContainerBounds = useCallback(() => {
    if (!containerRef.current) return { width: 600, height: 400 };
    const rect = containerRef.current.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [containerRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSelected(true);
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position.x, position.y]);

  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSelected(true);
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: position.width,
      h: position.height,
    };
  }, [position.width, position.height]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMove = (e: MouseEvent) => {
      const bounds = getContainerBounds();
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        const newX = Math.max(0, Math.min(100 - position.width, dragStart.current.posX + (dx / bounds.width) * 100));
        const newY = Math.max(0, Math.min(100 - position.height, dragStart.current.posY + (dy / bounds.height) * 100));
        onChange({ ...position, x: newX, y: newY });
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        const newW = Math.max(10, Math.min(100 - position.x, resizeStart.current.w + (dx / bounds.width) * 100));
        const newH = Math.max(10, Math.min(100 - position.y, resizeStart.current.h + (dy / bounds.height) * 100));
        onChange({ ...position, width: newW, height: newH });
      }
    };

    const handleUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, isResizing, position, onChange, getContainerBounds]);

  // Deselect on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (imgRef.current && !imgRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      ref={imgRef}
      className={`absolute group ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${position.width}%`,
        height: `${position.height}%`,
        zIndex: 10,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); setIsSelected(true); }}
    >
      <img
        src={src}
        alt=""
        className="w-full h-full object-contain rounded pointer-events-none select-none"
        draggable={false}
      />

      {/* Selection border */}
      {isSelected && (
        <>
          <div className="absolute inset-0 border-2 border-primary rounded pointer-events-none" />
          {/* Move handle */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
            <Move className="w-3 h-3" />
          </div>
          {/* Resize handle */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary rounded-sm cursor-se-resize shadow-sm"
            onMouseDown={handleResizeDown}
          />
          {/* Corner dots */}
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-primary rounded-full" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />
          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-primary rounded-full" />
        </>
      )}
    </div>
  );
}
