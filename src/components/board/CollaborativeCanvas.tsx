import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Pen, Eraser, Square, Circle, ArrowRight, Type, Undo2, Redo2,
  Trash2, MousePointer, Minus, Download, Users, ZoomIn, ZoomOut,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Tool = 'select' | 'pen' | 'eraser' | 'rect' | 'circle' | 'arrow' | 'line' | 'text';

interface StrokeData {
  tool: Tool;
  points?: number[];
  x?: number; y?: number; w?: number; h?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  text?: string;
  fontSize?: number;
}

interface Stroke {
  id: string;
  board_id: string;
  user_nickname: string;
  tool: string;
  stroke_data: StrokeData;
  color: string;
  stroke_width: number;
  created_at: string;
}

const COLORS = [
  '#000000', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
];

interface Props {
  boardId: string;
  nickname: string;
  isCreator: boolean;
  isLocked: boolean;
  creatorToken?: string | null;
  onlineUsers?: string[];
}

export default function CollaborativeCanvas({ boardId, nickname, isCreator, isLocked, creatorToken }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoStack, setUndoStack] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [shapeEnd, setShapeEnd] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Load existing strokes
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('board_strokes')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true })
        .limit(1000);
      if (data) setStrokes(data as unknown as Stroke[]);
    })();
  }, [boardId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`collab-${boardId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'board_strokes',
        filter: `board_id=eq.${boardId}`,
      }, (payload) => {
        const newStroke = payload.new as unknown as Stroke;
        setStrokes(prev => {
          if (prev.find(s => s.id === newStroke.id)) return prev;
          return [...prev, newStroke];
        });
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'board_strokes',
        filter: `board_id=eq.${boardId}`,
      }, (payload) => {
        const oldId = (payload.old as any).id;
        setStrokes(prev => prev.filter(s => s.id !== oldId));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat().map((p: any) => p.nickname as string);
        setOnlineUsers([...new Set(users)]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ nickname });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [boardId, nickname]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw all strokes
    for (const stroke of strokes) {
      drawStroke(ctx, stroke);
    }

    // Draw current in-progress stroke
    if (drawing && tool === 'pen' && currentPoints.length >= 4) {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentPoints[0], currentPoints[1]);
      for (let i = 2; i < currentPoints.length; i += 2) {
        ctx.lineTo(currentPoints[i], currentPoints[i + 1]);
      }
      ctx.stroke();
    }

    if (drawing && tool === 'eraser' && currentPoints.length >= 4) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = strokeWidth * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentPoints[0], currentPoints[1]);
      for (let i = 2; i < currentPoints.length; i += 2) {
        ctx.lineTo(currentPoints[i], currentPoints[i + 1]);
      }
      ctx.stroke();
    }

    // Shape preview
    if (drawing && shapeStart && shapeEnd) {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      const { x: sx, y: sy } = shapeStart;
      const { x: ex, y: ey } = shapeEnd;

      if (tool === 'rect') {
        ctx.strokeRect(sx, sy, ex - sx, ey - sy);
      } else if (tool === 'circle') {
        const rx = Math.abs(ex - sx) / 2;
        const ry = Math.abs(ey - sy) / 2;
        const cx = (sx + ex) / 2;
        const cy = (sy + ey) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'arrow' || tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (tool === 'arrow') {
          drawArrowHead(ctx, sx, sy, ex, ey, strokeWidth);
        }
      }
    }

    ctx.restore();
  }, [strokes, drawing, currentPoints, shapeStart, shapeEnd, tool, color, strokeWidth, zoom, pan]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => renderCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [renderCanvas]);

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    const d = stroke.stroke_data as StrokeData;
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.tool === 'eraser' ? stroke.stroke_width * 3 : stroke.stroke_width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if ((stroke.tool === 'pen' || stroke.tool === 'eraser') && d.points && d.points.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(d.points[0], d.points[1]);
      for (let i = 2; i < d.points.length; i += 2) {
        ctx.lineTo(d.points[i], d.points[i + 1]);
      }
      ctx.stroke();
    } else if (stroke.tool === 'rect' && d.x != null) {
      ctx.strokeRect(d.x, d.y!, d.w!, d.h!);
    } else if (stroke.tool === 'circle' && d.x != null) {
      const rx = Math.abs(d.w!) / 2;
      const ry = Math.abs(d.h!) / 2;
      const cx = d.x + d.w! / 2;
      const cy = d.y! + d.h! / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if ((stroke.tool === 'arrow' || stroke.tool === 'line') && d.x1 != null) {
      ctx.beginPath();
      ctx.moveTo(d.x1, d.y1!);
      ctx.lineTo(d.x2!, d.y2!);
      ctx.stroke();
      if (stroke.tool === 'arrow') {
        drawArrowHead(ctx, d.x1, d.y1!, d.x2!, d.y2!, stroke.stroke_width);
      }
    } else if (stroke.tool === 'text' && d.text) {
      ctx.font = `${d.fontSize || 16}px sans-serif`;
      ctx.fillText(d.text, d.x!, d.y!);
    }
  }

  function drawArrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.max(10, w * 4);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - len * Math.cos(angle - 0.4), y2 - len * Math.sin(angle - 0.4));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - len * Math.cos(angle + 0.4), y2 - len * Math.sin(angle + 0.4));
    ctx.stroke();
  }

  function getCanvasCoords(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

  async function saveStroke(strokeData: StrokeData) {
    const { data, error } = await supabase.from('board_strokes').insert({
      board_id: boardId,
      user_nickname: nickname,
      tool: strokeData.tool,
      stroke_data: strokeData as any,
      color,
      stroke_width: strokeWidth,
    } as any).select().single();

    if (error) {
      console.error('Save stroke error:', error);
    } else if (data) {
      // Local insert handled by realtime, but add immediately for snappiness
      setStrokes(prev => {
        if (prev.find(s => s.id === (data as any).id)) return prev;
        return [...prev, data as unknown as Stroke];
      });
    }
  }

  function handlePointerDown(e: React.MouseEvent) {
    if (isLocked && !isCreator) return;
    if (tool === 'select') {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }
    if (tool === 'text') {
      const coords = getCanvasCoords(e);
      setTextPos(coords);
      return;
    }

    setDrawing(true);
    const coords = getCanvasCoords(e);

    if (tool === 'pen' || tool === 'eraser') {
      setCurrentPoints([coords.x, coords.y]);
    } else {
      setShapeStart(coords);
      setShapeEnd(coords);
    }
  }

  function handlePointerMove(e: React.MouseEvent) {
    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      return;
    }
    if (!drawing) return;
    const coords = getCanvasCoords(e);

    if (tool === 'pen' || tool === 'eraser') {
      setCurrentPoints(prev => [...prev, coords.x, coords.y]);
    } else {
      setShapeEnd(coords);
    }
  }

  function handlePointerUp() {
    if (isPanning.current) { isPanning.current = false; return; }
    if (!drawing) return;
    setDrawing(false);

    if (tool === 'pen' || tool === 'eraser') {
      if (currentPoints.length >= 4) {
        saveStroke({ tool, points: currentPoints });
      }
      setCurrentPoints([]);
    } else if (shapeStart && shapeEnd) {
      const { x: sx, y: sy } = shapeStart;
      const { x: ex, y: ey } = shapeEnd;
      if (tool === 'rect' || tool === 'circle') {
        saveStroke({ tool, x: sx, y: sy, w: ex - sx, h: ey - sy });
      } else if (tool === 'arrow' || tool === 'line') {
        saveStroke({ tool, x1: sx, y1: sy, x2: ex, y2: ey });
      }
      setShapeStart(null);
      setShapeEnd(null);
    }
  }

  function handleTextSubmit() {
    if (!textPos || !textInput.trim()) { setTextPos(null); return; }
    saveStroke({ tool: 'text', text: textInput, x: textPos.x, y: textPos.y, fontSize: strokeWidth * 6 });
    setTextInput('');
    setTextPos(null);
  }

  async function handleUndo() {
    if (strokes.length === 0) return;
    // Find last stroke by this user
    const myStrokes = strokes.filter(s => s.user_nickname === nickname);
    if (myStrokes.length === 0) return;
    const last = myStrokes[myStrokes.length - 1];
    setUndoStack(prev => [...prev, last]);
    setStrokes(prev => prev.filter(s => s.id !== last.id));
    // Delete from DB
    if (isCreator && creatorToken) {
      await supabase.rpc('delete_board_stroke', {
        p_board_id: boardId,
        p_token: creatorToken,
        p_stroke_id: last.id,
      } as any);
    }
  }

  async function handleClearAll() {
    if (!isCreator || !creatorToken) return;
    if (!confirm('确定清除所有笔画？')) return;
    await supabase.rpc('clear_board_strokes', { p_board_id: boardId, p_token: creatorToken } as any);
    setStrokes([]);
    toast({ title: '已清除所有笔画' });
  }

  function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `collaborative-board-${boardId.slice(0, 8)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer, label: '移动' },
    { id: 'pen', icon: Pen, label: '画笔' },
    { id: 'eraser', icon: Eraser, label: '橡皮擦' },
    { id: 'rect', icon: Square, label: '矩形' },
    { id: 'circle', icon: Circle, label: '圆形' },
    { id: 'arrow', icon: ArrowRight, label: '箭头' },
    { id: 'line', icon: Minus, label: '直线' },
    { id: 'text', icon: Type, label: '文字' },
  ];

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card flex-wrap">
        {/* Drawing tools */}
        {tools.map(t => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setTool(t.id)}
            title={t.label}
            disabled={isLocked && !isCreator}
          >
            <t.icon className="w-4 h-4" />
          </Button>
        ))}

        <div className="w-px h-6 bg-border mx-1" />

        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="颜色">
              <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: color }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-5 gap-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-primary' : 'border-border'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Stroke width */}
        <div className="flex items-center gap-1 mx-1">
          <span className="text-xs text-muted-foreground w-4 text-right">{strokeWidth}</span>
          <Slider
            className="w-16"
            min={1}
            max={20}
            step={1}
            value={[strokeWidth]}
            onValueChange={([v]) => setStrokeWidth(v)}
          />
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Actions */}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleUndo} title="撤销">
          <Undo2 className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setZoom(z => Math.min(3, z + 0.2))} title="放大">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} title="缩小">
          <ZoomOut className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleExport} title="导出PNG">
          <Download className="w-4 h-4" />
        </Button>

        {isCreator && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={handleClearAll} title="清除全部">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}

        {/* Online users */}
        <div className="ml-auto flex items-center gap-1">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{onlineUsers.length}</span>
          <div className="flex -space-x-1">
            {onlineUsers.slice(0, 5).map((u, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[10px] font-medium text-primary"
                title={u}
              >
                {u.charAt(0)}
              </div>
            ))}
            {onlineUsers.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-muted border border-background flex items-center justify-center text-[10px] text-muted-foreground">
                +{onlineUsers.length - 5}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: tool === 'select' ? 'grab' : tool === 'text' ? 'text' : 'crosshair' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
        />

        {/* Text input overlay */}
        {textPos && (
          <div
            className="absolute z-10"
            style={{ left: textPos.x * zoom + pan.x, top: textPos.y * zoom + pan.y }}
          >
            <div className="flex gap-1 bg-card border border-border rounded-lg p-1 shadow-lg">
              <Input
                autoFocus
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
                placeholder="输入文字..."
                className="h-8 w-40 text-sm"
              />
              <Button size="sm" className="h-8" onClick={handleTextSubmit}>确定</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setTextPos(null)}>✕</Button>
            </div>
          </div>
        )}

        {/* Locked overlay */}
        {isLocked && !isCreator && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-20">
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">白板已锁定</p>
              <p className="text-sm text-muted-foreground">教师已锁定此白板，当前只能浏览</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
