import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Eraser, Type, ArrowUpRight, Grid3X3, Pencil,
  Crop, RotateCcw, RotateCw, Undo2, Redo2, Download, ZoomIn, ZoomOut,
  Palette, Loader2, Eye, Trash2, Move, ImageIcon, Sparkles, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Tool = 'move' | 'text' | 'arrow' | 'mosaic' | 'draw' | 'crop';

interface DrawAction {
  type: 'draw' | 'text' | 'arrow' | 'mosaic' | 'image';
  data: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ImageEditorDialog({ open, onClose }: Props) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [processedImage, setProcessedImage] = useState<HTMLImageElement | null>(null);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgTransparent, setBgTransparent] = useState(false);
  const [tool, setTool] = useState<Tool>('move');
  const [isRemoving, setIsRemoving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [exportScale, setExportScale] = useState(1);
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [drawSize, setDrawSize] = useState(3);
  const [textInput, setTextInput] = useState('');
  const [fontSize, setFontSize] = useState(24);

  // Undo/Redo
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [undoneActions, setUndoneActions] = useState<DrawAction[]>([]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);

  // Canvas dimensions
  const [canvasW, setCanvasW] = useState(800);
  const [canvasH, setCanvasH] = useState(600);

  const getCanvasPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  // Load image
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setProcessedImage(null);
        setActions([]);
        setUndoneActions([]);
        setRotation(0);
        setZoom(1);
        const maxW = 1200;
        const scale = img.width > maxW ? maxW / img.width : 1;
        setCanvasW(Math.round(img.width * scale));
        setCanvasH(Math.round(img.height * scale));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  }, [handleFile]);

  // Canvas-based local background removal (fallback)
  const removeBackgroundLocal = useCallback((src: HTMLImageElement): HTMLImageElement | null => {
    try {
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(src, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;

      // Sample corners to detect background color
      const samples: number[][] = [];
      const samplePositions = [
        [0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1],
        [Math.floor(c.width / 2), 0], [0, Math.floor(c.height / 2)],
      ];
      for (const [sx, sy] of samplePositions) {
        const idx = (sy * c.width + sx) * 4;
        samples.push([d[idx], d[idx + 1], d[idx + 2]]);
      }
      // Average background color from corners
      const bgR = Math.round(samples.reduce((s, p) => s + p[0], 0) / samples.length);
      const bgG = Math.round(samples.reduce((s, p) => s + p[1], 0) / samples.length);
      const bgB = Math.round(samples.reduce((s, p) => s + p[2], 0) / samples.length);

      const tolerance = 50; // color distance threshold
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.sqrt(
          (d[i] - bgR) ** 2 + (d[i + 1] - bgG) ** 2 + (d[i + 2] - bgB) ** 2
        );
        if (dist < tolerance) {
          d[i + 3] = 0; // fully transparent
        } else if (dist < tolerance * 1.5) {
          // Edge blending
          d[i + 3] = Math.round(255 * ((dist - tolerance) / (tolerance * 0.5)));
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const resultImg = new Image();
      resultImg.src = c.toDataURL('image/png');
      return resultImg;
    } catch {
      return null;
    }
  }, []);

  // Remove background with graceful degradation: AI → Canvas fallback
  const [removalMethod, setRemovalMethod] = useState<'ai' | 'local' | null>(null);

  const removeBackground = useCallback(async (mode: 'auto' | 'ai' | 'local' = 'auto') => {
    const src = image;
    if (!src) return;
    setIsRemoving(true);
    setRemovalMethod(null);

    const tryAI = async (): Promise<boolean> => {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = src.width;
        tempCanvas.height = src.height;
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(src, 0, 0);
        const base64 = tempCanvas.toDataURL('image/png');

        const { data, error } = await supabase.functions.invoke('remove-background', {
          body: { imageBase64: base64 },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const resultImg = new Image();
        await new Promise<void>((resolve, reject) => {
          resultImg.onload = () => resolve();
          resultImg.onerror = () => reject(new Error('Image load failed'));
          resultImg.src = data.image;
        });
        setProcessedImage(resultImg);
        setBgTransparent(true);
        setRemovalMethod('ai');
        toast({ title: t('imgEdit.bgRemoved') });
        return true;
      } catch (err: any) {
        console.warn('AI removal failed:', err?.message);
        return false;
      }
    };

    const tryLocal = async (): Promise<boolean> => {
      try {
        const localResult = removeBackgroundLocal(src);
        if (!localResult) throw new Error('null');
        await new Promise<void>((resolve, reject) => {
          if (localResult.complete && localResult.naturalWidth > 0) resolve();
          else { localResult.onload = () => resolve(); localResult.onerror = () => reject(); }
        });
        setProcessedImage(localResult);
        setBgTransparent(true);
        setRemovalMethod('local');
        toast({ title: t('imgEdit.bgRemovedLocal'), description: mode === 'auto' ? t('imgEdit.bgRemovedLocalDesc') : undefined });
        return true;
      } catch {
        return false;
      }
    };

    let success = false;
    if (mode === 'ai') {
      success = await tryAI();
    } else if (mode === 'local') {
      success = await tryLocal();
    } else {
      success = await tryAI();
      if (!success) success = await tryLocal();
    }

    if (!success) {
      toast({ title: t('imgEdit.bgRemoveFail'), variant: 'destructive' });
    }
    setIsRemoving(false);
  }, [image, t, removeBackgroundLocal]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } else if (!bgTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Checkerboard for transparent
      const sz = 16;
      for (let y = 0; y < canvas.height; y += sz) {
        for (let x = 0; x < canvas.width; x += sz) {
          ctx.fillStyle = ((x / sz + y / sz) % 2 === 0) ? '#e5e5e5' : '#ffffff';
          ctx.fillRect(x, y, sz, sz);
        }
      }
    }

    // Draw main image
    const img = processedImage || image;
    if (img) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      ctx.restore();
    }

    // Replay actions
    for (const action of actions) {
      if (action.type === 'draw') {
        const pts = action.data.points;
        if (pts.length < 2) continue;
        ctx.strokeStyle = action.data.color;
        ctx.lineWidth = action.data.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      } else if (action.type === 'text') {
        ctx.fillStyle = action.data.color;
        ctx.font = `${action.data.fontSize}px sans-serif`;
        ctx.fillText(action.data.text, action.data.x, action.data.y);
      } else if (action.type === 'arrow') {
        const { from, to, color, size } = action.data;
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = size * 5;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headLen * Math.cos(angle - 0.5), to.y - headLen * Math.sin(angle - 0.5));
        ctx.lineTo(to.x - headLen * Math.cos(angle + 0.5), to.y - headLen * Math.sin(angle + 0.5));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      } else if (action.type === 'mosaic') {
        const { points, blockSize } = action.data;
        for (const pt of points) {
          const imgData = ctx.getImageData(pt.x - blockSize, pt.y - blockSize, blockSize * 2, blockSize * 2);
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < imgData.data.length; i += 4) {
            r += imgData.data[i]; g += imgData.data[i + 1]; b += imgData.data[i + 2]; count++;
          }
          if (count > 0) {
            ctx.fillStyle = `rgb(${Math.round(r / count)},${Math.round(g / count)},${Math.round(b / count)})`;
            ctx.fillRect(pt.x - blockSize, pt.y - blockSize, blockSize * 2, blockSize * 2);
          }
        }
      }
    }
  }, [image, processedImage, bgColor, bgImage, bgTransparent, rotation, zoom, actions]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // Mouse/Touch handlers
  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);
    if (tool === 'draw') {
      setIsDrawing(true);
      setDrawPoints([pos]);
    } else if (tool === 'arrow') {
      setArrowStart(pos);
    } else if (tool === 'text') {
      if (textInput.trim()) {
        const action: DrawAction = {
          type: 'text',
          data: { text: textInput, x: pos.x, y: pos.y, color: drawColor, fontSize },
        };
        setActions(prev => [...prev, action]);
        setUndoneActions([]);
        setTextInput('');
      }
    } else if (tool === 'mosaic') {
      setIsDrawing(true);
      setDrawPoints([pos]);
    }
  }, [tool, getCanvasPos, textInput, drawColor, fontSize]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing && !arrowStart) return;
    const pos = getCanvasPos(e);
    if (tool === 'draw' && isDrawing) {
      setDrawPoints(prev => [...prev, pos]);
      // Live preview
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx && drawPoints.length > 0) {
          const last = drawPoints[drawPoints.length - 1];
          ctx.strokeStyle = drawColor;
          ctx.lineWidth = drawSize;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      }
    } else if (tool === 'mosaic' && isDrawing) {
      setDrawPoints(prev => [...prev, pos]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const blockSize = 8;
          const imgData = ctx.getImageData(pos.x - blockSize, pos.y - blockSize, blockSize * 2, blockSize * 2);
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < imgData.data.length; i += 4) {
            r += imgData.data[i]; g += imgData.data[i + 1]; b += imgData.data[i + 2]; count++;
          }
          if (count > 0) {
            ctx.fillStyle = `rgb(${Math.round(r / count)},${Math.round(g / count)},${Math.round(b / count)})`;
            ctx.fillRect(pos.x - blockSize, pos.y - blockSize, blockSize * 2, blockSize * 2);
          }
        }
      }
    }
  }, [isDrawing, arrowStart, tool, getCanvasPos, drawColor, drawSize, drawPoints]);

  const handlePointerUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'draw' && isDrawing) {
      const action: DrawAction = {
        type: 'draw',
        data: { points: drawPoints, color: drawColor, size: drawSize },
      };
      setActions(prev => [...prev, action]);
      setUndoneActions([]);
    } else if (tool === 'arrow' && arrowStart) {
      const pos = getCanvasPos(e);
      const action: DrawAction = {
        type: 'arrow',
        data: { from: arrowStart, to: pos, color: drawColor, size: drawSize },
      };
      setActions(prev => [...prev, action]);
      setUndoneActions([]);
      setArrowStart(null);
    } else if (tool === 'mosaic' && isDrawing) {
      const action: DrawAction = {
        type: 'mosaic',
        data: { points: drawPoints, blockSize: 8 },
      };
      setActions(prev => [...prev, action]);
      setUndoneActions([]);
    }
    setIsDrawing(false);
    setDrawPoints([]);
  }, [tool, isDrawing, drawPoints, drawColor, drawSize, arrowStart, getCanvasPos]);

  // Undo/Redo
  const undo = useCallback(() => {
    setActions(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoneActions(u => [...u, last]);
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setUndoneActions(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setActions(a => [...a, last]);
      return prev.slice(0, -1);
    });
  }, []);

  // Export
  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.round(canvasW * exportScale);
    exportCanvas.height = Math.round(canvasH * exportScale);
    const ctx = exportCanvas.getContext('2d')!;
    ctx.scale(exportScale, exportScale);

    // Re-render at export scale
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
    } else if (!bgTransparent || exportFormat !== 'png') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    const img = processedImage || image;
    if (img) {
      ctx.save();
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
      ctx.restore();
    }

    for (const action of actions) {
      if (action.type === 'draw') {
        const pts = action.data.points;
        if (pts.length < 2) continue;
        ctx.strokeStyle = action.data.color;
        ctx.lineWidth = action.data.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      } else if (action.type === 'text') {
        ctx.fillStyle = action.data.color;
        ctx.font = `${action.data.fontSize}px sans-serif`;
        ctx.fillText(action.data.text, action.data.x, action.data.y);
      } else if (action.type === 'arrow') {
        const { from, to, color, size } = action.data;
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = size * 5;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headLen * Math.cos(angle - 0.5), to.y - headLen * Math.sin(angle - 0.5));
        ctx.lineTo(to.x - headLen * Math.cos(angle + 0.5), to.y - headLen * Math.sin(angle + 0.5));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const;
    const dataUrl = exportCanvas.toDataURL(mimeMap[exportFormat], 0.92);
    const link = document.createElement('a');
    link.download = `edited-image.${exportFormat}`;
    link.href = dataUrl;
    link.click();
    toast({ title: t('imgEdit.exported') });
  }, [canvasW, canvasH, exportScale, bgImage, bgTransparent, bgColor, processedImage, image, rotation, zoom, actions, exportFormat, t]);

  // Background image upload
  const handleBgImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setBgImage(img);
        setBgTransparent(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const toolButtons: { id: Tool; icon: any; label: string }[] = [
    { id: 'move', icon: Move, label: t('imgEdit.move') },
    { id: 'text', icon: Type, label: t('imgEdit.text') },
    { id: 'arrow', icon: ArrowUpRight, label: t('imgEdit.arrow') },
    { id: 'mosaic', icon: Grid3X3, label: t('imgEdit.mosaic') },
    { id: 'draw', icon: Pencil, label: t('imgEdit.draw') },
    { id: 'crop', icon: Crop, label: t('imgEdit.crop') },
  ];

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="w-5 h-5" /> {t('imgEdit.title')}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card flex-wrap">
        {toolButtons.map(tb => (
          <Button
            key={tb.id}
            variant={tool === tb.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool(tb.id)}
            title={tb.label}
            className="gap-1 text-xs h-8"
          >
            <tb.icon className="w-4 h-4" /> <span className="hidden sm:inline">{tb.label}</span>
          </Button>
        ))}
        <div className="w-px h-6 bg-border mx-1" />
        <Button variant="ghost" size="sm" onClick={undo} disabled={actions.length === 0} title={t('imgEdit.undo')} className="h-8">
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={undoneActions.length === 0} title={t('imgEdit.redo')} className="h-8">
          <Redo2 className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button variant="ghost" size="sm" onClick={() => setRotation(r => r - 90)} className="h-8" title={t('imgEdit.rotateL')}>
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRotation(r => r + 90)} className="h-8" title={t('imgEdit.rotateR')}>
          <RotateCw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="h-8">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))} className="h-8">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        {(tool === 'draw' || tool === 'arrow' || tool === 'text') && (
          <>
            <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border" />
            <input type="range" min={1} max={20} value={drawSize} onChange={e => setDrawSize(Number(e.target.value))} className="w-16" />
          </>
        )}
        {tool === 'text' && (
          <>
            <Input value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={t('imgEdit.textPlaceholder')} className="h-8 w-32 text-xs" />
            <input type="range" min={12} max={72} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-16" title={t('imgEdit.fontSize')} />
          </>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-muted/30">
          {!image ? (
            <div
              className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors max-w-lg w-full"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-foreground font-medium mb-1">{t('imgEdit.uploadTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('imgEdit.uploadHint')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/bmp,image/gif"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              className="border border-border rounded-lg shadow-sm max-w-full max-h-full"
              style={{ cursor: tool === 'move' ? 'grab' : tool === 'text' ? 'text' : 'crosshair' }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          )}
        </div>

        {/* Right sidebar - Background & Export */}
        {image && (
          <div className="w-56 border-l border-border bg-card p-4 overflow-y-auto space-y-4 hidden md:block">
            {/* AI Background Removal */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('imgEdit.bgSection')}</h4>
              <Button
                onClick={() => removeBackground('auto')}
                disabled={isRemoving}
                className="w-full gap-2"
                size="sm"
              >
                {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                {isRemoving ? t('imgEdit.removing') : t('imgEdit.removeBg')}
              </Button>
              {removalMethod && (
                <p className="text-xs text-muted-foreground text-center">
                  {removalMethod === 'ai' ? '✨ AI' : '🎨 Local'}
                </p>
              )}
            </div>

            {/* Background color/image */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('imgEdit.bgCustom')}</h4>
              <div className="flex items-center gap-2">
                <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); setBgTransparent(false); setBgImage(null); }} className="w-8 h-8 rounded cursor-pointer border border-border" />
                <Button variant="ghost" size="sm" onClick={() => { setBgTransparent(true); setBgImage(null); }} className="text-xs h-8 gap-1">
                  <Eye className="w-3.5 h-3.5" /> {t('imgEdit.transparent')}
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {['#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6', '#f97316'].map(c => (
                  <button
                    key={c}
                    className="w-full aspect-square rounded border border-border hover:ring-2 ring-primary/50 transition-all"
                    style={{ backgroundColor: c }}
                    onClick={() => { setBgColor(c); setBgTransparent(false); setBgImage(null); }}
                  />
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => bgFileInputRef.current?.click()}>
                <Palette className="w-3.5 h-3.5 mr-1" /> {t('imgEdit.bgImage')}
              </Button>
              <input
                ref={bgFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleBgImage(f);
                }}
              />
            </div>

            {/* Export */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('imgEdit.exportSection')}</h4>
              <div className="flex gap-1">
                {(['png', 'jpg', 'webp'] as const).map(fmt => (
                  <Button
                    key={fmt}
                    variant={exportFormat === fmt ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-7 flex-1"
                    onClick={() => setExportFormat(fmt)}
                  >
                    {fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t('imgEdit.scale')}</span>
                <select
                  value={exportScale}
                  onChange={e => setExportScale(Number(e.target.value))}
                  className="bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={3}>3x</option>
                </select>
                <span className="text-muted-foreground">
                  {Math.round(canvasW * exportScale)}×{Math.round(canvasH * exportScale)}
                </span>
              </div>
              <Button onClick={handleExport} className="w-full gap-2" size="sm">
                <Download className="w-4 h-4" /> {t('imgEdit.download')}
              </Button>
            </div>

            {/* Reset */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1"
              onClick={() => {
                setImage(null);
                setProcessedImage(null);
                setActions([]);
                setUndoneActions([]);
                setRotation(0);
                setZoom(1);
                setBgTransparent(false);
                setBgImage(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> {t('imgEdit.reset')}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile bottom bar for export/bg */}
      {image && (
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-t border-border bg-card overflow-x-auto">
          <Button onClick={() => removeBackground('auto')} disabled={isRemoving} size="sm" className="gap-1 text-xs h-8 shrink-0">
            {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" />}
            {t('imgEdit.removeBg')}
          </Button>
          <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); setBgTransparent(false); }} className="w-7 h-7 rounded cursor-pointer border border-border shrink-0" />
          <Button variant="ghost" size="sm" onClick={() => setBgTransparent(true)} className="text-xs h-8 shrink-0">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <div className="flex gap-1 shrink-0">
            {(['png', 'jpg', 'webp'] as const).map(fmt => (
              <Button key={fmt} variant={exportFormat === fmt ? 'default' : 'outline'} size="sm" className="text-xs h-7 px-2" onClick={() => setExportFormat(fmt)}>
                {fmt.toUpperCase()}
              </Button>
            ))}
          </div>
          <Button onClick={handleExport} size="sm" className="gap-1 text-xs h-8 shrink-0">
            <Download className="w-3.5 h-3.5" /> {t('imgEdit.download')}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
