import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Upload, Eraser, Type, ArrowUpRight, Grid3X3, Pencil,
  Crop, RotateCcw, RotateCw, Undo2, Redo2, Download, ZoomIn, ZoomOut,
  Palette, Loader2, Eye, Trash2, Move, ImageIcon, Sparkles, Cpu,
  Square, Circle, Heart, MousePointer2, Check, XCircle, Wand2, Paintbrush, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { inpaintTelea, magicErase, inpaintLama, loadLamaModel, getLamaStatus } from './inpaint';
import HistoryPanel, { HistoryEntry } from './HistoryPanel';
import LayerPanel, { EditorLayer } from './LayerPanel';

type Tool = 'move' | 'text' | 'arrow' | 'mosaic' | 'draw' | 'crop' | 'eraser';
type EraserMode = 'transparent' | 'inpaint' | 'magic';
type CropMode = 'rect' | 'circle' | 'ellipse' | 'heart' | 'lasso';

interface DrawAction {
  type: 'draw' | 'text' | 'arrow' | 'mosaic' | 'image' | 'erase';
  data: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function heartPath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
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

  const [actions, setActions] = useState<DrawAction[]>([]);
  const [undoneActions, setUndoneActions] = useState<DrawAction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);

  // Move tool
  const [movingActionIndex, setMovingActionIndex] = useState<number | null>(null);
  const [moveOffset, setMoveOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Crop
  const [cropMode, setCropMode] = useState<CropMode>('rect');
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [cropLassoPoints, setCropLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [isCropping, setIsCropping] = useState(false);
  const [cropPending, setCropPending] = useState(false);

  // Eraser
  const [eraserMode, setEraserMode] = useState<EraserMode>('transparent');
  const [eraserSize, setEraserSize] = useState(20);
  const [eraserHardness, setEraserHardness] = useState(0.7);
  const [magicTolerance, setMagicTolerance] = useState(30);
  const [isInpainting, setIsInpainting] = useState(false);
  const [lamaProgress, setLamaProgress] = useState<number | null>(null);

  // Canvas dimensions
  const [canvasW, setCanvasW] = useState(800);
  const [canvasH, setCanvasH] = useState(600);

  // Cursor position for eraser preview
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

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

  const [tolerance, setTolerance] = useState(50);

  const removeBackgroundLocal = useCallback((src: HTMLImageElement, tol?: number): HTMLImageElement | null => {
    try {
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(src, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      const samples: number[][] = [];
      const samplePositions = [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1], [Math.floor(c.width / 2), 0], [0, Math.floor(c.height / 2)]];
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
        if (dist < toleranceValue) d[i + 3] = 0;
        else if (dist < toleranceValue * 1.5) d[i + 3] = Math.round(255 * ((dist - toleranceValue) / (toleranceValue * 0.5)));
      }
      ctx.putImageData(imgData, 0, 0);
      const resultImg = new Image();
      resultImg.src = c.toDataURL('image/png');
      return resultImg;
    } catch { return null; }
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
        tempCanvas.width = src.width; tempCanvas.height = src.height;
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(src, 0, 0);
        const base64 = tempCanvas.toDataURL('image/png');
        const { data, error } = await supabase.functions.invoke('remove-background', { body: { imageBase64: base64 } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const resultImg = new Image();
        await new Promise<void>((resolve, reject) => {
          resultImg.onload = () => resolve();
          resultImg.onerror = () => reject(new Error('fail'));
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
      } catch { return false; }
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
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      if (action.type === 'text') {
        const { x, y, text, fontSize: fs } = action.data;
        const approxW = (fs || 24) * text.length * 0.6;
        const approxH = (fs || 24) * 1.2;
        if (pos.x >= x - 5 && pos.x <= x + approxW + 5 && pos.y >= y - approxH && pos.y <= y + 10) return i;
      } else if (action.type === 'arrow') {
        const { from, to } = action.data;
        const dx = to.x - from.x, dy = to.y - from.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;
        let t0 = ((pos.x - from.x) * dx + (pos.y - from.y) * dy) / lenSq;
        t0 = Math.max(0, Math.min(1, t0));
        const projX = from.x + t0 * dx, projY = from.y + t0 * dy;
        const dist = Math.sqrt((pos.x - projX) ** 2 + (pos.y - projY) ** 2);
        if (dist < 15) return i;
      }
    }
    return null;
  }, [actions]);

  // Get current canvas snapshot as ImageData (without overlays)
  const getCanvasSnapshot = useCallback((): ImageData | null => {
    const c = document.createElement('canvas');
    c.width = canvasW; c.height = canvasH;
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    if (bgImage) ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
    else if (!bgTransparent) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvasW, canvasH); }

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
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
        ctx.strokeStyle = color; ctx.lineWidth = size;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = size * 5;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headLen * Math.cos(angle - 0.5), to.y - headLen * Math.sin(angle - 0.5));
        ctx.lineTo(to.x - headLen * Math.cos(angle + 0.5), to.y - headLen * Math.sin(angle + 0.5));
        ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      }
    }
    return ctx.getImageData(0, 0, canvasW, canvasH);
  }, [canvasW, canvasH, bgImage, bgTransparent, bgColor, processedImage, image, rotation, zoom, actions]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (bgImage) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    else if (!bgTransparent) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    else {
      const sz = 16;
      for (let y = 0; y < canvas.height; y += sz)
        for (let x = 0; x < canvas.width; x += sz) {
          ctx.fillStyle = ((x / sz + y / sz) % 2 === 0) ? '#e5e5e5' : '#ffffff';
          ctx.fillRect(x, y, sz, sz);
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
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
        ctx.strokeStyle = color; ctx.lineWidth = size;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = size * 5;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headLen * Math.cos(angle - 0.5), to.y - headLen * Math.sin(angle - 0.5));
        ctx.lineTo(to.x - headLen * Math.cos(angle + 0.5), to.y - headLen * Math.sin(angle + 0.5));
        ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      } else if (action.type === 'mosaic') {
        const { points, blockSize } = action.data;
        for (const pt of points) {
          const imgData2 = ctx.getImageData(pt.x - blockSize, pt.y - blockSize, blockSize * 2, blockSize * 2);
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < imgData2.data.length; i += 4) { r += imgData2.data[i]; g += imgData2.data[i + 1]; b += imgData2.data[i + 2]; count++; }
          if (count > 0) { ctx.fillStyle = `rgb(${Math.round(r / count)},${Math.round(g / count)},${Math.round(b / count)})`; ctx.fillRect(pt.x - blockSize, pt.y - blockSize, blockSize * 2, blockSize * 2); }
        }
      }
    }

    // Crop overlay
    if (tool === 'crop' && cropPending) {
      ctx.save();
      if (cropMode === 'lasso' && cropLassoPoints.length > 2) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(cropLassoPoints[0].x, cropLassoPoints[0].y);
        for (let i = 1; i < cropLassoPoints.length; i++) ctx.lineTo(cropLassoPoints[i].x, cropLassoPoints[i].y);
        ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(cropLassoPoints[0].x, cropLassoPoints[0].y);
        for (let i = 1; i < cropLassoPoints.length; i++) ctx.lineTo(cropLassoPoints[i].x, cropLassoPoints[i].y);
        ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      } else if (cropStart && cropEnd) {
        const x1 = Math.min(cropStart.x, cropEnd.x), y1 = Math.min(cropStart.y, cropEnd.y);
        const w = Math.abs(cropEnd.x - cropStart.x), h = Math.abs(cropEnd.y - cropStart.y);
        const cx = x1 + w / 2, cy = y1 + h / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-out';
        if (cropMode === 'rect') ctx.fillRect(x1, y1, w, h);
        else if (cropMode === 'circle') { const r = Math.min(w, h) / 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
        else if (cropMode === 'ellipse') { ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
        else if (cropMode === 'heart') { heartPath(ctx, cx, cy, w, h); ctx.fill(); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
        if (cropMode === 'rect') ctx.strokeRect(x1, y1, w, h);
        else if (cropMode === 'circle') { const r = Math.min(w, h) / 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
        else if (cropMode === 'ellipse') { ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
        else if (cropMode === 'heart') { heartPath(ctx, cx, cy, w, h); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // Move highlight
    if (tool === 'move' && movingActionIndex !== null && movingActionIndex < actions.length) {
      const action = actions[movingActionIndex];
      ctx.save();
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      if (action.type === 'text') {
        const { x, y, text, fontSize: fs } = action.data;
        const approxW = (fs || 24) * text.length * 0.6;
        ctx.strokeRect(x - 4, y - (fs || 24), approxW + 8, (fs || 24) * 1.3);
      } else if (action.type === 'arrow') {
        const { from, to } = action.data;
        const pad = 10;
        ctx.strokeRect(Math.min(from.x, to.x) - pad, Math.min(from.y, to.y) - pad, Math.abs(to.x - from.x) + pad * 2, Math.abs(to.y - from.y) + pad * 2);
      }
      ctx.setLineDash([]); ctx.restore();
    }

    // Eraser cursor preview
    if (tool === 'eraser' && cursorPos && (eraserMode === 'transparent' || eraserMode === 'inpaint')) {
      ctx.save();
      ctx.strokeStyle = eraserMode === 'inpaint' ? '#f59e0b' : '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, eraserSize, 0, Math.PI * 2);
      ctx.stroke();
      // Inner circle for hardness
      if (eraserMode === 'transparent') {
        ctx.beginPath();
        ctx.arc(cursorPos.x, cursorPos.y, eraserSize * eraserHardness, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.restore();
    }
  }, [image, processedImage, bgColor, bgImage, bgTransparent, rotation, zoom, actions, tool, cropMode, cropStart, cropEnd, cropLassoPoints, cropPending, movingActionIndex, cursorPos, eraserMode, eraserSize, eraserHardness]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // Apply crop
  const applyCrop = useCallback(() => {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = canvasW; srcCanvas.height = canvasH;
    const srcCtx = srcCanvas.getContext('2d')!;

    if (bgImage) srcCtx.drawImage(bgImage, 0, 0, canvasW, canvasH);
    else if (!bgTransparent) { srcCtx.fillStyle = bgColor; srcCtx.fillRect(0, 0, canvasW, canvasH); }
    const img = processedImage || image;
    if (img) {
      srcCtx.save();
      srcCtx.translate(canvasW / 2, canvasH / 2);
      srcCtx.rotate((rotation * Math.PI) / 180);
      srcCtx.scale(zoom, zoom);
      srcCtx.drawImage(img, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
      srcCtx.restore();
    }
    for (const action of actions) {
      if (action.type === 'draw') {
        const pts = action.data.points;
        if (pts.length < 2) continue;
        srcCtx.strokeStyle = action.data.color; srcCtx.lineWidth = action.data.size;
        srcCtx.lineCap = 'round'; srcCtx.lineJoin = 'round';
        srcCtx.beginPath(); srcCtx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) srcCtx.lineTo(pts[i].x, pts[i].y);
        srcCtx.stroke();
      } else if (action.type === 'text') {
        srcCtx.fillStyle = action.data.color;
        srcCtx.font = `${action.data.fontSize}px sans-serif`;
        srcCtx.fillText(action.data.text, action.data.x, action.data.y);
      } else if (action.type === 'arrow') {
        const { from, to, color, size } = action.data;
        srcCtx.strokeStyle = color; srcCtx.lineWidth = size;
        srcCtx.beginPath(); srcCtx.moveTo(from.x, from.y); srcCtx.lineTo(to.x, to.y); srcCtx.stroke();
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = size * 5;
        srcCtx.beginPath(); srcCtx.moveTo(to.x, to.y);
        srcCtx.lineTo(to.x - headLen * Math.cos(angle - 0.5), to.y - headLen * Math.sin(angle - 0.5));
        srcCtx.lineTo(to.x - headLen * Math.cos(angle + 0.5), to.y - headLen * Math.sin(angle + 0.5));
        srcCtx.closePath(); srcCtx.fillStyle = color; srcCtx.fill();
      }
    }

    let resultCanvas: HTMLCanvasElement;

    if (cropMode === 'lasso' && cropLassoPoints.length > 2) {
      const xs = cropLassoPoints.map(p => p.x), ys = cropLassoPoints.map(p => p.y);
      const bx = Math.max(0, Math.floor(Math.min(...xs)));
      const by = Math.max(0, Math.floor(Math.min(...ys)));
      const bw = Math.min(canvasW - bx, Math.ceil(Math.max(...xs) - bx));
      const bh = Math.min(canvasH - by, Math.ceil(Math.max(...ys) - by));
      resultCanvas = document.createElement('canvas');
      resultCanvas.width = bw; resultCanvas.height = bh;
      const rCtx = resultCanvas.getContext('2d')!;
      rCtx.beginPath();
      rCtx.moveTo(cropLassoPoints[0].x - bx, cropLassoPoints[0].y - by);
      for (let i = 1; i < cropLassoPoints.length; i++) rCtx.lineTo(cropLassoPoints[i].x - bx, cropLassoPoints[i].y - by);
      rCtx.closePath(); rCtx.clip();
      rCtx.drawImage(srcCanvas, bx, by, bw, bh, 0, 0, bw, bh);
    } else if (cropStart && cropEnd) {
      const x1 = Math.max(0, Math.min(cropStart.x, cropEnd.x));
      const y1 = Math.max(0, Math.min(cropStart.y, cropEnd.y));
      const w = Math.min(canvasW - x1, Math.abs(cropEnd.x - cropStart.x));
      const h = Math.min(canvasH - y1, Math.abs(cropEnd.y - cropStart.y));
      if (cropMode === 'rect') {
        resultCanvas = document.createElement('canvas');
        resultCanvas.width = Math.round(w); resultCanvas.height = Math.round(h);
        resultCanvas.getContext('2d')!.drawImage(srcCanvas, x1, y1, w, h, 0, 0, w, h);
      } else {
        resultCanvas = document.createElement('canvas');
        resultCanvas.width = Math.round(w); resultCanvas.height = Math.round(h);
        const rCtx = resultCanvas.getContext('2d')!;
        rCtx.beginPath();
        if (cropMode === 'circle') { const r = Math.min(w, h) / 2; rCtx.arc(w / 2, h / 2, r, 0, Math.PI * 2); }
        else if (cropMode === 'ellipse') rCtx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        else if (cropMode === 'heart') heartPath(rCtx, w / 2, h / 2, w, h);
        rCtx.closePath(); rCtx.clip();
        rCtx.drawImage(srcCanvas, x1, y1, w, h, 0, 0, w, h);
      }
    } else return;

    const newImg = new window.Image();
    newImg.onload = () => {
      setProcessedImage(newImg);
      setCanvasW(resultCanvas!.width); setCanvasH(resultCanvas!.height);
      setImage(null);
      setActions([]); setUndoneActions([]);
      setRotation(0); setZoom(1);
      setBgTransparent(cropMode !== 'rect');
      setCropPending(false); setCropStart(null); setCropEnd(null); setCropLassoPoints([]);
      toast({ title: '裁剪已应用' });
    };
    newImg.src = resultCanvas!.toDataURL('image/png');
  }, [cropMode, cropStart, cropEnd, cropLassoPoints, canvasW, canvasH, bgImage, bgTransparent, bgColor, processedImage, image, rotation, zoom, actions]);

  const cancelCrop = useCallback(() => {
    setCropPending(false); setCropStart(null); setCropEnd(null); setCropLassoPoints([]);
  }, []);

  // Apply soft eraser stroke to processedImage
  const applySoftErase = useCallback((points: { x: number; y: number }[]) => {
    if (points.length < 1) return;
    const c = document.createElement('canvas');
    c.width = canvasW; c.height = canvasH;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const img = processedImage || image;
    if (img) ctx.drawImage(img, 0, 0, canvasW, canvasH);

    // Apply soft erase with hardness
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    // Create radial gradient brush
    for (const pt of points) {
      const gradient = ctx.createRadialGradient(pt.x, pt.y, eraserSize * eraserHardness, pt.x, pt.y, eraserSize);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, eraserSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const resultImg = new window.Image();
    resultImg.onload = () => setProcessedImage(resultImg);
    resultImg.src = c.toDataURL('image/png');
  }, [canvasW, canvasH, processedImage, image, eraserSize, eraserHardness]);

  // Apply inpainting erase
  const applyInpaintErase = useCallback(async (points: { x: number; y: number }[]) => {
    if (points.length < 1) return;
    setIsInpainting(true);

    const snapshot = getCanvasSnapshot();
    if (!snapshot) { setIsInpainting(false); return; }

    // Build mask from eraser stroke
    const maskData = new Uint8Array(canvasW * canvasH);
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvasW; maskCanvas.height = canvasH;
    const mCtx = maskCanvas.getContext('2d')!;
    mCtx.fillStyle = 'black';
    mCtx.fillRect(0, 0, canvasW, canvasH);
    mCtx.fillStyle = 'white';
    mCtx.strokeStyle = 'white';
    mCtx.lineWidth = eraserSize * 2;
    mCtx.lineCap = 'round'; mCtx.lineJoin = 'round';
    if (points.length === 1) {
      mCtx.beginPath();
      mCtx.arc(points[0].x, points[0].y, eraserSize, 0, Math.PI * 2);
      mCtx.fill();
    } else {
      mCtx.beginPath();
      mCtx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) mCtx.lineTo(points[i].x, points[i].y);
      mCtx.stroke();
    }
    const mImgData = mCtx.getImageData(0, 0, canvasW, canvasH);
    for (let i = 0; i < maskData.length; i++) {
      maskData[i] = mImgData.data[i * 4] > 128 ? 1 : 0;
    }

    // Try LaMa first, fallback to Telea
    let result: ImageData | null = null;
    const lamaStatus = getLamaStatus();

    if (lamaStatus.loaded) {
      result = await inpaintLama(snapshot, maskData);
    }

    if (!result) {
      // Use Telea algorithm
      result = inpaintTelea(snapshot, maskData, Math.max(5, Math.round(eraserSize * 0.8)));
    }

    if (result) {
      const c = document.createElement('canvas');
      c.width = canvasW; c.height = canvasH;
      c.getContext('2d')!.putImageData(result, 0, 0);
      const newImg = new window.Image();
      newImg.onload = () => {
        setProcessedImage(newImg);
        setImage(null);
        setActions([]);
        setUndoneActions([]);
        toast({ title: '内容感知填充完成' });
      };
      newImg.src = c.toDataURL('image/png');
    }
    setIsInpainting(false);
  }, [canvasW, canvasH, getCanvasSnapshot, eraserSize]);

  // Apply magic eraser
  const applyMagicErase = useCallback((pos: { x: number; y: number }) => {
    const snapshot = getCanvasSnapshot();
    if (!snapshot) return;

    const result = magicErase(snapshot, pos.x, pos.y, magicTolerance, 3);
    const c = document.createElement('canvas');
    c.width = canvasW; c.height = canvasH;
    c.getContext('2d')!.putImageData(result, 0, 0);

    const newImg = new window.Image();
    newImg.onload = () => {
      setProcessedImage(newImg);
      setImage(null);
      setActions([]);
      setUndoneActions([]);
      setBgTransparent(true);
      toast({ title: '魔术擦除完成' });
    };
    newImg.src = c.toDataURL('image/png');
  }, [canvasW, canvasH, getCanvasSnapshot, magicTolerance]);

  // Load LaMa model in background
  const handleLoadLama = useCallback(async () => {
    setLamaProgress(0);
    const ok = await loadLamaModel((pct) => setLamaProgress(pct));
    setLamaProgress(null);
    if (ok) toast({ title: 'LaMa 模型加载成功', description: '内容感知填充已升级为 AI 驱动' });
    else toast({ title: 'LaMa 模型加载失败', description: '将使用经典算法进行内容填充', variant: 'destructive' });
  }, []);

  // Pointer handlers
  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);

    if (tool === 'move') {
      const idx = hitTestAction(pos);
      if (idx !== null) {
        setMovingActionIndex(idx);
        const action = actions[idx];
        if (action.type === 'text') setMoveOffset({ x: pos.x - action.data.x, y: pos.y - action.data.y });
        else if (action.type === 'arrow') setMoveOffset({ x: pos.x - action.data.from.x, y: pos.y - action.data.from.y });
        setIsDrawing(true);
      } else setMovingActionIndex(null);
    } else if (tool === 'crop') {
      if (cropMode === 'lasso') { setCropLassoPoints([pos]); setIsCropping(true); setCropPending(false); }
      else { setCropStart(pos); setCropEnd(pos); setIsCropping(true); setCropPending(false); }
    } else if (tool === 'eraser') {
      if (eraserMode === 'magic') {
        applyMagicErase(pos);
      } else {
        setIsDrawing(true);
        setDrawPoints([pos]);
      }
    } else if (tool === 'draw') {
      setIsDrawing(true);
      setDrawPoints([pos]);
    } else if (tool === 'arrow') {
      setArrowStart(pos);
    } else if (tool === 'text') {
      if (textInput.trim()) {
        setActions(prev => [...prev, { type: 'text', data: { text: textInput, x: pos.x, y: pos.y, color: drawColor, fontSize } }]);
        setUndoneActions([]);
        setTextInput('');
      }
    } else if (tool === 'mosaic') {
      setIsDrawing(true);
      setDrawPoints([pos]);
    }
  }, [tool, getCanvasPos, textInput, drawColor, fontSize, hitTestAction, actions, cropMode, eraserMode, applyMagicErase]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);

    // Update cursor position for eraser preview
    if (tool === 'eraser') setCursorPos(pos);
    else setCursorPos(null);

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
          action.data = { ...action.data, from: { x: action.data.from.x + dx, y: action.data.from.y + dy }, to: { x: action.data.to.x + dx, y: action.data.to.y + dy } };
          setMoveOffset({ x: pos.x - action.data.from.x, y: pos.y - action.data.from.y });
        }
        updated[movingActionIndex] = action;
        return updated;
      });
      return;
    }

    if (tool === 'crop' && isCropping) {
      if (cropMode === 'lasso') setCropLassoPoints(prev => [...prev, pos]);
      else setCropEnd(pos);
      return;
    }

    if (!isDrawing && !arrowStart) return;

    if (tool === 'eraser' && isDrawing && eraserMode !== 'magic') {
      setDrawPoints(prev => [...prev, pos]);
      // Live preview for transparent eraser
      if (eraserMode === 'transparent') {
        const canvas = canvasRef.current;
        if (canvas && drawPoints.length > 0) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const last = drawPoints[drawPoints.length - 1];
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            const gradient = ctx.createRadialGradient(pos.x, pos.y, eraserSize * eraserHardness, pos.x, pos.y, eraserSize);
            gradient.addColorStop(0, 'rgba(0,0,0,1)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, eraserSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      } else if (eraserMode === 'inpaint') {
        // For inpaint, draw a highlight on the mask area
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, eraserSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    } else if (tool === 'draw' && isDrawing) {
      setDrawPoints(prev => [...prev, pos]);
      const canvas = canvasRef.current;
      if (canvas && drawPoints.length > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const last = drawPoints[drawPoints.length - 1];
          ctx.strokeStyle = drawColor;
          ctx.lineWidth = drawSize;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        }
      }
    } else if (tool === 'mosaic' && isDrawing) {
      setDrawPoints(prev => [...prev, pos]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const blockSize = 8;
          const imgData2 = ctx.getImageData(pos.x - blockSize, pos.y - blockSize, blockSize * 2, blockSize * 2);
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < imgData2.data.length; i += 4) { r += imgData2.data[i]; g += imgData2.data[i + 1]; b += imgData2.data[i + 2]; count++; }
          if (count > 0) { ctx.fillStyle = `rgb(${Math.round(r / count)},${Math.round(g / count)},${Math.round(b / count)})`; ctx.fillRect(pos.x - blockSize, pos.y - blockSize, blockSize * 2, blockSize * 2); }
        }
      }
    }
  }, [tool, isDrawing, arrowStart, getCanvasPos, drawColor, drawSize, drawPoints, movingActionIndex, moveOffset, isCropping, cropMode, eraserMode, eraserSize, eraserHardness]);

  const handlePointerUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'move' && isDrawing) {
      setIsDrawing(false); setMovingActionIndex(null); return;
    }
    if (tool === 'crop' && isCropping) {
      setIsCropping(false); setCropPending(true); return;
    }
    if (tool === 'eraser' && isDrawing) {
      if (eraserMode === 'transparent') {
        applySoftErase(drawPoints);
      } else if (eraserMode === 'inpaint') {
        applyInpaintErase(drawPoints);
      }
      setIsDrawing(false); setDrawPoints([]); return;
    }
    if (tool === 'draw' && isDrawing) {
      setActions(prev => [...prev, { type: 'draw', data: { points: drawPoints, color: drawColor, size: drawSize } }]);
      setUndoneActions([]);
    } else if (tool === 'arrow' && arrowStart) {
      const pos = getCanvasPos(e);
      setActions(prev => [...prev, { type: 'arrow', data: { from: arrowStart, to: pos, color: drawColor, size: drawSize } }]);
      setUndoneActions([]);
      setArrowStart(null);
    } else if (tool === 'mosaic' && isDrawing) {
      setActions(prev => [...prev, { type: 'mosaic', data: { points: drawPoints, blockSize: 8 } }]);
      setUndoneActions([]);
    }
    setIsDrawing(false);
    setDrawPoints([]);
  }, [tool, isDrawing, drawPoints, drawColor, drawSize, arrowStart, getCanvasPos, isCropping, eraserMode, applySoftErase, applyInpaintErase]);

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

  const handleExport = useCallback(() => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.round(canvasW * exportScale);
    exportCanvas.height = Math.round(canvasH * exportScale);
    const ctx = exportCanvas.getContext('2d')!;
    ctx.scale(exportScale, exportScale);
    if (bgImage) ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
    else if (!bgTransparent || exportFormat !== 'png') { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvasW, canvasH); }
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
        ctx.strokeStyle = action.data.color; ctx.lineWidth = action.data.size;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      } else if (action.type === 'text') {
        ctx.fillStyle = action.data.color;
        ctx.font = `${action.data.fontSize}px sans-serif`;
        ctx.fillText(action.data.text, action.data.x, action.data.y);
      } else if (action.type === 'arrow') {
        const { from, to, color, size } = action.data;
        ctx.strokeStyle = color; ctx.lineWidth = size;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = size * 5;
        ctx.beginPath(); ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headLen * Math.cos(angle - 0.5), to.y - headLen * Math.sin(angle - 0.5));
        ctx.lineTo(to.x - headLen * Math.cos(angle + 0.5), to.y - headLen * Math.sin(angle + 0.5));
        ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      }
    }
    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const;
    const link = document.createElement('a');
    link.download = `edited-image.${exportFormat}`;
    link.href = exportCanvas.toDataURL(mimeMap[exportFormat], 0.92);
    link.click();
    toast({ title: t('imgEdit.exported') });
  }, [canvasW, canvasH, exportScale, bgImage, bgTransparent, bgColor, processedImage, image, rotation, zoom, actions, exportFormat, t]);

  const handleBgImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => { setBgImage(img); setBgTransparent(false); };
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

  const eraserModes: { id: EraserMode; icon: any; label: string; desc: string }[] = [
    { id: 'transparent', icon: EyeOff, label: '透明擦除', desc: '柔边擦除为透明' },
    { id: 'inpaint', icon: Paintbrush, label: '内容填充', desc: 'AI智能填充擦除区域' },
    { id: 'magic', icon: Wand2, label: '魔术擦除', desc: '点击擦除相似颜色区域' },
  ];

  const lamaStatus = getLamaStatus();

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

        {/* Tool-specific options */}
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

        {/* Eraser sub-toolbar */}
        {tool === 'eraser' && (
          <div className="flex items-center gap-1 flex-wrap">
            {eraserModes.map(em => (
              <Button
                key={em.id}
                variant={eraserMode === em.id ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setEraserMode(em.id)}
                title={em.desc}
              >
                <em.icon className="w-3.5 h-3.5" /> <span className="hidden lg:inline">{em.label}</span>
              </Button>
            ))}
            <div className="w-px h-5 bg-border mx-1" />
            {(eraserMode === 'transparent' || eraserMode === 'inpaint') && (
              <>
                <span className="text-xs text-muted-foreground">大小</span>
                <input type="range" min={5} max={80} value={eraserSize} onChange={e => setEraserSize(Number(e.target.value))} className="w-16" />
                <span className="text-xs text-foreground w-6">{eraserSize}</span>
              </>
            )}
            {eraserMode === 'transparent' && (
              <>
                <span className="text-xs text-muted-foreground ml-1">硬度</span>
                <input type="range" min={0} max={100} value={Math.round(eraserHardness * 100)} onChange={e => setEraserHardness(Number(e.target.value) / 100)} className="w-14" />
                <span className="text-xs text-foreground w-8">{Math.round(eraserHardness * 100)}%</span>
              </>
            )}
            {eraserMode === 'magic' && (
              <>
                <span className="text-xs text-muted-foreground">容差</span>
                <input type="range" min={5} max={100} value={magicTolerance} onChange={e => setMagicTolerance(Number(e.target.value))} className="w-16" />
                <span className="text-xs text-foreground w-6">{magicTolerance}</span>
              </>
            )}
            {eraserMode === 'inpaint' && (
              <Button
                variant={lamaStatus.loaded ? 'ghost' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs gap-1 ml-1"
                onClick={handleLoadLama}
                disabled={lamaStatus.loading}
                title={lamaStatus.loaded ? 'LaMa AI 已就绪' : '加载 LaMa AI 模型以获得更佳效果'}
              >
                {lamaStatus.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {lamaStatus.loaded ? 'AI ✓' : lamaProgress !== null ? `${lamaProgress}%` : 'Load AI'}
              </Button>
            )}
            {isInpainting && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> 填充中...
              </span>
            )}
          </div>
        )}

        {/* Crop sub-toolbar */}
        {tool === 'crop' && (
          <div className="flex items-center gap-1">
            {cropModes.map(cm => (
              <Button key={cm.id} variant={cropMode === cm.id ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setCropMode(cm.id); cancelCrop(); }} title={cm.label}>
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
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              className="border border-border rounded-lg shadow-sm max-w-full max-h-full"
              style={{
                cursor: tool === 'move' ? (movingActionIndex !== null ? 'grabbing' : 'grab')
                  : tool === 'eraser' ? 'none'
                  : tool === 'text' ? 'text'
                  : 'crosshair'
              }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={() => setCursorPos(null)}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          )}
        </div>

        {/* Right sidebar */}
        {(image || processedImage) && (
          <div className="w-56 border-l border-border bg-card p-4 overflow-y-auto space-y-4 hidden md:block">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('imgEdit.bgSection')}</h4>
              <Button onClick={() => removeBackground('auto')} disabled={isRemoving} className="w-full gap-2" size="sm">
                {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                {isRemoving ? t('imgEdit.removing') : t('imgEdit.removeBg')}
              </Button>
              {removalMethod && <p className="text-xs text-muted-foreground text-center">{removalMethod === 'ai' ? '✨ AI' : '🎨 Local'}</p>}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs">容差</span>
                <input type="range" min={5} max={120} step={1} value={tolerance} onChange={e => setTolerance(Number(e.target.value))} className="w-24" disabled={isRemoving} />
                <span className="text-xs w-6 text-right">{tolerance}</span>
              </div>
            </div>

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
                <span>{Math.round(canvasW * exportScale)}×{Math.round(canvasH * exportScale)}</span>
              </div>
              <Button onClick={handleExport} className="w-full gap-2" size="sm">
                <Download className="w-4 h-4" /> {t('imgEdit.download')}
              </Button>
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={() => {
              setImage(null); setProcessedImage(null); setActions([]); setUndoneActions([]);
              setRotation(0); setZoom(1); setBgTransparent(false); setBgImage(null);
              setCropPending(false); setCropStart(null); setCropEnd(null); setCropLassoPoints([]);
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
