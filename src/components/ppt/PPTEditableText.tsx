import { useState, useRef, useCallback, useEffect } from 'react';
import { Move, Bold, Italic } from 'lucide-react';
import { PPT_FONTS } from './pptTypes';

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

export interface TextBlockPosition {
  x: number; // percent
  y: number; // percent
  width: number; // percent
}

interface Props {
  text: string;
  textStyle?: TextStyle;
  position?: TextBlockPosition;
  containerRef: React.RefObject<HTMLDivElement>;
  defaultColor?: string;
  isTitle?: boolean;
  onChange: (text: string) => void;
  onStyleChange: (style: TextStyle) => void;
  onPositionChange: (pos: TextBlockPosition) => void;
}

const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64];

export default function PPTEditableText({
  text,
  textStyle = {},
  position,
  containerRef,
  defaultColor,
  isTitle,
  onChange,
  onStyleChange,
  onPositionChange,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const effectivePos = position || { x: isTitle ? 5 : 5, y: isTitle ? 5 : 20, width: 90 };
  const effectiveStyle: TextStyle = {
    fontFamily: textStyle.fontFamily || 'inherit',
    fontSize: textStyle.fontSize || (isTitle ? 24 : 14),
    bold: textStyle.bold ?? isTitle,
    italic: textStyle.italic ?? false,
    color: textStyle.color || defaultColor || '#1E293B',
  };

  const getContainerBounds = useCallback(() => {
    if (!containerRef.current) return { width: 600, height: 400 };
    const rect = containerRef.current.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [containerRef]);

  // Drag logic
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsSelected(true);
    setShowToolbar(true);
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: effectivePos.x,
      posY: effectivePos.y,
    };
  }, [isEditing, effectivePos.x, effectivePos.y]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const bounds = getContainerBounds();
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const newX = Math.max(0, Math.min(100 - effectivePos.width, dragStart.current.posX + (dx / bounds.width) * 100));
      const newY = Math.max(0, Math.min(95, dragStart.current.posY + (dy / bounds.height) * 100));
      onPositionChange({ ...effectivePos, x: newX, y: newY });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isDragging, effectivePos, onPositionChange, getContainerBounds]);

  // Width resize
  const handleWidthResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = effectivePos.width;
    const bounds = getContainerBounds();
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newW = Math.max(15, Math.min(100 - effectivePos.x, startW + (dx / bounds.width) * 100));
      onPositionChange({ ...effectivePos, width: newW });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [effectivePos, onPositionChange, getContainerBounds]);

  // Double-click to edit
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setIsSelected(true);
    setShowToolbar(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Click to select
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSelected(true);
    setShowToolbar(true);
  };

  // Deselect on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (blockRef.current && !blockRef.current.contains(e.target as Node)) {
        setIsSelected(false);
        setIsEditing(false);
        setShowToolbar(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [isEditing, text]);

  const fontObj = PPT_FONTS.find(f => f.fontFace === effectiveStyle.fontFamily);

  return (
    <div
      ref={blockRef}
      className={`absolute group ${isDragging ? 'cursor-grabbing' : isEditing ? 'cursor-text' : 'cursor-grab'}`}
      style={{
        left: `${effectivePos.x}%`,
        top: `${effectivePos.y}%`,
        width: `${effectivePos.width}%`,
        zIndex: isSelected ? 20 : 5,
      }}
      onMouseDown={handleDragStart}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Floating toolbar */}
      {showToolbar && (
        <div
          className="absolute -top-10 left-0 flex items-center gap-1 bg-card border border-border rounded-lg shadow-lg px-2 py-1 z-30"
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Font selector */}
          <select
            className="text-xs bg-transparent border border-border rounded px-1 py-0.5 max-w-[80px]"
            value={effectiveStyle.fontFamily}
            onChange={(e) => onStyleChange({ ...textStyle, fontFamily: e.target.value })}
          >
            <option value="inherit">默认</option>
            {PPT_FONTS.map(f => (
              <option key={f.id} value={f.fontFace}>{f.sample}</option>
            ))}
          </select>

          {/* Font size */}
          <select
            className="text-xs bg-transparent border border-border rounded px-1 py-0.5 w-[52px]"
            value={effectiveStyle.fontSize}
            onChange={(e) => onStyleChange({ ...textStyle, fontSize: Number(e.target.value) })}
          >
            {FONT_SIZE_OPTIONS.map(s => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>

          {/* Bold */}
          <button
            className={`p-0.5 rounded ${effectiveStyle.bold ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={(e) => { e.stopPropagation(); onStyleChange({ ...textStyle, bold: !effectiveStyle.bold }); }}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic */}
          <button
            className={`p-0.5 rounded ${effectiveStyle.italic ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={(e) => { e.stopPropagation(); onStyleChange({ ...textStyle, italic: !effectiveStyle.italic }); }}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Color */}
          <input
            type="color"
            className="w-5 h-5 rounded cursor-pointer border-0"
            value={effectiveStyle.color}
            onChange={(e) => onStyleChange({ ...textStyle, color: e.target.value })}
          />
        </div>
      )}

      {/* Text content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setIsEditing(false)}
          className="w-full bg-transparent border-none outline-none resize-none p-0"
          style={{
            fontFamily: effectiveStyle.fontFamily,
            fontSize: `${effectiveStyle.fontSize}px`,
            fontWeight: effectiveStyle.bold ? 'bold' : 'normal',
            fontStyle: effectiveStyle.italic ? 'italic' : 'normal',
            color: effectiveStyle.color,
            lineHeight: 1.5,
          }}
        />
      ) : (
        <div
          className="whitespace-pre-wrap"
          style={{
            fontFamily: effectiveStyle.fontFamily,
            fontSize: `${effectiveStyle.fontSize}px`,
            fontWeight: effectiveStyle.bold ? 'bold' : 'normal',
            fontStyle: effectiveStyle.italic ? 'italic' : 'normal',
            color: effectiveStyle.color,
            lineHeight: 1.5,
          }}
        >
          {text || (isTitle ? '标题' : '内容')}
        </div>
      )}

      {/* Selection border */}
      {isSelected && (
        <>
          <div className="absolute inset-0 border-2 border-primary/50 rounded pointer-events-none" />
          {/* Move handle */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm pointer-events-none">
            <Move className="w-3 h-3" />
          </div>
          {/* Width resize handle (right edge) */}
          <div
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-primary rounded-sm cursor-ew-resize shadow-sm"
            onMouseDown={handleWidthResize}
          />
        </>
      )}
    </div>
  );
}
