import { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ArrowUpRight,
  Brush,
  Camera,
  Crop,
  Download,
  Highlighter,
  Monitor,
  RefreshCcw,
  Square,
  StopCircle,
  Type,
  Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

type SourceMode = 'screen' | 'window' | 'browser';
type EditorTool = 'none' | 'crop' | 'draw' | 'highlight' | 'rect' | 'arrow' | 'text' | 'mosaic';
type WorkflowStep = 'source' | 'capture' | 'edit' | 'export';

interface ImagePoint {
  x: number;
  y: number;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface StrokeAnnotation {
  id: string;
  kind: 'draw' | 'highlight';
  color: string;
  size: number;
  opacity: number;
  points: ImagePoint[];
}

interface RectAnnotation {
  id: string;
  kind: 'rect';
  color: string;
  size: number;
  opacity: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ArrowAnnotation {
  id: string;
  kind: 'arrow';
  color: string;
  size: number;
  opacity: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface TextAnnotation {
  id: string;
  kind: 'text';
  color: string;
  size: number;
  opacity: number;
  x: number;
  y: number;
  text: string;
}

interface MosaicAnnotation {
  id: string;
  kind: 'mosaic';
  size: number;
  opacity: number;
  x: number;
  y: number;
  w: number;
  h: number;
  block: number;
}

type Annotation = StrokeAnnotation | RectAnnotation | ArrowAnnotation | TextAnnotation | MosaicAnnotation;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pointsToSvgPath(points: ImagePoint[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(10, size * 3.5);
  const spread = Math.PI / 7;
  return [
    { x: x2, y: y2 },
    { x: x2 - len * Math.cos(angle - spread), y: y2 - len * Math.sin(angle - spread) },
    { x: x2 - len * Math.cos(angle + spread), y: y2 - len * Math.sin(angle + spread) },
  ];
}

function drawArrowOnCanvas(ctx: CanvasRenderingContext2D, annotation: ArrowAnnotation) {
  ctx.beginPath();
  ctx.moveTo(annotation.x1, annotation.y1);
  ctx.lineTo(annotation.x2, annotation.y2);
  ctx.stroke();

  const [tip, left, right] = arrowHeadPoints(annotation.x1, annotation.y1, annotation.x2, annotation.y2, annotation.size);
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fillStyle = annotation.color;
  ctx.globalAlpha = annotation.opacity;
  ctx.fill();
}

function drawMosaicOnCanvas(ctx: CanvasRenderingContext2D, annotation: MosaicAnnotation) {
  const x = Math.round(annotation.x);
  const y = Math.round(annotation.y);
  const w = Math.round(annotation.w);
  const h = Math.round(annotation.h);
  if (w < 2 || h < 2) return;

  const imageData = ctx.getImageData(x, y, w, h);
  const pixels = imageData.data;
  const block = Math.max(4, annotation.block);

  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      const bw = Math.min(block, w - bx);
      const bh = Math.min(block, h - by);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let py = 0; py < bh; py += 1) {
        for (let px = 0; px < bw; px += 1) {
          const idx = ((by + py) * w + (bx + px)) * 4;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
          a += pixels[idx + 3];
          count += 1;
        }
      }

      const avgR = Math.round(r / count);
      const avgG = Math.round(g / count);
      const avgB = Math.round(b / count);
      const avgA = Math.round(a / count);

      for (let py = 0; py < bh; py += 1) {
        for (let px = 0; px < bw; px += 1) {
          const idx = ((by + py) * w + (bx + px)) * 4;
          pixels[idx] = avgR;
          pixels[idx + 1] = avgG;
          pixels[idx + 2] = avgB;
          pixels[idx + 3] = avgA;
        }
      }
    }
  }

  ctx.putImageData(imageData, x, y);
}

function drawAnnotations(ctx: CanvasRenderingContext2D, annotations: Annotation[]) {
  for (const annotation of annotations) {
    ctx.save();
    ctx.globalAlpha = annotation.opacity;
    ctx.strokeStyle = 'color' in annotation ? annotation.color : '#0f172a';
    ctx.lineWidth = annotation.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (annotation.kind === 'rect') {
      ctx.strokeRect(annotation.x, annotation.y, annotation.w, annotation.h);
    } else if (annotation.kind === 'arrow') {
      drawArrowOnCanvas(ctx, annotation);
    } else if (annotation.kind === 'text') {
      ctx.fillStyle = annotation.color;
      ctx.font = `${Math.max(14, annotation.size * 4)}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(annotation.text, annotation.x, annotation.y);
    } else if (annotation.kind === 'mosaic') {
      drawMosaicOnCanvas(ctx, annotation);
      ctx.strokeStyle = 'rgba(15,23,42,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(annotation.x, annotation.y, annotation.w, annotation.h);
    } else if (annotation.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
      for (let index = 1; index < annotation.points.length; index += 1) {
        ctx.lineTo(annotation.points[index].x, annotation.points[index].y);
      }
      if (annotation.points.length === 1) {
        ctx.lineTo(annotation.points[0].x + 0.01, annotation.points[0].y + 0.01);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

async function loadImage(src: string) {
  const img = new Image();
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load failed'));
  });
  img.src = src;
  return promise;
}

const WORKFLOW_STEPS: WorkflowStep[] = ['source', 'capture', 'edit', 'export'];

export default function ScreenCaptureTool() {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>('screen');
  const [captured, setCaptured] = useState('');
  const [originalCapture, setOriginalCapture] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imageBox, setImageBox] = useState<ImageBox | null>(null);
  const [tool, setTool] = useState<EditorTool>('none');
  const [color, setColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(6);
  const [textDraft, setTextDraft] = useState('');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draftAnnotation, setDraftAnnotation] = useState<Annotation | null>(null);
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('source');

  const updateImageBox = useCallback(() => {
    const preview = previewRef.current;
    const image = imageRef.current;
    if (!preview || !image || !captured) {
      setImageBox(null);
      return;
    }

    const previewRect = preview.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();

    setImageBox({
      left: imageRect.left - previewRect.left,
      top: imageRect.top - previewRect.top,
      width: imageRect.width,
      height: imageRect.height,
    });
  }, [captured]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (!captured) return;
    updateImageBox();
    const handleResize = () => updateImageBox();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [captured, updateImageBox]);

  const resetEditorState = useCallback(() => {
    setTool('none');
    setCropRect(null);
    setAnnotations([]);
    setDraftAnnotation(null);
    setDragging(false);
  }, []);

  const applyCapturedImage = useCallback(
    async (dataUrl: string, options?: { keepOriginal?: boolean; notice?: string }) => {
      const img = await loadImage(dataUrl);
      if (!options?.keepOriginal) {
        setOriginalCapture(dataUrl);
      }
      setCaptured(dataUrl);
      setImageSize({ width: img.width, height: img.height });
      resetEditorState();
      setWorkflowStep('edit');
      if (options?.notice) {
        toast({ title: options.notice });
      }
    },
    [resetEditorState],
  );

  const getImagePoint = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const box = imageBox;
      const preview = previewRef.current?.getBoundingClientRect();
      if (!box || !preview || imageSize.width === 0 || imageSize.height === 0) return null;

      const relativeX = event.clientX - preview.left;
      const relativeY = event.clientY - preview.top;
      const localX = relativeX - box.left;
      const localY = relativeY - box.top;

      if (localX < 0 || localY < 0 || localX > box.width || localY > box.height) {
        return null;
      }

      return {
        x: clamp((localX / box.width) * imageSize.width, 0, imageSize.width),
        y: clamp((localY / box.height) * imageSize.height, 0, imageSize.height),
      };
    },
    [imageBox, imageSize.height, imageSize.width],
  );

  const getFrameDataUrl = useCallback(async () => {
    if (!stream) {
      throw new Error('no-stream');
    }

    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error('no-track');
    }

    const canvas = document.createElement('canvas');

    if ('ImageCapture' in window) {
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no-context');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    } else {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('no-frame');
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no-context');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    return canvas.toDataURL('image/png');
  }, [stream]);

  const startShare = async () => {
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: sourceMode === 'screen' ? 'monitor' : sourceMode,
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: false,
      });
      setStream(media);
      setWorkflowStep('capture');
      const [track] = media.getVideoTracks();
      track.onended = () => setStream(null);
    } catch {
      toast({ title: t('capture.permissionDenied'), variant: 'destructive' });
    }
  };

  const stopShare = () => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    setStream(null);
  };

  const captureVisibleArea = async () => {
    try {
      const dataUrl = await getFrameDataUrl();
      await applyCapturedImage(dataUrl, { notice: t('capture.captured') });
    } catch {
      toast({ title: t('capture.noFrame'), variant: 'destructive' });
    }
  };

  const captureRegion = async () => {
    try {
      const dataUrl = await getFrameDataUrl();
      await applyCapturedImage(dataUrl, { notice: t('capture.cropReady') });
      setTool('crop');
    } catch {
      toast({ title: t('capture.noFrame'), variant: 'destructive' });
    }
  };

  const captureCurrentPageLong = async () => {
    try {
      const root = document.documentElement;
      const canvas = await html2canvas(root, {
        backgroundColor: '#ffffff',
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        width: root.scrollWidth,
        height: root.scrollHeight,
        windowWidth: root.scrollWidth,
        windowHeight: root.scrollHeight,
        scrollX: 0,
        scrollY: 0,
      });
      await applyCapturedImage(canvas.toDataURL('image/png'), { notice: t('capture.longPageCaptured') });
    } catch {
      toast({ title: t('capture.longPageFailed'), variant: 'destructive' });
    }
  };

  const buildMergedCanvas = useCallback(async () => {
    if (!captured) return null;
    const img = await loadImage(captured);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawAnnotations(ctx, annotations);
    return canvas;
  }, [annotations, captured]);

  const applyCrop = async () => {
    if (!captured || !cropRect || cropRect.w < 4 || cropRect.h < 4) {
      toast({ title: t('capture.noCropArea'), variant: 'destructive' });
      return;
    }

    const source = await buildMergedCanvas();
    if (!source) return;

    const nextCanvas = document.createElement('canvas');
    nextCanvas.width = Math.round(cropRect.w);
    nextCanvas.height = Math.round(cropRect.h);
    const ctx = nextCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      source,
      Math.round(cropRect.x),
      Math.round(cropRect.y),
      Math.round(cropRect.w),
      Math.round(cropRect.h),
      0,
      0,
      Math.round(cropRect.w),
      Math.round(cropRect.h),
    );

    await applyCapturedImage(nextCanvas.toDataURL('image/png'), {
      keepOriginal: true,
      notice: t('capture.cropped'),
    });
  };

  const resetCapture = async () => {
    if (!originalCapture) return;
    await applyCapturedImage(originalCapture, { keepOriginal: true });
  };

  const handlePreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!captured || tool === 'none') return;
    const point = getImagePoint(event);
    if (!point) return;

    if (tool === 'text') {
      setAnnotations((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'text',
          color,
          size: Math.max(4, brushSize),
          opacity: 1,
          x: point.x,
          y: point.y,
          text: textDraft.trim() || t('capture.textDefault'),
        },
      ]);
      return;
    }

    setDragging(true);

    if (tool === 'crop') {
      setCropRect({ x: point.x, y: point.y, w: 0, h: 0 });
      return;
    }

    if (tool === 'draw' || tool === 'highlight') {
      setDraftAnnotation({
        id: crypto.randomUUID(),
        kind: tool,
        color,
        size: tool === 'highlight' ? Math.max(brushSize * 2, 12) : brushSize,
        opacity: tool === 'highlight' ? 0.35 : 1,
        points: [point],
      });
      return;
    }

    if (tool === 'rect') {
      setDraftAnnotation({
        id: crypto.randomUUID(),
        kind: 'rect',
        color,
        size: brushSize,
        opacity: 1,
        x: point.x,
        y: point.y,
        w: 0,
        h: 0,
      });
      return;
    }

    if (tool === 'arrow') {
      setDraftAnnotation({
        id: crypto.randomUUID(),
        kind: 'arrow',
        color,
        size: brushSize,
        opacity: 1,
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
      });
      return;
    }

    if (tool === 'mosaic') {
      setDraftAnnotation({
        id: crypto.randomUUID(),
        kind: 'mosaic',
        size: 1,
        opacity: 1,
        x: point.x,
        y: point.y,
        w: 0,
        h: 0,
        block: Math.max(6, Math.round(brushSize * 1.2)),
      });
    }
  };

  const handlePreviewMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const point = getImagePoint(event);
    if (!point) return;

    if (tool === 'crop') {
      setCropRect((prev) => {
        if (!prev) return prev;
        const x = Math.min(prev.x, point.x);
        const y = Math.min(prev.y, point.y);
        const w = Math.abs(point.x - prev.x);
        const h = Math.abs(point.y - prev.y);
        return { x, y, w, h };
      });
      return;
    }

    if (!draftAnnotation) return;

    if (draftAnnotation.kind === 'rect' || draftAnnotation.kind === 'mosaic') {
      setDraftAnnotation({
        ...draftAnnotation,
        x: Math.min(draftAnnotation.x, point.x),
        y: Math.min(draftAnnotation.y, point.y),
        w: Math.abs(point.x - draftAnnotation.x),
        h: Math.abs(point.y - draftAnnotation.y),
      });
      return;
    }

    if (draftAnnotation.kind === 'arrow') {
      setDraftAnnotation({
        ...draftAnnotation,
        x2: point.x,
        y2: point.y,
      });
      return;
    }

    if (draftAnnotation.kind === 'draw' || draftAnnotation.kind === 'highlight') {
      setDraftAnnotation({
        ...draftAnnotation,
        points: [...draftAnnotation.points, point],
      });
    }
  };

  const commitDraftAnnotation = () => {
    if (!draftAnnotation) return;

    if (draftAnnotation.kind === 'rect' || draftAnnotation.kind === 'mosaic') {
      if (draftAnnotation.w < 4 || draftAnnotation.h < 4) {
        setDraftAnnotation(null);
        return;
      }
    } else if (draftAnnotation.kind === 'arrow') {
      if (Math.abs(draftAnnotation.x2 - draftAnnotation.x1) < 4 && Math.abs(draftAnnotation.y2 - draftAnnotation.y1) < 4) {
        setDraftAnnotation(null);
        return;
      }
    } else if (draftAnnotation.kind === 'draw' || draftAnnotation.kind === 'highlight') {
      if (draftAnnotation.points.length === 0) {
        setDraftAnnotation(null);
        return;
      }
    }

    setAnnotations((prev) => [...prev, draftAnnotation]);
    setDraftAnnotation(null);
  };

  const handlePreviewMouseUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (tool !== 'crop') {
      commitDraftAnnotation();
    }
  };

  const undoAnnotation = () => {
    setAnnotations((prev) => prev.slice(0, -1));
    setDraftAnnotation(null);
  };

  const clearAnnotations = () => {
    setAnnotations([]);
    setDraftAnnotation(null);
  };

  const downloadImage = async (format: 'png' | 'jpeg' | 'webp') => {
    const canvas = await buildMergedCanvas();
    if (!canvas) return;

    setWorkflowStep('export');

    if (format === 'jpeg') {
      const jpgCanvas = document.createElement('canvas');
      jpgCanvas.width = canvas.width;
      jpgCanvas.height = canvas.height;
      const ctx = jpgCanvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
      ctx.drawImage(canvas, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => jpgCanvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `capture-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const mime = format === 'png' ? 'image/png' : 'image/webp';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.95));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capture-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    const canvas = await buildMergedCanvas();
    if (!canvas) return;

    setWorkflowStep('export');

    const dataUrl = canvas.toDataURL('image/png');
    const orientation = canvas.width > canvas.height ? 'l' : 'p';
    const pdf = new jsPDF({ orientation, unit: 'pt', format: [canvas.width, canvas.height] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`capture-${Date.now()}.pdf`);
  };

  const renderAnnotation = (annotation: Annotation) => {
    if (annotation.kind === 'rect') {
      return (
        <rect
          key={annotation.id}
          x={annotation.x}
          y={annotation.y}
          width={annotation.w}
          height={annotation.h}
          fill="none"
          stroke={annotation.color}
          strokeWidth={annotation.size}
          opacity={annotation.opacity}
          rx={8}
        />
      );
    }

    if (annotation.kind === 'mosaic') {
      return (
        <g key={annotation.id} opacity={0.55}>
          <rect x={annotation.x} y={annotation.y} width={annotation.w} height={annotation.h} fill="rgba(15,23,42,0.32)" stroke="rgba(15,23,42,0.55)" strokeDasharray="4 3" />
          <text x={annotation.x + 6} y={annotation.y + 16} fill="#e2e8f0" fontSize="12">{t('capture.mosaicLabel')}</text>
        </g>
      );
    }

    if (annotation.kind === 'arrow') {
      const [tip, left, right] = arrowHeadPoints(annotation.x1, annotation.y1, annotation.x2, annotation.y2, annotation.size);
      return (
        <g key={annotation.id} opacity={annotation.opacity}>
          <line x1={annotation.x1} y1={annotation.y1} x2={annotation.x2} y2={annotation.y2} stroke={annotation.color} strokeWidth={annotation.size} strokeLinecap="round" />
          <polygon points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`} fill={annotation.color} />
        </g>
      );
    }

    if (annotation.kind === 'text') {
      return (
        <text
          key={annotation.id}
          x={annotation.x}
          y={annotation.y}
          fill={annotation.color}
          fontSize={Math.max(14, annotation.size * 4)}
          opacity={annotation.opacity}
          dominantBaseline="text-before-edge"
        >
          {annotation.text}
        </text>
      );
    }

    return (
      <path
        key={annotation.id}
        d={pointsToSvgPath(annotation.points)}
        fill="none"
        stroke={annotation.color}
        strokeWidth={annotation.size}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={annotation.opacity}
      />
    );
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <Monitor className="w-4 h-4" /> {t('capture.title')}
      </h3>

      <div className="mb-3 rounded-xl border border-border bg-background/60 p-3">
        <p className="text-xs text-muted-foreground mb-2">{t('capture.workflowTitle')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {WORKFLOW_STEPS.map((step, index) => {
            const active = step === workflowStep;
            const done = WORKFLOW_STEPS.indexOf(workflowStep) > index;
            return (
              <div
                key={step}
                className={`rounded-lg px-2 py-2 text-xs border ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : done
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'border-border text-muted-foreground'
                }`}
              >
                {index + 1}. {t(`capture.step.${step}` as any)}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2">{t('capture.desc')}</p>
      <p className="text-[11px] text-muted-foreground mb-3 leading-5">{t('capture.limitHint')}</p>

      <div className="mb-3">
        <label className="text-xs text-muted-foreground block mb-1">{t('capture.sourceLabel')}</label>
        <select
          value={sourceMode}
          onChange={(event) => setSourceMode(event.target.value as SourceMode)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          disabled={!!stream}
        >
          <option value="screen">{t('capture.sourceScreen')}</option>
          <option value="window">{t('capture.sourceWindow')}</option>
          <option value="browser">{t('capture.sourceTab')}</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {!stream ? (
          <Button size="sm" onClick={startShare} className="gap-1">
            <Monitor className="w-4 h-4" /> {t('capture.start')}
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => void captureVisibleArea()} className="gap-1">
              <Camera className="w-4 h-4" /> {t('capture.captureVisible')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void captureRegion()} className="gap-1">
              <Crop className="w-4 h-4" /> {t('capture.captureRegion')}
            </Button>
            <Button size="sm" variant="outline" onClick={stopShare} className="gap-1">
              <StopCircle className="w-4 h-4" /> {t('capture.stop')}
            </Button>
          </>
        )}
        <Button size="sm" variant="secondary" onClick={() => void captureCurrentPageLong()} className="gap-1">
          <Square className="w-4 h-4" /> {t('capture.captureLongPage')}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-background/50 p-2 mb-3">
        <video ref={videoRef} autoPlay muted playsInline className="w-full max-h-[min(55vh,28rem)] object-contain rounded-lg" />
      </div>

      {captured && (
        <>
          <div className="rounded-xl border border-border bg-background/70 p-3 mb-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-foreground">{t('capture.editorLabel')}</span>
              <Button size="sm" variant={tool === 'none' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('none')}>
                {t('capture.toolNone')}
              </Button>
              <Button size="sm" variant={tool === 'crop' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('crop')}>
                <Crop className="w-3.5 h-3.5" /> {t('capture.toolCrop')}
              </Button>
              <Button size="sm" variant={tool === 'draw' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('draw')}>
                <Brush className="w-3.5 h-3.5" /> {t('capture.toolDraw')}
              </Button>
              <Button size="sm" variant={tool === 'highlight' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('highlight')}>
                <Highlighter className="w-3.5 h-3.5" /> {t('capture.toolHighlight')}
              </Button>
              <Button size="sm" variant={tool === 'rect' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('rect')}>
                <Square className="w-3.5 h-3.5" /> {t('capture.toolRect')}
              </Button>
              <Button size="sm" variant={tool === 'arrow' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('arrow')}>
                <ArrowUpRight className="w-3.5 h-3.5" /> {t('capture.toolArrow')}
              </Button>
              <Button size="sm" variant={tool === 'text' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('text')}>
                <Type className="w-3.5 h-3.5" /> {t('capture.toolText')}
              </Button>
              <Button size="sm" variant={tool === 'mosaic' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('mosaic')}>
                <Square className="w-3.5 h-3.5" /> {t('capture.toolMosaic')}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {t('capture.color')}
                <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-8 w-8 rounded border border-border bg-transparent p-0" />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {t('capture.brushSize')}
                <input type="range" min={2} max={24} step={1} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
                <span className="text-foreground">{brushSize}px</span>
              </label>
              {tool === 'text' && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {t('capture.textLabel')}
                  <input
                    value={textDraft}
                    onChange={(event) => setTextDraft(event.target.value)}
                    placeholder={t('capture.textPlaceholder')}
                    className="h-8 min-w-[180px] rounded-md border border-input bg-background px-2 text-xs text-foreground"
                  />
                </label>
              )}
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={undoAnnotation} disabled={annotations.length === 0}>
                <Undo2 className="w-3.5 h-3.5" /> {t('capture.toolUndo')}
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={clearAnnotations} disabled={annotations.length === 0 && !draftAnnotation}>
                <RefreshCcw className="w-3.5 h-3.5" /> {t('capture.toolClear')}
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void applyCrop()} disabled={tool !== 'crop'}>
                <Crop className="w-3.5 h-3.5" /> {t('capture.applyCrop')}
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void resetCapture()}>
                <RefreshCcw className="w-3.5 h-3.5" /> {t('capture.resetCrop')}
              </Button>
            </div>
          </div>

          <div
            ref={previewRef}
            className="rounded-xl border border-border bg-background/50 p-2 mb-3 relative select-none"
            onMouseDown={handlePreviewMouseDown}
            onMouseMove={handlePreviewMouseMove}
            onMouseUp={handlePreviewMouseUp}
            onMouseLeave={handlePreviewMouseUp}
          >
            <img
              ref={imageRef}
              src={captured}
              alt={t('capture.previewAlt')}
              className="w-full max-h-[min(60vh,32rem)] object-contain rounded-lg"
              draggable={false}
              onLoad={() => updateImageBox()}
            />

            {imageBox && (
              <svg
                className="absolute pointer-events-none"
                style={{
                  left: `${imageBox.left}px`,
                  top: `${imageBox.top}px`,
                  width: `${imageBox.width}px`,
                  height: `${imageBox.height}px`,
                }}
                viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
              >
                {annotations.map(renderAnnotation)}
                {draftAnnotation ? renderAnnotation(draftAnnotation) : null}
                {cropRect && tool === 'crop' ? (
                  <rect
                    x={cropRect.x}
                    y={cropRect.y}
                    width={cropRect.w}
                    height={cropRect.h}
                    fill="rgba(59, 130, 246, 0.18)"
                    stroke="rgb(59, 130, 246)"
                    strokeWidth={Math.max(2, brushSize / 2)}
                    rx={8}
                  />
                ) : null}
              </svg>
            )}
          </div>

          <div className="text-xs text-muted-foreground mb-3 leading-5">
            {tool === 'crop' ? t('capture.cropHint') : t('capture.annotateHint')}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => void downloadImage('png')}>
              <Download className="w-3.5 h-3.5" /> {t('capture.formatPng')}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => void downloadImage('jpeg')}>
              <Download className="w-3.5 h-3.5" /> {t('capture.formatJpg')}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => void downloadImage('webp')}>
              <Download className="w-3.5 h-3.5" /> {t('capture.formatWebp')}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => void downloadPdf()}>
              <Square className="w-3.5 h-3.5" /> {t('capture.formatPdf')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}