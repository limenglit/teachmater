import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Upload, Eraser, Type, ArrowUpRight, Grid3X3, Pencil,
  Crop, RotateCcw, RotateCw, Undo2, Redo2, Download, ZoomIn, ZoomOut,
  Palette, Loader2, Eye, Trash2, Move, ImageIcon, Sparkles, Cpu,
  Square, Circle, Heart, Lasso, MousePointer2, Check, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Tool = 'move' | 'text' | 'arrow' | 'mosaic' | 'draw' | 'crop' | 'eraser';
type CropMode = 'rect' | 'circle' | 'ellipse' | 'heart' | 'lasso';

interface DrawAction {
  type: 'draw' | 'text' | 'arrow' | 'mosaic' | 'image' | 'erase';
  data: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// Heart shape path helper
function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const topY = cy - h * 0.35;
  ctx.beginPath();
  ctx.moveTo(cx, cy + h * 0.5);
  ctx.bezierCurveTo(cx - w * 0.55, cy + h * 0.1, cx - w * 0.55, topY - h * 0.1, cx - w * 0.2, topY);
  ctx.bezierCurveTo(cx, topY - h * 0.25, cx, cy - h * 0.05, cx, cy - h * 0.05);
  ctx.bezierCurveTo(cx, cy - h * 0.05, cx, topY - h * 0.25, cx + w * 0.2, topY);
  ctx.bezierCurveTo(cx + w * 0.55, topY - h * 0.1, cx + w * 0.55, cy + h * 0.1, cx, cy + h * 0.5);
  ctx.closePath();
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

  // Move tool state
  const [movingActionIndex, setMovingActionIndex] = useState<number | null>(null);
  const [moveOffset, setMoveOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Crop state
  const [cropMode, setCropMode] = useState<CropMode>('rect');
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [cropLassoPoints, setCropLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [isCropping, setIsCropping] = useState(false);
  const [cropPending, setCropPending] = useState(false);

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
        setCropPending(false);
        setCropStart(null);
        setCropEnd(null);
        setCropLassoPoints([]);
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

  // 容差 state
  const [tolerance, setTolerance] = useState(50);

  // Canvas-based local background removal (fallback)
  const removeBackgroundLocal = useCallback((src: HTMLImageElement, tol?: number): HTMLImageElement | null => {
    try {
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(src, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      const samples: number[][] = [];
      const samplePositions = [
        [0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1],
        [Math.floor(c.width / 2), 0], [0, Math.floor(c.height / 2)],
      ];
      for (const [sx, sy] of samplePositions) {
        const idx = (sy * c.width + sx) * 4;
        samples.push([d[idx], d[idx + 1], d[idx + 2]]);
      }
      const bgR = Math.round(samples.reduce((s, p) => s + p[0], 0) / samples.length);
      const bgG = Math.round(samples.reduce((s, p) => s + p[1], 0) / samples.length);
      const bgB = Math.round(samples.reduce((s, p) => s + p[2], 0) / samples.length);
      const toleranceValue = typeof tol === 'number' ? tol : tolerance;
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.sqrt((d[i] - bgR) ** 2 + (d[i + 1] - bgG) ** 2 + (d[i + 2] - bgB) ** 2);
        if (dist < toleranceValue) {
          d[i + 3] = 0;
        } else if (dist < toleranceValue * 1.5) {
          d[i + 3] = Math.round(255 * ((dist - toleranceValue) / (toleranceValue * 0.5)));
        }
      }
      ctx.putImageData(imgData, 0, 0);
      const resultImg = new Image();
      resultImg.src = c.toDataURL('image/png');
      return resultImg;
    } catch {
      return null;
    }
  }, [tolerance]);

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
        const { data, error } = await supabase.functions.invoke('remove-background', { body: { imageBase64: base64 } });
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
        const localResult = removeBackgroundLocal(src, tolerance);
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
    if (mode === 'ai') success = await tryAI();
    else if (mode === 'local') success = await tryLocal();
    else { success = await tryAI(); if (!success) success = await tryLocal(); }
    if (!success) toast({ title: t('imgEdit.bgRemoveFail'), variant: 'destructive' });
    setIsRemoving(false);
  }, [image, t, removeBackgroundLocal, tolerance]);

  // Hit-test for move tool
  const hitTestAction = useCallback((pos: { x: number; y: number }): number | null => {
    // Iterate in reverse to find the topmost element
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      if (action.type === 'text') {
        const { x, y, text, fontSize: fs } = action.data;
        const approxW = (fs || 24) * text.length * 0.6;
        const approxH = (fs || 24) * 1.2;
        if (pos.x >= x - 5 && pos.x <= x + approxW + 5 && pos.y >= y - approxH && pos.y <= y + 10) {
          return i;
        }
      } else if (action.type === 'arrow') {
        const { from, to } = action.data;
        // Distance from point to line segment
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;
        let t0 = ((pos.x - from.x) * dx + (pos.y - from.y) * dy) / lenSq;
        t0 = Math.max(0, Math.min(1, t0));
        const projX = from.x + t0 * dx;
        const projY = from.y + t0 * dy;
        const dist = Math.sqrt((pos.x - projX) ** 2 + (pos.y - projY) ** 2);
        if (dist < 15) return i;
      }
    }
    return null;
  }, [actions]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } else if (!bgTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const sz = 16;
      for (let y = 0; y < canvas.height; y += sz) {
        for (let x = 0; x < canvas.width; x += sz) {
          ctx.fillStyle = ((x / sz + y / sz) % 2 === 0) ? '#e5e5e5' : '#ffffff';
          ctx.fillRect(x, y, sz, sz);
        }
      }
    }

    const img = processedImage || image;
    if (img) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
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
      } else if (action.type === 'erase') {
        const pts = action.data.points;
        const size = action.data.size;
        if (pts.length < 2) continue;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.restore();
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

    // Draw crop overlay
    if (tool === 'crop' && cropPending) {
      ctx.save();
      if (cropMode === 'lasso' && cropLassoPoints.length > 2) {
        // Dim outside lasso
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(cropLassoPoints[0].x, cropLassoPoints[0].y);
        for (let i = 1; i < cropLassoPoints.length; i++) ctx.lineTo(cropLassoPoints[i].x, cropLassoPoints[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        // Draw border
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(cropLassoPoints[0].x, cropLassoPoints[0].y);
        for (let i = 1; i < cropLassoPoints.length; i++) ctx.lineTo(cropLassoPoints[i].x, cropLassoPoints[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (cropStart && cropEnd) {
        const x1 = Math.min(cropStart.x, cropEnd.x);
        const y1 = Math.min(cropStart.y, cropEnd.y);
        const w = Math.abs(cropEnd.x - cropStart.x);
        const h = Math.abs(cropEnd.y - cropStart.y);
        const cx = x1 + w / 2;
        const cy = y1 + h / 2;

        // Dim everything
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Cut out crop region
        ctx.globalCompositeOperation = 'destination-out';
        if (cropMode === 'rect') {
          ctx.fillRect(x1, y1, w, h);
        } else if (cropMode === 'circle') {
          const r = Math.min(w, h) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (cropMode === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (cropMode === 'heart') {
          heartPath(ctx, cx, cy, w, h);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        // Draw border
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        if (cropMode === 'rect') {
          ctx.strokeRect(x1, y1, w, h);
        } else if (cropMode === 'circle') {
          const r = Math.min(w, h) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (cropMode === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (cropMode === 'heart') {
          heartPath(ctx, cx, cy, w, h);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // Highlight selected action for move tool
    if (tool === 'move' && movingActionIndex !== null && movingActionIndex < actions.length) {
      const action = actions[movingActionIndex];
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      if (action.type === 'text') {
        const { x, y, text, fontSize: fs } = action.data;
        const approxW = (fs || 24) * text.length * 0.6;
        ctx.strokeRect(x - 4, y - (fs || 24), approxW + 8, (fs || 24) * 1.3);
      } else if (action.type === 'arrow') {
        const { from, to } = action.data;
        const pad = 10;
        const minX = Math.min(from.x, to.x) - pad;
        const minY = Math.min(from.y, to.y) - pad;
        const maxX = Math.max(from.x, to.x) + pad;
        const maxY = Math.max(from.y, to.y) + pad;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, [image, processedImage, bgColor, bgImage, bgTransparent, rotation, zoom, actions, tool, cropMode, cropStart, cropEnd, cropLassoPoints, cropPending, movingActionIndex]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // Apply crop
  const applyCrop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // First render clean canvas without crop overlay
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = canvasW;
    srcCanvas.height = canvasH;
    const srcCtx = srcCanvas.getContext('2d')!;

    // Copy current rendered canvas before overlay
    // Re-render without crop overlay
    if (bgImage) {
      srcCtx.drawImage(bgImage, 0, 0, canvasW, canvasH);
    } else if (!bgTransparent) {
      srcCtx.fillStyle = bgColor;
      srcCtx.fillRect(0, 0, canvasW, canvasH);
    }
    const img = processedImage || image;
    if (img) {
      srcCtx.save();
      srcCtx.translate(canvasW / 2, canvasH / 2);
      srcCtx.rotate((rotation * Math.PI) / 180);
      srcCtx.scale(zoom, zoom);
      srcCtx.drawImage(img, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
      srcCtx.restore();
    }
    // Replay actions
    for (const action of actions) {
      if (action.type === 'draw') {
        const pts = action.data.points;
        if (pts.length < 2) continue;
        srcCtx.strokeStyle = action.data.color;
        srcCtx.lineWidth = action.data.size;
        srcCtx.lineCap = 'round';
        srcCtx.lineJoin = 'round';
        srcCtx.beginPath();
        srcCtx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) srcCtx.lineTo(pts[i].x, pts[i].y);
        srcCtx.stroke();
      } else if (action.type === 'text') {
        srcCtx.fillStyle = action.data.color;
        srcCtx.font = `${action.data.fontSize}px sans-serif`;
        srcCtx.fillText(action.data.text, action.data.x, action.data.y);
      } else if (action.type === 'arrow') {
        const { from, to, color, size } = action.data;
        srcCtx.strokeStyle = color;
        srcCtx.lineWidth = size;
        srcCtx.beginPath();
        srcCtx.moveTo(from.x, from.y);
        srcCtx.lineTo(to.x, to.y);
        srcCtx.stroke();
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = size * 5;
        srcCtx.beginPath();
        srcCtx.moveTo(to.x, to.y);
        srcCtx.lineTo(to.x - headLen * Math.cos(angle - 0.5), to.y - headLen * Math.sin(angle - 0.5));
        srcCtx.lineTo(to.x - headLen * Math.cos(angle + 0.5), to.y - headLen * Math.sin(angle + 0.5));
        srcCtx.closePath();
        srcCtx.fillStyle = color;
        srcCtx.fill();
      }
    }

    let resultCanvas: HTMLCanvasElement;

    if (cropMode === 'lasso' && cropLassoPoints.length > 2) {
      // Bounding box of lasso
      const xs = cropLassoPoints.map(p => p.x);
      const ys = cropLassoPoints.map(p => p.y);
      const bx = Math.max(0, Math.floor(Math.min(...xs)));
      const by = Math.max(0, Math.floor(Math.min(...ys)));
      const bw = Math.min(canvasW - bx, Math.ceil(Math.max(...xs) - bx));
      const bh = Math.min(canvasH - by, Math.ceil(Math.max(...ys) - by));

      resultCanvas = document.createElement('canvas');
      resultCanvas.width = bw;
      resultCanvas.height = bh;
      const rCtx = resultCanvas.getContext('2d')!;
      // Clip to lasso shape
      rCtx.beginPath();
      rCtx.moveTo(cropLassoPoints[0].x - bx, cropLassoPoints[0].y - by);
      for (let i = 1; i < cropLassoPoints.length; i++) rCtx.lineTo(cropLassoPoints[i].x - bx, cropLassoPoints[i].y - by);
      rCtx.closePath();
      rCtx.clip();
      rCtx.drawImage(srcCanvas, bx, by, bw, bh, 0, 0, bw, bh);
    } else if (cropStart && cropEnd) {
      const x1 = Math.max(0, Math.min(cropStart.x, cropEnd.x));
      const y1 = Math.max(0, Math.min(cropStart.y, cropEnd.y));
      const w = Math.min(canvasW - x1, Math.abs(cropEnd.x - cropStart.x));
      const h = Math.min(canvasH - y1, Math.abs(cropEnd.y - cropStart.y));
      const cx = x1 + w / 2;
      const cy = y1 + h / 2;

      if (cropMode === 'rect') {
        resultCanvas = document.createElement('canvas');
        resultCanvas.width = Math.round(w);
        resultCanvas.height = Math.round(h);
        const rCtx = resultCanvas.getContext('2d')!;
        rCtx.drawImage(srcCanvas, x1, y1, w, h, 0, 0, w, h);
      } else {
        // Circle, ellipse, heart — need transparent outside
        resultCanvas = document.createElement('canvas');
        resultCanvas.width = Math.round(w);
        resultCanvas.height = Math.round(h);
        const rCtx = resultCanvas.getContext('2d')!;
        rCtx.beginPath();
        if (cropMode === 'circle') {
          const r = Math.min(w, h) / 2;
          rCtx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
        } else if (cropMode === 'ellipse') {
          rCtx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        } else if (cropMode === 'heart') {
          heartPath(rCtx, w / 2, h / 2, w, h);
        }
        rCtx.closePath();
        rCtx.clip();
        rCtx.drawImage(srcCanvas, x1, y1, w, h, 0, 0, w, h);
      }
    } else {
      return; // No valid crop
    }

    // Apply result
    const newImg = new window.Image();
    newImg.onload = () => {
      setProcessedImage(newImg);
      setCanvasW(resultCanvas!.width);
      setCanvasH(resultCanvas!.height);
      setImage(null); // Clear original, processedImage is now the source
      setActions([]);
      setUndoneActions([]);
      setRotation(0);
      setZoom(1);
      setBgTransparent(cropMode !== 'rect');
      setCropPending(false);
      setCropStart(null);
      setCropEnd(null);
      setCropLassoPoints([]);
      toast({ title: t('imgEdit.cropApplied') || '裁剪已应用' });
    };
    newImg.src = resultCanvas!.toDataURL('image/png');
  }, [cropMode, cropStart, cropEnd, cropLassoPoints, canvasW, canvasH, bgImage, bgTransparent, bgColor, processedImage, image, rotation, zoom, actions, t]);

  const cancelCrop = useCallback(() => {
    setCropPending(false);
    setCropStart(null);
    setCropEnd(null);
    setCropLassoPoints([]);
  }, []);

  // Mouse/Touch handlers
  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);

    if (tool === 'move') {
      const idx = hitTestAction(pos);
      if (idx !== null) {
        setMovingActionIndex(idx);
        const action = actions[idx];
        if (action.type === 'text') {
          setMoveOffset({ x: pos.x - action.data.x, y: pos.y - action.data.y });
        } else if (action.type === 'arrow') {
          setMoveOffset({ x: pos.x - action.data.from.x, y: pos.y - action.data.from.y });
        }
        setIsDrawing(true);
      } else {
        setMovingActionIndex(null);
      }
    } else if (tool === 'crop') {
      if (cropMode === 'lasso') {
        setCropLassoPoints([pos]);
        setIsCropping(true);
        setCropPending(false);
      } else {
        setCropStart(pos);
        setCropEnd(pos);
        setIsCropping(true);
        setCropPending(false);
      }
    } else if (tool === 'draw' || tool === 'eraser') {
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
  }, [tool, getCanvasPos, textInput, drawColor, fontSize, hitTestAction, actions, cropMode]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);

    if (tool === 'move' && isDrawing && movingActionIndex !== null) {
      setActions(prev => {
        const updated = [...prev];
        const action = { ...updated[movingActionIndex], data: { ...updated[movingActionIndex].data } };
        if (action.type === 'text') {
          action.data.x = pos.x - moveOffset.x;
          action.data.y = pos.y - moveOffset.y;
        } else if (action.type === 'arrow') {
          const dx = pos.x - moveOffset.x - action.data.from.x;
          const dy = pos.y - moveOffset.y - action.data.from.y;
          action.data = {
            ...action.data,
            from: { x: action.data.from.x + dx, y: action.data.from.y + dy },
            to: { x: action.data.to.x + dx, y: action.data.to.y + dy },
          };
          setMoveOffset({ x: pos.x - action.data.from.x, y: pos.y - action.data.from.y });
        }
        updated[movingActionIndex] = action;
        return updated;
      });
      return;
    }

    if (tool === 'crop' && isCropping) {
      if (cropMode === 'lasso') {
        setCropLassoPoints(prev => [...prev, pos]);
      } else {
        setCropEnd(pos);
      }
      return;
    }

    if (!isDrawing && !arrowStart) return;

    if ((tool === 'draw' || tool === 'eraser') && isDrawing) {
      setDrawPoints(prev => [...prev, pos]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx && drawPoints.length > 0) {
          const last = drawPoints[drawPoints.length - 1];
          if (tool === 'draw') {
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = drawSize;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
          } else if (tool === 'eraser') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = drawSize;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            ctx.restore();
          }
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
  }, [tool, isDrawing, arrowStart, getCanvasPos, drawColor, drawSize, drawPoints, movingActionIndex, moveOffset, isCropping, cropMode]);

  const handlePointerUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'move' && isDrawing) {
      setIsDrawing(false);
      setMovingActionIndex(null);
      return;
    }

    if (tool === 'crop' && isCropping) {
      setIsCropping(false);
      setCropPending(true);
      return;
    }

    if (tool === 'draw' && isDrawing) {
      const action: DrawAction = {
        type: 'draw',
        data: { points: drawPoints, color: drawColor, size: drawSize },
      };
      setActions(prev => [...prev, action]);
      setUndoneActions([]);
    } else if (tool === 'eraser' && isDrawing) {
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = processedImage || image;
        if (img) ctx.drawImage(img, 0, 0, canvasW, canvasH);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = drawSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (drawPoints.length > 0) {
          ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
          for (let i = 1; i < drawPoints.length; i++) ctx.lineTo(drawPoints[i].x, drawPoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
        const resultImg = new window.Image();
        resultImg.onload = () => setProcessedImage(resultImg);
        resultImg.src = canvas.toDataURL('image/png');
      }
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
  }, [tool, isDrawing, drawPoints, drawColor, drawSize, arrowStart, getCanvasPos, processedImage, image, canvasW, canvasH, isCropping]);

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
    { id: 'eraser', icon: Eraser, label: t('imgEdit.eraser') },
    { id: 'crop', icon: Crop, label: t('imgEdit.crop') },
  ];

  const cropModes: { id: CropMode; icon: any; label: string }[] = [
    { id: 'rect', icon: Square, label: '矩形' },
    { id: 'circle', icon: Circle, label: '圆形' },
    { id: 'ellipse', icon: () => <Circle className="w-4 h-4 scale-x-75" />, label: '椭圆' },
    { id: 'heart', icon: Heart, label: '心形' },
    { id: 'lasso', icon: MousePointer2, label: '套索' },
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
            onClick={() => { setTool(tb.id); if (tb.id !== 'crop') cancelCrop(); }}
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
        {tool === 'eraser' && (
          <>
            <span className="text-xs text-muted-foreground ml-2">刷子大小</span>
            <input type="range" min={5} max={60} value={drawSize} onChange={e => setDrawSize(Number(e.target.value))} className="w-16" />
            <span className="text-xs text-foreground">{drawSize}px</span>
          </>
        )}
        {tool === 'text' && (
          <>
            <Input value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={t('imgEdit.textPlaceholder')} className="h-8 w-32 text-xs" />
            <input type="range" min={12} max={72} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-16" title={t('imgEdit.fontSize')} />
          </>
        )}
        {tool === 'crop' && (
          <div className="flex items-center gap-1">
            {cropModes.map(cm => (
              <Button
                key={cm.id}
                variant={cropMode === cm.id ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => { setCropMode(cm.id); cancelCrop(); }}
                title={cm.label}
              >
                <cm.icon className="w-3.5 h-3.5" /> <span className="hidden lg:inline">{cm.label}</span>
              </Button>
            ))}
            {cropPending && (
              <>
                <div className="w-px h-5 bg-border mx-1" />
                <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={applyCrop}>
                  <Check className="w-3.5 h-3.5" /> 应用
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={cancelCrop}>
                  <XCircle className="w-3.5 h-3.5" /> 取消
                </Button>
              </>
            )}
          </div>
        )}
        {tool === 'move' && (
          <span className="text-xs text-muted-foreground ml-2">点击拖拽文字或箭头进行移动</span>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-muted/30">
          {!image && !processedImage ? (
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
              style={{
                cursor: tool === 'move' ? (movingActionIndex !== null ? 'grabbing' : 'grab')
                  : tool === 'text' ? 'text'
                  : tool === 'crop' ? 'crosshair'
                  : 'crosshair'
              }}
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
        {(image || processedImage) && (
          <div className="w-56 border-l border-border bg-card p-4 overflow-y-auto space-y-4 hidden md:block">
            {/* AI Background Removal */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('imgEdit.bgSection')}</h4>
              <Button onClick={() => removeBackground('auto')} disabled={isRemoving} className="w-full gap-2" size="sm">
                {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                {isRemoving ? t('imgEdit.removing') : t('imgEdit.removeBg')}
              </Button>
              {removalMethod && (
                <p className="text-xs text-muted-foreground text-center">
                  {removalMethod === 'ai' ? '✨ AI' : '🎨 Local'}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs">容差</span>
                <input type="range" min={5} max={120} step={1} value={tolerance} onChange={e => setTolerance(Number(e.target.value))} className="w-24" disabled={isRemoving} title="调整颜色匹配灵敏度" />
                <span className="text-xs w-6 text-right">{tolerance}</span>
              </div>
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
                  <button key={c} className="w-full aspect-square rounded border border-border hover:ring-2 ring-primary/50 transition-all" style={{ backgroundColor: c }} onClick={() => { setBgColor(c); setBgTransparent(false); setBgImage(null); }} />
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => bgFileInputRef.current?.click()}>
                <Palette className="w-3.5 h-3.5 mr-1" /> {t('imgEdit.bgImage')}
              </Button>
              <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleBgImage(f); }} />
            </div>

            {/* Export */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('imgEdit.exportSection')}</h4>
              <div className="flex gap-1">
                {(['png', 'jpg', 'webp'] as const).map(fmt => (
                  <Button key={fmt} variant={exportFormat === fmt ? 'default' : 'outline'} size="sm" className="text-xs h-7 flex-1" onClick={() => setExportFormat(fmt)}>
                    {fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t('imgEdit.scale')}</span>
                <select value={exportScale} onChange={e => setExportScale(Number(e.target.value))} className="bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground">
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={3}>3x</option>
                </select>
                <span className="text-muted-foreground">{Math.round(canvasW * exportScale)}×{Math.round(canvasH * exportScale)}</span>
              </div>
              <Button onClick={handleExport} className="w-full gap-2" size="sm">
                <Download className="w-4 h-4" /> {t('imgEdit.download')}
              </Button>
            </div>

            {/* Reset */}
            <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={() => {
              setImage(null);
              setProcessedImage(null);
              setActions([]);
              setUndoneActions([]);
              setRotation(0);
              setZoom(1);
              setBgTransparent(false);
              setBgImage(null);
              setCropPending(false);
              setCropStart(null);
              setCropEnd(null);
              setCropLassoPoints([]);
            }}>
              <Trash2 className="w-3.5 h-3.5" /> {t('imgEdit.reset')}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile bottom bar */}
      {(image || processedImage) && (
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
