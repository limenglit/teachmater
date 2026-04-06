import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Pen, Eraser, Square, Circle, ArrowRight, Type, Undo2,
  Trash2, MousePointer, Minus, Download, Users, ZoomIn, ZoomOut, ImagePlus, Upload,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Tool = 'select' | 'pen' | 'eraser' | 'rect' | 'circle' | 'arrow' | 'line' | 'text' | 'image';

interface StrokeData {
  tool: Tool;
  points?: number[];
  x?: number; y?: number; w?: number; h?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  text?: string;
  fontSize?: number;
  imageUrl?: string;
  fileName?: string;
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

type PointerLikeEvent = {
  pointerId: number;
  clientX: number;
  clientY: number;
  button?: number;
  pointerType?: string;
};

export default function CollaborativeCanvas({ boardId, nickname, isCreator, isLocked, creatorToken }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [imageRenderVersion, setImageRenderVersion] = useState(0);
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Image cache for rendering
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  // Image drag state
  const [draggingImage, setDraggingImage] = useState<{ strokeId: string; offsetX: number; offsetY: number } | null>(null);
  // Image resize state
  const [resizingImage, setResizingImage] = useState<{ strokeId: string; corner: string; origX: number; origY: number; origW: number; origH: number; startX: number; startY: number } | null>(null);
  // Uploading state
  const [uploading, setUploading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('INIT');
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  const [lastInsertError, setLastInsertError] = useState<string | null>(null);
  const [lastUpdateError, setLastUpdateError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null);
  const [lastInsertAt, setLastInsertAt] = useState<string | null>(null);
  const [lastDataSource, setLastDataSource] = useState<'rpc' | 'table' | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  const formatTs = (ts: string | null) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleTimeString();
  };

  const fetchStrokes = useCallback(async () => {
    setLastFetchAt(new Date().toISOString());
    const { data, error } = await supabase
      .from('board_strokes')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!error && data) {
      // Query newest strokes first for scalable polling, then restore paint order.
      setStrokes(([...data].reverse()) as unknown as Stroke[]);
      setLastDataSource('table');
      setLastFetchError(null);
    } else if (error) {
      console.error('Fetch strokes error:', error);
      setLastFetchError(error.message || 'unknown error');
    }
  }, [boardId]);

  // Load existing strokes
  useEffect(() => {
    void fetchStrokes();
  }, [fetchStrokes]);

  useEffect(() => {
    const fallbackTimer = window.setInterval(() => {
      void fetchStrokes();
    }, 2000);

    return () => window.clearInterval(fallbackTimer);
  }, [fetchStrokes]);

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
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'board_strokes',
        filter: `board_id=eq.${boardId}`,
      }, (payload) => {
        const updated = payload.new as unknown as Stroke;
        setStrokes(prev => prev.map(s => s.id === updated.id ? updated : s));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat().map((p: any) => p.nickname as string);
        setOnlineUsers([...new Set(users)]);
      })
      .subscribe(async (status) => {
        setSubscriptionStatus(status);
        if (status === 'SUBSCRIBED') {
          await Promise.all([channel.track({ nickname }), fetchStrokes()]);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          void fetchStrokes();
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [boardId, nickname, fetchStrokes]);

  const triggerImageRedraw = useCallback(() => {
    setImageRenderVersion(version => version + 1);
  }, []);

  // Preload images into cache
  const loadImage = useCallback((url: string, attempt = 0): Promise<HTMLImageElement> => {
    const cached = imageCache.current.get(url);

    if (cached && cached.complete && cached.naturalWidth > 0) {
      return Promise.resolve(cached);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.current.set(url, img);
        triggerImageRedraw();
        resolve(img);
      };
      img.onerror = () => {
        imageCache.current.delete(url);
        triggerImageRedraw();

        if (attempt < 3) {
          window.setTimeout(() => {
            void loadImage(url, attempt + 1);
          }, 600 * (attempt + 1));
        }

        resolve(img);
      };
      img.src = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      imageCache.current.set(url, img);
    });
  }, [triggerImageRedraw]);

  // Preload all image strokes
  useEffect(() => {
    strokes.forEach(s => {
      if (s.tool === 'image' && (s.stroke_data as StrokeData).imageUrl) {
        loadImage((s.stroke_data as StrokeData).imageUrl!);
      }
    });
  }, [strokes, loadImage]);

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
  }, [strokes, drawing, currentPoints, shapeStart, shapeEnd, tool, color, strokeWidth, zoom, pan, imageRenderVersion]);

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
    } else if (stroke.tool === 'image' && d.imageUrl) {
      const ix = d.x ?? 0;
      const iy = d.y ?? 0;
      const iw = d.w ?? 200;
      const ih = d.h ?? 150;

      // Non-image file card rendering
      if (d.fileName && !d.imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)) {
        // Draw file card background
        ctx.save();
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(ix + radius, iy);
        ctx.lineTo(ix + iw - radius, iy);
        ctx.quadraticCurveTo(ix + iw, iy, ix + iw, iy + radius);
        ctx.lineTo(ix + iw, iy + ih - radius);
        ctx.quadraticCurveTo(ix + iw, iy + ih, ix + iw - radius, iy + ih);
        ctx.lineTo(ix + radius, iy + ih);
        ctx.quadraticCurveTo(ix, iy + ih, ix, iy + ih - radius);
        ctx.lineTo(ix, iy + radius);
        ctx.quadraticCurveTo(ix, iy, ix + radius, iy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // File icon
        const ext = d.fileName.split('.').pop()?.toLowerCase() || '';
        let icon = '📎';
        if (['pdf'].includes(ext)) icon = '📄';
        else if (['doc', 'docx', 'rtf'].includes(ext)) icon = '📝';
        else if (['xls', 'xlsx', 'csv'].includes(ext)) icon = '📊';
        else if (['ppt', 'pptx'].includes(ext)) icon = '📽️';
        else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) icon = '🎬';
        else if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) icon = '🎵';

        ctx.font = `${Math.min(ih * 0.35, 40)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText(icon, ix + iw / 2, iy + ih * 0.35);

        // File name
        ctx.font = `${Math.min(ih * 0.12, 13)}px sans-serif`;
        ctx.fillStyle = '#334155';
        const maxTextW = iw - 16;
        let displayName = d.fileName;
        if (ctx.measureText(displayName).width > maxTextW) {
          while (displayName.length > 3 && ctx.measureText(displayName + '…').width > maxTextW) {
            displayName = displayName.slice(0, -1);
          }
          displayName += '…';
        }
        ctx.fillText(displayName, ix + iw / 2, iy + ih * 0.65);

        // "Click to open" hint
        ctx.font = `${Math.min(ih * 0.09, 10)}px sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('点击打开', ix + iw / 2, iy + ih * 0.82);
        ctx.restore();
      } else {
        // Image rendering
        const img = imageCache.current.get(d.imageUrl);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, ix, iy, iw, ih);
        } else {
          // Draw placeholder while loading
          ctx.save();
          ctx.strokeStyle = '#d1d5db';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(ix, iy, iw, ih);
          ctx.setLineDash([]);
          ctx.fillStyle = '#9ca3af';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('加载中...', ix + iw / 2, iy + ih / 2);
          ctx.restore();
        }
      }

      // Draw border & resize handles when select tool is active
      if (tool === 'select' || tool === 'image') {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.strokeRect(ix, iy, iw, ih);
        ctx.setLineDash([]);
        const hs = 6 / zoom;
        ctx.fillStyle = '#3b82f6';
        for (const [cx, cy] of [[ix, iy], [ix + iw, iy], [ix, iy + ih], [ix + iw, iy + ih]]) {
          ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
        }
        ctx.restore();
      }
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

  function getCanvasCoords(e: React.PointerEvent | React.MouseEvent | React.TouchEvent | { clientX: number; clientY: number }): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e && (e as React.TouchEvent).touches?.length > 0) {
      clientX = (e as React.TouchEvent).touches[0].clientX;
      clientY = (e as React.TouchEvent).touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return { x: 0, y: 0 };
    }
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

  async function saveStroke(strokeData: StrokeData): Promise<Stroke | null> {
    setLastInsertAt(new Date().toISOString());
    const { data, error } = await supabase
      .from('board_strokes')
      .insert({
        board_id: boardId,
        user_nickname: nickname,
        tool: strokeData.tool,
        stroke_data: strokeData as any,
        color,
        stroke_width: strokeWidth,
      } as any)
      .select()
      .single();

    let savedStroke: Stroke | null = null;

    if (!error && data) {
      savedStroke = data as unknown as Stroke;
      setLastInsertError(null);
    } else {
      console.error('Save stroke error:', error);
      setLastInsertError(error?.message || 'unknown error');
      toast({ title: '白板内容同步失败', description: '请检查网络后重试', variant: 'destructive' });
      return null;
    }

    if (savedStroke) {
      setStrokes(prev => {
        if (prev.find(s => s.id === savedStroke!.id)) return prev;
        return [...prev, savedStroke!];
      });
      return savedStroke;
    }

    return null;
  }

  // Find image stroke at a given canvas coordinate
  function findImageAt(x: number, y: number): Stroke | null {
    // Search in reverse (top-most first)
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (s.tool !== 'image') continue;
      const d = s.stroke_data as StrokeData;
      const ix = d.x ?? 0, iy = d.y ?? 0, iw = d.w ?? 200, ih = d.h ?? 150;
      if (x >= ix && x <= ix + iw && y >= iy && y <= iy + ih) return s;
    }
    return null;
  }

  // Check if clicking a resize handle
  function findResizeHandle(x: number, y: number): { stroke: Stroke; corner: string } | null {
    const hs = 10 / zoom;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (s.tool !== 'image') continue;
      const d = s.stroke_data as StrokeData;
      const ix = d.x ?? 0, iy = d.y ?? 0, iw = d.w ?? 200, ih = d.h ?? 150;
      const corners: [number, number, string][] = [
        [ix, iy, 'tl'], [ix + iw, iy, 'tr'],
        [ix, iy + ih, 'bl'], [ix + iw, iy + ih, 'br'],
      ];
      for (const [cx, cy, corner] of corners) {
        if (Math.abs(x - cx) < hs && Math.abs(y - cy) < hs) {
          return { stroke: s, corner };
        }
      }
    }
    return null;
  }

  // Upload file (image or document/media)
  async function handleFileUpload(file: File) {
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE) {
      toast({ title: '文件不能超过20MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `collab/${boardId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('board-media')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('board-media').getPublicUrl(path);
      const fileUrl = urlData.publicUrl;
      const isImage = file.type.startsWith('image/');

      let w = 200, h = 120;
      if (isImage) {
        // Get image natural dimensions
        const img = await loadImage(fileUrl);
        w = img.naturalWidth || 300;
        h = img.naturalHeight || 200;
        const maxDim = 400;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
      }

      // Place at center of current view
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const cx = rect ? ((rect.width / 2) - pan.x) / zoom - w / 2 : 100;
      const cy = rect ? ((rect.height / 2) - pan.y) / zoom - h / 2 : 100;

      const strokeData: StrokeData = { tool: 'image', imageUrl: fileUrl, x: cx, y: cy, w, h };
      if (!isImage) {
        strokeData.fileName = file.name;
      }

      const saved = await saveStroke(strokeData);
      if (saved) {
        setTool('select');
        toast({ title: isImage ? '图片已添加到画布' : `文件 ${file.name} 已添加` });
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      toast({ title: '上传失败: ' + (err.message || '未知错误'), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Update image position/size in DB
  async function updateImageStroke(strokeId: string, updates: Partial<StrokeData>) {
    const stroke = strokes.find(s => s.id === strokeId);
    if (!stroke) return;
    const previousData = stroke.stroke_data as StrokeData;
    const newData = { ...(stroke.stroke_data as StrokeData), ...updates };
    // Optimistic update
    setStrokes(prev => prev.map(s => s.id === strokeId ? { ...s, stroke_data: newData } : s));
    const { error } = await supabase
      .from('board_strokes')
      .update({ stroke_data: newData as any } as any)
      .eq('id', strokeId);

    if (error) {
      console.error('Update image stroke error:', error);
      setLastUpdateError(error.message || 'unknown error');
      setStrokes(prev => prev.map(s => s.id === strokeId ? { ...s, stroke_data: previousData } : s));
      toast({ title: '图片同步失败', description: '请稍后重试', variant: 'destructive' });
      await fetchStrokes();
    } else {
      setLastUpdateError(null);
    }
  }

  // Track active pointer for drawing (ignore secondary touches while drawing)
  const activePointerId = useRef<number | null>(null);
  // Pinch-to-zoom state
  const pinchRef = useRef<{ dist: number; zoom: number; midX: number; midY: number } | null>(null);

  function beginPointerInteraction(e: PointerLikeEvent) {
    if (isLocked && !isCreator) return;
    if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && e.button != null && e.button !== 0) return;

    // If already tracking a pointer (multi-touch secondary finger), ignore for drawing
    if (activePointerId.current != null && e.pointerId !== activePointerId.current) return;

    activePointerId.current = e.pointerId;
    const coords = getCanvasCoords(e);

    // Check resize handles first (when select or image tool)
    if (tool === 'select' || tool === 'image') {
      const handle = findResizeHandle(coords.x, coords.y);
      if (handle) {
        const d = handle.stroke.stroke_data as StrokeData;
        setResizingImage({
          strokeId: handle.stroke.id,
          corner: handle.corner,
          origX: d.x ?? 0, origY: d.y ?? 0,
          origW: d.w ?? 200, origH: d.h ?? 150,
          startX: coords.x, startY: coords.y,
        });
        return;
      }

      // Check image drag
      const imgStroke = findImageAt(coords.x, coords.y);
      if (imgStroke) {
        const d = imgStroke.stroke_data as StrokeData;
        setDraggingImage({
          strokeId: imgStroke.id,
          offsetX: coords.x - (d.x ?? 0),
          offsetY: coords.y - (d.y ?? 0),
        });
        return;
      }
    }

    if (tool === 'select') {
      setPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }
    if (tool === 'image') return;
    if (tool === 'text') {
      setTextPos(coords);
      return;
    }

    setDrawing(true);
    if (tool === 'pen' || tool === 'eraser') {
      setCurrentPoints([coords.x, coords.y]);
    } else {
      setShapeStart(coords);
      setShapeEnd(coords);
    }
  }

  function movePointerInteraction(e: PointerLikeEvent) {
    // Only track the active pointer
    if (activePointerId.current != null && e.pointerId !== activePointerId.current) return;

    const coords = getCanvasCoords(e);

    // Handle image resize
    if (resizingImage) {
      const { strokeId, corner, origX, origY, origW, origH, startX, startY } = resizingImage;
      const dx = coords.x - startX;
      const dy = coords.y - startY;
      let nx = origX, ny = origY, nw = origW, nh = origH;

      if (corner === 'br') { nw = Math.max(40, origW + dx); nh = Math.max(30, origH + dy); }
      else if (corner === 'bl') { nx = origX + dx; nw = Math.max(40, origW - dx); nh = Math.max(30, origH + dy); }
      else if (corner === 'tr') { ny = origY + dy; nw = Math.max(40, origW + dx); nh = Math.max(30, origH - dy); }
      else if (corner === 'tl') { nx = origX + dx; ny = origY + dy; nw = Math.max(40, origW - dx); nh = Math.max(30, origH - dy); }

      setStrokes(prev => prev.map(s => s.id === strokeId
        ? { ...s, stroke_data: { ...(s.stroke_data as StrokeData), x: nx, y: ny, w: nw, h: nh } }
        : s
      ));
      return;
    }

    // Handle image drag
    if (draggingImage) {
      const { strokeId, offsetX, offsetY } = draggingImage;
      setStrokes(prev => prev.map(s => s.id === strokeId
        ? { ...s, stroke_data: { ...(s.stroke_data as StrokeData), x: coords.x - offsetX, y: coords.y - offsetY } }
        : s
      ));
      return;
    }

    if (panning) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      return;
    }
    if (!drawing) return;

    if (tool === 'pen' || tool === 'eraser') {
      setCurrentPoints(prev => [...prev, coords.x, coords.y]);
    } else {
      setShapeEnd(coords);
    }
  }

  function endPointerInteraction(e: PointerLikeEvent) {
    if (activePointerId.current === e.pointerId) {
      activePointerId.current = null;
    }

    // Finish image resize
    if (resizingImage) {
      const stroke = strokes.find(s => s.id === resizingImage.strokeId);
      if (stroke) {
        const d = stroke.stroke_data as StrokeData;
        updateImageStroke(resizingImage.strokeId, { x: d.x, y: d.y, w: d.w, h: d.h });
      }
      setResizingImage(null);
      return;
    }

    // Finish image drag
    if (draggingImage) {
      const stroke = strokes.find(s => s.id === draggingImage.strokeId);
      if (stroke) {
        const d = stroke.stroke_data as StrokeData;
        updateImageStroke(draggingImage.strokeId, { x: d.x, y: d.y });
      }
      setDraggingImage(null);
      return;
    }

    if (panning) {
      setPanning(false);
      return;
    }
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

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    beginPointerInteraction(e.nativeEvent);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerId.current != null && e.pointerId === activePointerId.current) {
      e.preventDefault();
    }
    movePointerInteraction(e.nativeEvent);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    endPointerInteraction(e.nativeEvent);
  }

  function handleMouseDownFallback(e: React.MouseEvent<HTMLCanvasElement>) {
    if (activePointerId.current != null) return;
    e.preventDefault();
    beginPointerInteraction({ pointerId: 1, clientX: e.clientX, clientY: e.clientY, button: e.button, pointerType: 'mouse' });
  }

  function handleMouseMoveFallback(e: React.MouseEvent<HTMLCanvasElement>) {
    if (activePointerId.current !== 1) return;
    movePointerInteraction({ pointerId: 1, clientX: e.clientX, clientY: e.clientY, button: e.button, pointerType: 'mouse' });
  }

  function handleMouseUpFallback(e: React.MouseEvent<HTMLCanvasElement>) {
    if (activePointerId.current !== 1) return;
    endPointerInteraction({ pointerId: 1, clientX: e.clientX, clientY: e.clientY, button: e.button, pointerType: 'mouse' });
  }

  useEffect(() => {
    if (!drawing && !draggingImage && !resizingImage && !panning) return;

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (activePointerId.current != null && event.pointerId === activePointerId.current) {
        event.preventDefault();
      }
      movePointerInteraction(event);
    };

    const handleWindowPointerUp = (event: PointerEvent) => {
      endPointerInteraction(event);
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [drawing, draggingImage, resizingImage, panning, movePointerInteraction, endPointerInteraction]);

  // Pinch-to-zoom via native touch events (mounted on canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const rect = canvas!.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        pinchRef.current = { dist, zoom, midX, midY };
        // Cancel any active single-pointer drawing
        setDrawing(false);
        setCurrentPoints([]);
        activePointerId.current = null;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / pinchRef.current.dist;
        const newZoom = Math.min(3, Math.max(0.3, pinchRef.current.zoom * scale));
        setZoom(newZoom);
        // Pan to keep pinch center stable
        const rect = canvas!.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        setPan(prev => ({
          x: prev.x + (midX - pinchRef.current!.midX) * 0.5,
          y: prev.y + (midY - pinchRef.current!.midY) * 0.5,
        }));
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        pinchRef.current = null;
      }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [zoom]);

  function handleTextSubmit() {
    if (!textPos || !textInput.trim()) { setTextPos(null); return; }
    saveStroke({ tool: 'text', text: textInput, x: textPos.x, y: textPos.y, fontSize: strokeWidth * 6 });
    setTextInput('');
    setTextPos(null);
  }

  async function handleUndo() {
    if (strokes.length === 0) return;
    const myStrokes = strokes.filter(s => s.user_nickname === nickname);
    if (myStrokes.length === 0) return;
    const last = myStrokes[myStrokes.length - 1];
    setUndoStack(prev => [...prev, last]);
    setStrokes(prev => prev.filter(s => s.id !== last.id));
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

  // Drag & drop support
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isLocked && !isCreator) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      files.forEach(f => handleFileUpload(f));
    }
  }

  function getCursor() {
    if (draggingImage) return 'grabbing';
    if (resizingImage) return 'nwse-resize';
    if (panning) return 'grabbing';
    if (tool === 'select') return 'grab';
    if (tool === 'text') return 'text';
    if (tool === 'image') return 'default';
    return 'crosshair';
  }

  const tools_list: { id: Tool; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer, label: '移动' },
    { id: 'pen', icon: Pen, label: '画笔' },
    { id: 'eraser', icon: Eraser, label: '橡皮擦' },
    { id: 'rect', icon: Square, label: '矩形' },
    { id: 'circle', icon: Circle, label: '圆形' },
    { id: 'arrow', icon: ArrowRight, label: '箭头' },
    { id: 'line', icon: Minus, label: '直线' },
    { id: 'text', icon: Type, label: '文字' },
    { id: 'image', icon: ImagePlus, label: '选择图片/文件' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card flex-wrap">
        {tools_list.map(t => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              if (t.id === 'image') {
                setTool('image');
                fileInputRef.current?.click();
                return;
              }
              setTool(t.id);
            }}
            title={t.label}
            disabled={isLocked && !isCreator}
          >
            <t.icon className="w-4 h-4" />
          </Button>
        ))}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,.zip,.rar"
          className="hidden"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(f => handleFileUpload(f));
          }}
        />

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => fileInputRef.current?.click()}
          title="上传文件"
          disabled={(isLocked && !isCreator) || uploading}
        >
          <Upload className="w-4 h-4" />
        </Button>

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

        {uploading && (
          <span className="text-xs text-muted-foreground animate-pulse ml-1">上传中...</span>
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
      <div
        className="flex-1 min-h-0 relative overflow-hidden bg-white select-none"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="absolute left-2 top-2 z-30 pointer-events-auto">
          <div className="rounded-md border border-border bg-background/90 px-2 py-1 text-[11px] leading-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">协同诊断</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowDiagnostics(v => !v)}
              >
                {showDiagnostics ? '收起' : '展开'}
              </button>
            </div>
            {showDiagnostics && (
              <div className="mt-1 space-y-0.5 font-mono text-[10px] text-muted-foreground">
                <div>boardId: {boardId}</div>
                <div>strokes: {strokes.length}</div>
                <div>sub: {subscriptionStatus}</div>
                <div>locked/isCreator: {String(isLocked)} / {String(isCreator)}</div>
                <div>source: {lastDataSource || '-'}</div>
                <div>lastFetch: {formatTs(lastFetchAt)}</div>
                <div>lastInsert: {formatTs(lastInsertAt)}</div>
                <div className="text-destructive/90">fetchErr: {lastFetchError || '-'}</div>
                <div className="text-destructive/90">insertErr: {lastInsertError || '-'}</div>
                <div className="text-destructive/90">updateErr: {lastUpdateError || '-'}</div>
              </div>
            )}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: getCursor(), touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseDown={handleMouseDownFallback}
          onMouseMove={handleMouseMoveFallback}
          onMouseUp={handleMouseUpFallback}
          onDoubleClick={(e) => {
            const coords = getCanvasCoords(e);
            const imgStroke = findImageAt(coords.x, coords.y);
            if (imgStroke) {
              const d = imgStroke.stroke_data as StrokeData;
              if (d.imageUrl) {
                window.open(d.imageUrl, '_blank', 'noopener,noreferrer');
              }
            }
          }}
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
