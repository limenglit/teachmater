import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ArrowUpRight,
  Brush,
  Camera,
  Clipboard,
  Crop,
  Download,
  Highlighter,
  Monitor,
  RefreshCcw,
  Square,
  StopCircle,
  Pause,
  Play,
  Type,
  Undo2,
  Video,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

type EditorTool = 'none' | 'crop' | 'draw' | 'highlight' | 'rect' | 'arrow' | 'text' | 'mosaic';
type WorkspaceMode = 'capture' | 'record';
type RecordAudioSource = 'none' | 'system' | 'mic' | 'both';
type RegionHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';
type CameraSourceMode = 'auto' | 'usb';
type CameraHandle = 'move' | 'resize';

interface CaptureBrowserInfo {
  isSafari: boolean;
  isEdge: boolean;
}

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

interface LiveRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CameraOverlay {
  x: number;
  y: number;
  size: number;
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

const DPI_OPTIONS = [360, 600, 900, 1200, 1500, 1800] as const;
const MIN_REGION_SIZE = 0.08;
const MIN_CAMERA_SIZE = 0.04;
const MAX_CAMERA_SIZE = 1;
const MIN_CAMERA_CM = 2;
const CSS_PX_PER_CM = 37.8;

function getPreferredRecorderMimeType(preferMp4: boolean) {
  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];
  const webmCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const candidates = preferMp4
    ? [...mp4Candidates, ...webmCandidates]
    : [...webmCandidates, ...mp4Candidates];

  for (const mimeType of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return undefined;
}

function getFileExtensionForMimeType(mimeType: string) {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  return 'webm';
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  if (hh > 0) {
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function detectCaptureBrowser(): CaptureBrowserInfo {
  if (typeof navigator === 'undefined') {
    return { isSafari: false, isEdge: false };
  }

  const ua = navigator.userAgent;
  const isEdge = /Edg\//.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

  return { isSafari, isEdge };
}

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
      ctx.fill();
    } else if (annotation.kind === 'text') {
      ctx.fillStyle = annotation.color;
      ctx.font = `${Math.max(14, annotation.size * 4)}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(annotation.text, annotation.x, annotation.y);
    } else if (annotation.kind === 'mosaic') {
      drawMosaicOnCanvas(ctx, annotation);
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

export default function ScreenCaptureTool() {
  const { t } = useLanguage();
  const browserInfo = useMemo(() => detectCaptureBrowser(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const liveVideoWrapRef = useRef<HTMLDivElement>(null);
  const cameraSourceVideoRef = useRef<HTMLVideoElement>(null);
  const cameraPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraFrameCacheRef = useRef<HTMLCanvasElement | null>(null);
  const cameraCacheTimerRef = useRef<number | null>(null);
  const recordSourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordMicStreamRef = useRef<MediaStream | null>(null);
  const recordAudioContextRef = useRef<AudioContext | null>(null);
  const recordRafRef = useRef<number | null>(null);
  const recordFrameTimerRef = useRef<number | null>(null);
  const recordVideoFrameCallbackRef = useRef<number | null>(null);
  const recordStatsTimerRef = useRef<number | null>(null);
  const recordingActiveRef = useRef(false);
  const regionDragRef = useRef<{ handle: RegionHandle; startX: number; startY: number; startRegion: LiveRegion } | null>(null);
  const cameraDragRef = useRef<{ handle: CameraHandle; startX: number; startY: number; startOverlay: CameraOverlay } | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
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
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('capture');
  const [selectedDpi, setSelectedDpi] = useState<number>(360);
  const [recordAudioSource, setRecordAudioSource] = useState<RecordAudioSource>('none');
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordCountdown, setRecordCountdown] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingBytes, setRecordingBytes] = useState(0);
  const [recordOutputMimeType, setRecordOutputMimeType] = useState('video/webm');
  const [liveRegion, setLiveRegion] = useState<LiveRegion>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [systemAudioTrackAvailable, setSystemAudioTrackAvailable] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraSourceMode, setCameraSourceMode] = useState<CameraSourceMode>('auto');
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState('');
  const [cameraOverlay, setCameraOverlay] = useState<CameraOverlay>({ x: 0.76, y: 0.72, size: 0.2 });

  const estimatedRecordingBytes = useMemo(() => {
    if (recordingBytes > 0 && recordingSeconds > 0) {
      const avgBytesPerSecond = recordingBytes / recordingSeconds;
      return Math.round(avgBytesPerSecond * Math.max(1, recordingSeconds));
    }
    const conservativeFallback = 450 * 1024;
    return conservativeFallback * Math.max(1, recordingSeconds);
  }, [recordingBytes, recordingSeconds]);

  const recordOutputLabel = useMemo(() => (recordOutputMimeType.includes('mp4') ? 'MP4' : 'WebM'), [recordOutputMimeType]);

  const clampRegion = useCallback((region: LiveRegion): LiveRegion => {
    const w = clamp(region.w, MIN_REGION_SIZE, 1);
    const h = clamp(region.h, MIN_REGION_SIZE, 1);
    const x = clamp(region.x, 0, 1 - w);
    const y = clamp(region.y, 0, 1 - h);
    return { x, y, w, h };
  }, []);

  const clampCameraOverlay = useCallback((overlay: CameraOverlay): CameraOverlay => {
    const wrapWidth = liveVideoWrapRef.current?.getBoundingClientRect().width ?? 0;
    const minSizeByCm = wrapWidth > 0 ? (MIN_CAMERA_CM * CSS_PX_PER_CM) / wrapWidth : MIN_CAMERA_SIZE;
    const minSize = clamp(Math.max(MIN_CAMERA_SIZE, minSizeByCm), MIN_CAMERA_SIZE, 0.9);
    const size = clamp(overlay.size, minSize, MAX_CAMERA_SIZE);
    const x = clamp(overlay.x, 0, 1 - size);
    const y = clamp(overlay.y, 0, 1 - size);
    return { x, y, size };
  }, []);

  const stopCameraStream = useCallback(() => {
    if (cameraCacheTimerRef.current !== null) {
      window.clearInterval(cameraCacheTimerRef.current);
      cameraCacheTimerRef.current = null;
    }
    cameraFrameCacheRef.current = null;
    setCameraStream((prev) => {
      if (prev) {
        prev.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
  }, []);

  const refreshCameraDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');
      setCameraDevices(videoInputs);
      if (!selectedCameraDeviceId && videoInputs.length > 0) {
        setSelectedCameraDeviceId(videoInputs[0].deviceId);
      }
    } catch {
      setCameraDevices([]);
    }
  }, [selectedCameraDeviceId]);

  const startCameraStream = useCallback(async () => {
    if (!cameraEnabled) return;

    try {
      const usbCamera = cameraDevices.find((device) => /usb/i.test(device.label));
      const preferredDeviceId = cameraSourceMode === 'usb'
        ? (selectedCameraDeviceId || usbCamera?.deviceId || cameraDevices[0]?.deviceId)
        : (selectedCameraDeviceId || cameraDevices[0]?.deviceId);

      const constraints: MediaStreamConstraints = {
        audio: false,
      video: preferredDeviceId
          ? {
              deviceId: { exact: preferredDeviceId },
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 },
              frameRate: { ideal: 30, max: 30 },
            }
          : {
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 },
              frameRate: { ideal: 30, max: 30 },
            },
      };

      const nextStream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream((prev) => {
        if (prev) prev.getTracks().forEach((track) => track.stop());
        return nextStream;
      });
      await refreshCameraDevices();
    } catch {
      toast({ title: t('capture.cameraPermissionDenied'), variant: 'destructive' });
      setCameraEnabled(false);
      stopCameraStream();
    }
  }, [cameraDevices, cameraEnabled, cameraSourceMode, refreshCameraDevices, selectedCameraDeviceId, stopCameraStream, t]);

  const beginCameraAdjust = useCallback((event: React.MouseEvent<HTMLDivElement>, handle: CameraHandle) => {
    event.preventDefault();
    event.stopPropagation();
    cameraDragRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startOverlay: cameraOverlay,
    };
  }, [cameraOverlay]);

  const beginRegionAdjust = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, handle: RegionHandle) => {
      if (isRecording) return;
      event.preventDefault();
      event.stopPropagation();
      regionDragRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startRegion: liveRegion,
      };
    },
    [isRecording, liveRegion],
  );

  const moveRegionAdjust = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const cameraDrag = cameraDragRef.current;
      const wrap = liveVideoWrapRef.current;
      if (cameraDrag && wrap) {
        const rect = wrap.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const dx = (event.clientX - cameraDrag.startX) / rect.width;
          const dy = (event.clientY - cameraDrag.startY) / rect.height;

          let next = { ...cameraDrag.startOverlay };
          if (cameraDrag.handle === 'move') {
            next.x = cameraDrag.startOverlay.x + dx;
            next.y = cameraDrag.startOverlay.y + dy;
          } else {
            const delta = Math.max(dx, dy);
            next.size = cameraDrag.startOverlay.size + delta;
          }

          setCameraOverlay(clampCameraOverlay(next));
        }
        return;
      }

      const drag = regionDragRef.current;
      if (!drag || !wrap) return;

      const rect = wrap.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dx = (event.clientX - drag.startX) / rect.width;
      const dy = (event.clientY - drag.startY) / rect.height;

      let next = { ...drag.startRegion };
      if (drag.handle === 'move') {
        next.x = drag.startRegion.x + dx;
        next.y = drag.startRegion.y + dy;
      }

      if (drag.handle === 'nw') {
        next.x = drag.startRegion.x + dx;
        next.y = drag.startRegion.y + dy;
        next.w = drag.startRegion.w - dx;
        next.h = drag.startRegion.h - dy;
      }

      if (drag.handle === 'ne') {
        next.y = drag.startRegion.y + dy;
        next.w = drag.startRegion.w + dx;
        next.h = drag.startRegion.h - dy;
      }

      if (drag.handle === 'sw') {
        next.x = drag.startRegion.x + dx;
        next.w = drag.startRegion.w - dx;
        next.h = drag.startRegion.h + dy;
      }

      if (drag.handle === 'se') {
        next.w = drag.startRegion.w + dx;
        next.h = drag.startRegion.h + dy;
      }

      setLiveRegion(clampRegion(next));
    },
    [clampCameraOverlay, clampRegion],
  );

  const endRegionAdjust = useCallback(() => {
    regionDragRef.current = null;
    cameraDragRef.current = null;
  }, []);

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

    if (stream) {
      const ensurePlaying = () => {
        void video.play().catch(() => {
          // Some browsers require a delayed play attempt after metadata is ready.
        });
      };

      video.addEventListener('loadedmetadata', ensurePlaying);
      ensurePlaying();

      return () => {
        video.removeEventListener('loadedmetadata', ensurePlaying);
        video.srcObject = null;
      };
    }

    return () => {
      video.srcObject = null;
    };
  }, [captured, isRecording, stream, workspaceMode, workspaceOpen]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (!isRecording) return;

    if (recordStatsTimerRef.current !== null) {
      window.clearInterval(recordStatsTimerRef.current);
      recordStatsTimerRef.current = null;
    }

    recordStatsTimerRef.current = window.setInterval(() => {
      if (!isRecordingPaused) {
        setRecordingSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => {
      if (recordStatsTimerRef.current !== null) {
        window.clearInterval(recordStatsTimerRef.current);
        recordStatsTimerRef.current = null;
      }
    };
  }, [isRecording, isRecordingPaused]);

  useEffect(() => {
    const sourceVideo = cameraSourceVideoRef.current;

    if (sourceVideo) {
      sourceVideo.srcObject = cameraStream;
      const ensurePlaying = () => {
        void sourceVideo.play().catch(() => undefined);
      };
      sourceVideo.addEventListener('loadedmetadata', ensurePlaying);
      if (cameraStream) {
        ensurePlaying();
      }

      return () => {
        sourceVideo.removeEventListener('loadedmetadata', ensurePlaying);
        sourceVideo.srcObject = null;
      };
    }

    return undefined;
  }, [cameraStream]);

  useEffect(() => {
    if (cameraCacheTimerRef.current !== null) {
      window.clearInterval(cameraCacheTimerRef.current);
      cameraCacheTimerRef.current = null;
    }

    if (!cameraEnabled || !cameraStream || workspaceMode !== 'record' || !workspaceOpen) {
      return;
    }

    let rafId: number | null = null;
    const renderLoop = () => {
      const sourceVideo = cameraSourceVideoRef.current;
      const previewCanvas = cameraPreviewCanvasRef.current;

      if (sourceVideo && sourceVideo.readyState >= 2 && sourceVideo.videoWidth > 0 && sourceVideo.videoHeight > 0) {
        // Update cache for recording fallback
        if (!cameraFrameCacheRef.current) {
          cameraFrameCacheRef.current = document.createElement('canvas');
        }
        const nextCache = cameraFrameCacheRef.current;
        if (nextCache.width !== sourceVideo.videoWidth || nextCache.height !== sourceVideo.videoHeight) {
          nextCache.width = sourceVideo.videoWidth;
          nextCache.height = sourceVideo.videoHeight;
        }
        const cacheCtx = nextCache.getContext('2d');
        if (cacheCtx) {
          cacheCtx.drawImage(sourceVideo, 0, 0, nextCache.width, nextCache.height);
        }

        // Draw directly from video to preview (no intermediate delay)
        if (previewCanvas) {
          if (previewCanvas.width !== sourceVideo.videoWidth || previewCanvas.height !== sourceVideo.videoHeight) {
            previewCanvas.width = sourceVideo.videoWidth;
            previewCanvas.height = sourceVideo.videoHeight;
          }
          const previewCtx = previewCanvas.getContext('2d');
          if (previewCtx) {
            previewCtx.drawImage(sourceVideo, 0, 0, previewCanvas.width, previewCanvas.height);
          }
        }
      } else {
        // Fallback: draw from cache
        const cache = cameraFrameCacheRef.current;
        if (previewCanvas && cache && cache.width > 0 && cache.height > 0) {
          if (previewCanvas.width !== cache.width || previewCanvas.height !== cache.height) {
            previewCanvas.width = cache.width;
            previewCanvas.height = cache.height;
          }
          const previewCtx = previewCanvas.getContext('2d');
          if (previewCtx) {
            previewCtx.drawImage(cache, 0, 0, previewCanvas.width, previewCanvas.height);
          }
        }
      }

      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [cameraEnabled, cameraStream, workspaceMode, workspaceOpen]);

  useEffect(() => {
    if (!workspaceOpen || workspaceMode !== 'record') return;
    void refreshCameraDevices();
  }, [refreshCameraDevices, workspaceMode, workspaceOpen]);

  useEffect(() => {
    if (!workspaceOpen || workspaceMode !== 'record') {
      stopCameraStream();
      return;
    }

    if (!cameraEnabled) {
      stopCameraStream();
      return;
    }

    void startCameraStream();
  }, [cameraEnabled, cameraSourceMode, selectedCameraDeviceId, startCameraStream, stopCameraStream, workspaceMode, workspaceOpen]);

  useEffect(() => {
    if (!captured) return;
    updateImageBox();
    const handleResize = () => updateImageBox();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [captured, updateImageBox]);

  useEffect(() => {
    if (!workspaceOpen) return;
    setLiveRegion({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    endRegionAdjust();
  }, [endRegionAdjust, workspaceMode, workspaceOpen]);

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

    const dpiScale = Math.max(1, selectedDpi / 360);

    // Keep capture in sync with what user sees in preview by preferring the video frame.
    const video = videoRef.current;
    if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      if (video.paused) {
        await video.play().catch(() => undefined);
      }

      // Wait until the browser presents a fresh frame to avoid stale captures for shared tabs.
      if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
        await new Promise<void>((resolve) => {
          (video as HTMLVideoElement & {
            requestVideoFrameCallback: (callback: () => void) => number;
          }).requestVideoFrameCallback(() => resolve());
        });
      } else {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * dpiScale);
      canvas.height = Math.round(video.videoHeight * dpiScale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('no-context');
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    }

    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error('no-track');
    }

    // Some browsers momentarily report 0-size video; wait briefly before fallback capture.
    await new Promise((resolve) => setTimeout(resolve, 80));

    const retryVideo = videoRef.current;
    if (retryVideo && retryVideo.readyState >= 2 && retryVideo.videoWidth > 0 && retryVideo.videoHeight > 0) {
      if (retryVideo.paused) {
        await retryVideo.play().catch(() => undefined);
      }
      const retryCanvas = document.createElement('canvas');
      retryCanvas.width = Math.round(retryVideo.videoWidth * dpiScale);
      retryCanvas.height = Math.round(retryVideo.videoHeight * dpiScale);
      const retryCtx = retryCanvas.getContext('2d');
      if (!retryCtx) throw new Error('no-context');
      retryCtx.drawImage(retryVideo, 0, 0, retryCanvas.width, retryCanvas.height);
      return retryCanvas.toDataURL('image/png');
    }

    const canvas = document.createElement('canvas');

    if ('ImageCapture' in window) {
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      canvas.width = Math.round(bitmap.width * dpiScale);
      canvas.height = Math.round(bitmap.height * dpiScale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no-context');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    } else {
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('no-frame');
      }
      canvas.width = Math.round(video.videoWidth * dpiScale);
      canvas.height = Math.round(video.videoHeight * dpiScale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no-context');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    return canvas.toDataURL('image/png');
  }, [selectedDpi, stream]);

  const cleanupRecordingResources = useCallback(() => {
    setRecordCountdown(null);
    recordingActiveRef.current = false;
    if (recordStatsTimerRef.current !== null) {
      window.clearInterval(recordStatsTimerRef.current);
      recordStatsTimerRef.current = null;
    }
    if (recordRafRef.current !== null) {
      cancelAnimationFrame(recordRafRef.current);
      recordRafRef.current = null;
    }
    if (recordFrameTimerRef.current !== null) {
      window.clearTimeout(recordFrameTimerRef.current);
      recordFrameTimerRef.current = null;
    }
    if (recordVideoFrameCallbackRef.current !== null && recordSourceVideoRef.current && 'cancelVideoFrameCallback' in HTMLVideoElement.prototype) {
      (recordSourceVideoRef.current as HTMLVideoElement & { cancelVideoFrameCallback: (id: number) => void }).cancelVideoFrameCallback(recordVideoFrameCallbackRef.current);
      recordVideoFrameCallbackRef.current = null;
    }
    if (recordSourceVideoRef.current) {
      recordSourceVideoRef.current.srcObject = null;
      recordSourceVideoRef.current = null;
    }
    if (cameraCacheTimerRef.current !== null) {
      window.clearInterval(cameraCacheTimerRef.current);
      cameraCacheTimerRef.current = null;
    }
    cameraFrameCacheRef.current = null;
    if (recorderRef.current) {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current = null;
    }

    if (recordMicStreamRef.current) {
      recordMicStreamRef.current.getTracks().forEach((track) => track.stop());
      recordMicStreamRef.current = null;
    }

    if (recordAudioContextRef.current) {
      void recordAudioContextRef.current.close();
      recordAudioContextRef.current = null;
    }

    recordingChunksRef.current = [];
    setRecordingBytes(0);
    setRecordingSeconds(0);
    setIsRecordingPaused(false);
    setRecordOutputMimeType('video/webm');
    setSystemAudioTrackAvailable(false);
    setIsRecording(false);
  }, []);

  const startShare = async () => {
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: false,
      });
      setStream(media);
      const [track] = media.getVideoTracks();
      track.onended = () => setStream(null);
    } catch {
      toast({ title: t('capture.permissionDenied'), variant: 'destructive' });
    }
  };

  const stopShare = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setSystemAudioTrackAvailable(false);
    cleanupRecordingResources();
  };

  const captureSelectedRegionToEditor = async () => {
    const preview = videoRef.current;
    if (!preview || preview.videoWidth === 0 || preview.videoHeight === 0) {
      throw new Error('preview-size-empty');
    }

    const dpiScale = Math.max(1, selectedDpi / 360);
    const sx = Math.round(liveRegion.x * preview.videoWidth);
    const sy = Math.round(liveRegion.y * preview.videoHeight);
    const sw = Math.max(2, Math.round(liveRegion.w * preview.videoWidth));
    const sh = Math.max(2, Math.round(liveRegion.h * preview.videoHeight));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw * dpiScale);
    canvas.height = Math.round(sh * dpiScale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-context');

    ctx.drawImage(preview, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    await applyCapturedImage(canvas.toDataURL('image/png'), { notice: t('capture.captured') });
  };

  const startRecordPreview = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      // Determine if we should request system audio via getDisplayMedia
      let requestDisplayAudio = false;
      let effectiveSource = recordAudioSource;

      if (effectiveSource === 'system' || effectiveSource === 'both') {
        if (browserInfo.isSafari) {
          // Safari does not support system audio capture at all
          effectiveSource = effectiveSource === 'both' ? 'mic' : 'none';
          setRecordAudioSource(effectiveSource);
          toast({ title: t('capture.safariNoSystemAudio') });
        } else if (browserInfo.isEdge) {
          // Edge freezes shared video when system audio is requested via getDisplayMedia
          // Workaround: don't pass audio:true to getDisplayMedia, use mic instead
          effectiveSource = effectiveSource === 'both' ? 'mic' : 'none';
          setRecordAudioSource(effectiveSource);
          toast({ title: t('capture.systemAudioEdgeFallback') });
        } else {
          requestDisplayAudio = true;
        }
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: requestDisplayAudio,
      });

      const hasSystemAudioTrack = displayStream.getAudioTracks().length > 0;
      setSystemAudioTrackAvailable(hasSystemAudioTrack);
      if (requestDisplayAudio && !hasSystemAudioTrack) {
        toast({ title: t('capture.systemAudioNotCaptured') });
      }

      setStream(displayStream);
      const [displayTrack] = displayStream.getVideoTracks();
      displayTrack.onended = () => {
        cleanupRecordingResources();
        setStream(null);
      };

      // Acquire microphone if needed
      const needsMic = effectiveSource === 'mic' || effectiveSource === 'both';
      if (needsMic && !recordMicStreamRef.current) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          recordMicStreamRef.current = micStream;
        } catch {
          toast({ title: t('capture.micPermissionDenied'), variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: t('capture.permissionDenied'), variant: 'destructive' });
    }
  };

  const startRecording = async () => {
    try {
      if (!stream) {
        toast({ title: t('capture.start'), variant: 'destructive' });
        return;
      }

      const displayStream = stream;

      const previewVideo = videoRef.current;
      if (previewVideo) {
        previewVideo.srcObject = displayStream;
        void previewVideo.play().catch(() => undefined);
      }

      const refreshPreview = () => {
        const activeVideo = videoRef.current;
        if (!activeVideo) return;
        activeVideo.srcObject = displayStream;
        void activeVideo.play().catch(() => undefined);
      };

      const [displayTrack] = displayStream.getVideoTracks();
      displayTrack.onunmute = refreshPreview;

      const mergedStream = new MediaStream();
      const videoTrack = displayStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('no-video-track');
      }
      mergedStream.addTrack(videoTrack);

      const audioTracks: MediaStreamTrack[] = [];
      if (recordAudioSource === 'system' || recordAudioSource === 'both') {
        audioTracks.push(...displayStream.getAudioTracks());
      }

      if (recordAudioSource === 'mic' || recordAudioSource === 'both') {
        let micStream = recordMicStreamRef.current;
        if (!micStream) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            recordMicStreamRef.current = micStream;
          } catch {
            micStream = null;
            toast({ title: t('capture.permissionDenied'), variant: 'destructive' });
          }
        }

        if (micStream) {
          audioTracks.push(...micStream.getAudioTracks());
        }
      }

      if ((recordAudioSource === 'system' || recordAudioSource === 'both') && displayStream.getAudioTracks().length === 0) {
        toast({ title: t('capture.systemAudioNotCaptured') });
      }

      if (audioTracks.length === 1) {
        mergedStream.addTrack(audioTracks[0]);
      } else if (audioTracks.length > 1) {
        const audioContext = new AudioContext();
        recordAudioContextRef.current = audioContext;
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        const destination = audioContext.createMediaStreamDestination();

        for (const track of audioTracks) {
          const srcStream = new MediaStream([track]);
          const src = audioContext.createMediaStreamSource(srcStream);
          src.connect(destination);
        }

        const [mixedTrack] = destination.stream.getAudioTracks();
        if (mixedTrack) {
          mergedStream.addTrack(mixedTrack);
        }
      }

      const sourceVideo = document.createElement('video');
      sourceVideo.muted = true;
      sourceVideo.playsInline = true;
      sourceVideo.autoplay = true;
      sourceVideo.srcObject = displayStream;
      recordSourceVideoRef.current = sourceVideo;

      if (sourceVideo.videoWidth === 0 || sourceVideo.videoHeight === 0) {
        await new Promise<void>((resolve) => {
          const onLoaded = () => {
            sourceVideo.removeEventListener('loadedmetadata', onLoaded);
            resolve();
          };
          sourceVideo.addEventListener('loadedmetadata', onLoaded);
        });
      }
      await sourceVideo.play().catch(() => undefined);

      const sourceWidth = sourceVideo.videoWidth;
      const sourceHeight = sourceVideo.videoHeight;
      if (!sourceWidth || !sourceHeight) {
        throw new Error('preview-size-empty');
      }

      const cropX = Math.round(liveRegion.x * sourceWidth);
      const cropY = Math.round(liveRegion.y * sourceHeight);
      const cropW = Math.max(2, Math.round(liveRegion.w * sourceWidth));
      const cropH = Math.max(2, Math.round(liveRegion.h * sourceHeight));

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = cropW;
      outputCanvas.height = cropH;
      const outputCtx = outputCanvas.getContext('2d');
      if (!outputCtx) {
        throw new Error('output-context-missing');
      }

      const canvasStream = outputCanvas.captureStream(30);
      const canvasVideoTrack = canvasStream.getVideoTracks()[0];
      if (!canvasVideoTrack) {
        throw new Error('canvas-video-track-missing');
      }

      const finalStream = new MediaStream([canvasVideoTrack]);
      const mixedAudioTrack = mergedStream.getAudioTracks()[0];
      if (mixedAudioTrack) {
        finalStream.addTrack(mixedAudioTrack);
      }

      const preferredMimeType = getPreferredRecorderMimeType(!browserInfo.isSafari);
      const recorder = preferredMimeType
        ? new MediaRecorder(finalStream, { mimeType: preferredMimeType })
        : new MediaRecorder(finalStream);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      setRecordingBytes(0);
      setRecordingSeconds(0);
      setIsRecordingPaused(false);
      setRecordOutputMimeType(recorder.mimeType || preferredMimeType || 'video/webm');

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
          setRecordingBytes((prev) => prev + event.data.size);
        }
      };

      recorder.onstop = () => {
        const outputMimeType = recorder.mimeType || preferredMimeType || 'video/webm';
        const extension = getFileExtensionForMimeType(outputMimeType);
        const blob = new Blob(recordingChunksRef.current, { type: outputMimeType });
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `record-${Date.now()}.${extension}`;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: t('capture.recordSaved') });
        }
        displayStream.getTracks().forEach((track) => track.stop());
        sourceVideo.srcObject = null;
        recordSourceVideoRef.current = null;
        setStream(null);
        cleanupRecordingResources();
        setWorkspaceOpen(false);
        setWorkspaceMode('capture');
      };

      displayTrack.onended = () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        } else {
          cleanupRecordingResources();
          setStream(null);
          setWorkspaceOpen(false);
          setWorkspaceMode('capture');
        }
      };

      recordingActiveRef.current = true;
      const scheduleNextFrame = () => {
        if (!recordingActiveRef.current) return;
        if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
          recordVideoFrameCallbackRef.current = (sourceVideo as HTMLVideoElement & {
            requestVideoFrameCallback: (callback: () => void) => number;
          }).requestVideoFrameCallback(() => renderFrame());
        } else {
          recordFrameTimerRef.current = window.setTimeout(renderFrame, 33);
        }
      };

      const renderFrame = () => {
        if (!recordingActiveRef.current) return;
        if (recorderRef.current?.state === 'paused') {
          scheduleNextFrame();
          return;
        }
        outputCtx.drawImage(sourceVideo, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        const camVideo = cameraSourceVideoRef.current;
        if (cameraEnabled && camVideo) {
          const cameraXInSource = Math.round(cameraOverlay.x * sourceWidth);
          const cameraYInSource = Math.round(cameraOverlay.y * sourceHeight);
          const cameraSizeInSource = Math.max(2, Math.round(cameraOverlay.size * sourceWidth));

          const destX = cameraXInSource - cropX;
          const destY = cameraYInSource - cropY;
          const outerRadius = cameraSizeInSource / 2;
          const centerX = destX + outerRadius;
          const centerY = destY + outerRadius;

          outputCtx.save();
          outputCtx.beginPath();
          outputCtx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
          outputCtx.closePath();
          outputCtx.clip();

          if (camVideo.readyState >= 2 && camVideo.videoWidth > 0 && camVideo.videoHeight > 0) {
            outputCtx.drawImage(camVideo, destX, destY, cameraSizeInSource, cameraSizeInSource);
          } else if (cameraFrameCacheRef.current) {
            outputCtx.drawImage(cameraFrameCacheRef.current, destX, destY, cameraSizeInSource, cameraSizeInSource);
          }

          outputCtx.restore();
        }

        scheduleNextFrame();
      };
      renderFrame();

      recorder.start(1000);
      setIsRecording(true);
      toast({ title: t('capture.recordStarted') });
    } catch {
      cleanupRecordingResources();
      setStream(null);
      toast({ title: t('capture.recordFailed'), variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    recordingActiveRef.current = false;
    if (recordRafRef.current !== null) {
      cancelAnimationFrame(recordRafRef.current);
      recordRafRef.current = null;
    }
    if (recordFrameTimerRef.current !== null) {
      window.clearTimeout(recordFrameTimerRef.current);
      recordFrameTimerRef.current = null;
    }
    if (recordVideoFrameCallbackRef.current !== null && recordSourceVideoRef.current && 'cancelVideoFrameCallback' in HTMLVideoElement.prototype) {
      (recordSourceVideoRef.current as HTMLVideoElement & { cancelVideoFrameCallback: (id: number) => void }).cancelVideoFrameCallback(recordVideoFrameCallbackRef.current);
      recordVideoFrameCallbackRef.current = null;
    }
    if (!recorderRef.current) return;
    if (recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const toggleRecordingPause = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    if (recorder.state === 'recording') {
      recorder.pause();
      setIsRecordingPaused(true);
      return;
    }

    if (recorder.state === 'paused') {
      recorder.resume();
      setIsRecordingPaused(false);
    }
  };

  const startRecordingWithCountdown = () => {
    if (isRecording || recordCountdown !== null) return;
    if (!stream) {
      toast({ title: t('capture.start'), variant: 'destructive' });
      return;
    }

    setRecordCountdown(3);
    let count = 3;
    const timer = window.setInterval(() => {
      count -= 1;
      if (count <= 0) {
        window.clearInterval(timer);
        setRecordCountdown(null);
        void startRecording();
        return;
      }
      setRecordCountdown(count);
    }, 1000);
  };

  const closeWorkspace = () => {
    if (isRecording) {
      stopRecording();
    } else {
      stopShare();
    }
    stopCameraStream();
    setWorkspaceOpen(false);
  };

  const openWorkspace = (mode: WorkspaceMode) => {
    if (stream) {
      stopShare();
    }
    stopCameraStream();
    setCameraOverlay({ x: 0.76, y: 0.72, size: 0.2 });
    setCaptured('');
    setOriginalCapture('');
    setWorkspaceMode(mode);
    setWorkspaceOpen(true);
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
        scale: Math.min((window.devicePixelRatio || 1) * (selectedDpi / 360), 6),
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

    const dataUrl = canvas.toDataURL('image/png');
    const orientation = canvas.width > canvas.height ? 'l' : 'p';
    const pdf = new jsPDF({ orientation, unit: 'pt', format: [canvas.width, canvas.height] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`capture-${Date.now()}.pdf`);
  };

  const copyToClipboard = async () => {
    const canvas = await buildMergedCanvas();
    if (!canvas) return;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
    if (!blob) {
      toast({ title: t('capture.copyFailed'), variant: 'destructive' });
      return;
    }

    try {
      if (navigator.clipboard && 'write' in navigator.clipboard && 'ClipboardItem' in window) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        toast({ title: t('capture.copySuccess') });
        return;
      }

      throw new Error('clipboard-image-not-supported');
    } catch {
      toast({ title: t('capture.copyFailed'), variant: 'destructive' });
    }
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
    <>
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Monitor className="w-4 h-4" /> {t('capture.title')}
        </h3>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">{t('capture.resolutionLabel')}</label>
          <select
            value={selectedDpi}
            onChange={(event) => setSelectedDpi(Number(event.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {DPI_OPTIONS.map((dpi) => (
              <option key={dpi} value={dpi}>{dpi} DPI</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-1"
            onClick={() => openWorkspace('capture')}
          >
            <Camera className="w-4 h-4" /> {t('capture.actionScreenshot')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => openWorkspace('record')}
          >
            <Video className="w-4 h-4" /> {t('capture.actionRecord')}
          </Button>
        </div>
      </div>

      {workspaceOpen && (
        <div className="fixed inset-0 z-[120] bg-background flex flex-col">
          <div className="fixed left-0 right-0 top-0 z-[121] border-b border-border bg-card/95 backdrop-blur px-3 sm:px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground mr-2">{t('capture.title')}</span>

              {workspaceMode === 'capture' ? (
                <>
                  {!stream ? (
                    <Button size="sm" onClick={startShare} className="gap-1">
                      <Monitor className="w-4 h-4" /> {t('capture.start')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={stopShare} className="gap-1">
                      <StopCircle className="w-4 h-4" /> {t('capture.stop')}
                    </Button>
                  )}

                  <Button size="sm" variant="secondary" onClick={() => void captureCurrentPageLong()} className="gap-1">
                    <Square className="w-4 h-4" /> {t('capture.captureLongPage')}
                  </Button>
                </>
              ) : (
                <>
                  <label className="text-xs text-muted-foreground">{t('capture.recordAudioSource')}</label>
                  <select
                    value={recordAudioSource}
                    onChange={(event) => setRecordAudioSource(event.target.value as RecordAudioSource)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    disabled={isRecording}
                  >
                    <option value="none">{t('capture.audioNone')}</option>
                    <option value="mic">{t('capture.audioMic')}</option>
                    {!browserInfo.isSafari && !browserInfo.isEdge && (
                      <>
                        <option value="system">{t('capture.audioSystem')}</option>
                        <option value="both">{t('capture.audioBoth')}</option>
                      </>
                    )}
                  </select>

                  <label className="text-xs text-muted-foreground">{t('capture.cameraOverlay')}</label>
                  <label className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 h-8 text-xs">
                    <input
                      type="checkbox"
                      checked={cameraEnabled}
                      onChange={(event) => setCameraEnabled(event.target.checked)}
                      disabled={isRecording}
                    />
                    <span>{cameraEnabled ? t('capture.cameraOn') : t('capture.cameraOff')}</span>
                  </label>

                  {cameraEnabled && (
                    <>
                      <label className="text-xs text-muted-foreground">{t('capture.cameraSourceMode')}</label>
                      <select
                        value={cameraSourceMode}
                        onChange={(event) => setCameraSourceMode(event.target.value as CameraSourceMode)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        disabled={isRecording}
                      >
                        <option value="auto">{t('capture.cameraSourceAuto')}</option>
                        <option value="usb">{t('capture.cameraSourceUsb')}</option>
                      </select>

                      <select
                        value={selectedCameraDeviceId}
                        onChange={(event) => setSelectedCameraDeviceId(event.target.value)}
                        className="h-8 min-w-[160px] rounded-md border border-input bg-background px-2 text-xs"
                        disabled={isRecording || cameraDevices.length === 0}
                      >
                        {cameraDevices.length === 0 && <option value="">{t('capture.cameraNoDevice')}</option>}
                        {cameraDevices.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>{device.label || `${t('capture.cameraDevice')} ${index + 1}`}</option>
                        ))}
                      </select>

                    </>
                  )}
                  {recordAudioSource !== 'mic' && recordAudioSource !== 'none' && stream && !systemAudioTrackAvailable && (
                    <span className="text-[11px] text-muted-foreground">{t('capture.systemAudioNotCaptured')}</span>
                  )}
                  {browserInfo.isSafari && (
                    <span className="text-[11px] text-muted-foreground">{t('capture.safariAudioHint')}</span>
                  )}
                  {browserInfo.isEdge && (
                    <span className="text-[11px] text-muted-foreground">{t('capture.edgeAudioHint')}</span>
                  )}

                  {!stream ? (
                    <Button size="sm" onClick={() => void startRecordPreview()} className="gap-1" disabled={isRecording}>
                      <Monitor className="w-4 h-4" /> {t('capture.start')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={stopShare} className="gap-1" disabled={isRecording}>
                      <StopCircle className="w-4 h-4" /> {t('capture.stop')}
                    </Button>
                  )}
                </>
              )}

              <div className="ml-auto" />
              <Button size="sm" variant="outline" onClick={closeWorkspace}>{t('capture.exitWorkspace')}</Button>
            </div>
          </div>

          {workspaceMode === 'record' ? (
            <div className="flex-1 min-h-0 p-4 pt-20 pb-16 sm:p-6 sm:pt-20 sm:pb-16 overflow-auto">
              <div className="max-w-6xl mx-auto h-full">
                <div className="rounded-xl border border-border bg-background/50 p-2 h-full flex items-center justify-center">
                  <div
                    ref={liveVideoWrapRef}
                    className="relative inline-block max-h-full max-w-full"
                    onMouseMove={moveRegionAdjust}
                    onMouseUp={endRegionAdjust}
                    onMouseLeave={endRegionAdjust}
                  >
                    <video ref={videoRef} autoPlay muted playsInline className="max-h-[72vh] max-w-full object-contain rounded-lg" />
                    <video ref={cameraSourceVideoRef} autoPlay muted playsInline className="absolute -left-[9999px] top-0 h-px w-px opacity-0 pointer-events-none" />
                    {stream && (
                      <>
                        <div className="absolute inset-0 pointer-events-none bg-black/20 rounded-lg" />
                        <div
                          className="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]"
                          style={{
                            left: `${liveRegion.x * 100}%`,
                            top: `${liveRegion.y * 100}%`,
                            width: `${liveRegion.w * 100}%`,
                            height: `${liveRegion.h * 100}%`,
                          }}
                        >
                          <div className="absolute inset-0 cursor-move" onMouseDown={(event) => beginRegionAdjust(event, 'move')} />
                          <div className="absolute -left-2 -top-2 h-4 w-4 rounded-full border border-white bg-primary cursor-nwse-resize" onMouseDown={(event) => beginRegionAdjust(event, 'nw')} />
                          <div className="absolute -right-2 -top-2 h-4 w-4 rounded-full border border-white bg-primary cursor-nesw-resize" onMouseDown={(event) => beginRegionAdjust(event, 'ne')} />
                          <div className="absolute -left-2 -bottom-2 h-4 w-4 rounded-full border border-white bg-primary cursor-nesw-resize" onMouseDown={(event) => beginRegionAdjust(event, 'sw')} />
                          <div className="absolute -right-2 -bottom-2 h-4 w-4 rounded-full border border-white bg-primary cursor-nwse-resize" onMouseDown={(event) => beginRegionAdjust(event, 'se')} />
                        </div>
                        {cameraEnabled && cameraStream && (
                          <div
                            className="absolute rounded-full border-2 border-white/80 shadow-xl overflow-hidden"
                            style={{
                              left: `${cameraOverlay.x * 100}%`,
                              top: `${cameraOverlay.y * 100}%`,
                              width: `${cameraOverlay.size * 100}%`,
                              height: `${cameraOverlay.size * 100}%`,
                            }}
                          >
                            <div className="absolute inset-0 cursor-move" onMouseDown={(event) => beginCameraAdjust(event, 'move')} />
                            <canvas ref={cameraPreviewCanvasRef} className="absolute inset-0 h-full w-full rounded-full object-cover pointer-events-none bg-slate-900" />
                            <div
                              className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full border border-white bg-primary cursor-nwse-resize"
                              onMouseDown={(event) => beginCameraAdjust(event, 'resize')}
                            />
                          </div>
                        )}
                        {recordCountdown !== null && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-black/45">
                            <div className="text-white text-6xl font-bold tabular-nums">{recordCountdown}</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {isRecording && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-muted-foreground leading-5">{t('capture.recordingHint')}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{t('capture.recordDuration')}: {formatDuration(recordingSeconds)}</span>
                      <span>{t('capture.recordEstimatedSize')}: {formatBytes(Math.max(recordingBytes, estimatedRecordingBytes))}</span>
                      <span>{t('capture.recordFormat')}: {recordOutputLabel}</span>
                    </div>
                  </div>
                )}
              </div>

              {stream && (
                <div className="fixed right-4 top-20 z-[121] rounded-2xl border border-border bg-card/95 backdrop-blur px-3 py-3 shadow-lg max-w-[calc(100vw-32px)]">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {!isRecording ? (
                      <Button size="sm" onClick={startRecordingWithCountdown} className="gap-1" disabled={recordCountdown !== null}>
                        <Video className="w-4 h-4" /> {t('capture.startRecord')}
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={toggleRecordingPause} className="gap-1">
                          {isRecordingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />} {isRecordingPaused ? t('capture.resumeRecord') : t('capture.pauseRecord')}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={stopRecording} className="gap-1">
                          <StopCircle className="w-4 h-4" /> {t('capture.stopRecord')}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLiveRegion({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })}
                      className="gap-1"
                      disabled={isRecording}
                    >
                      <RefreshCcw className="w-4 h-4" /> {t('capture.resetSelection')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : !captured ? (
            <div className="flex-1 min-h-0 p-4 pt-20 pb-28 sm:p-6 sm:pt-20 sm:pb-28 overflow-auto">
              <div className="max-w-6xl mx-auto h-full">
                <div className="rounded-xl border border-border bg-background/50 p-2 h-full flex items-center justify-center">
                  <div
                    ref={liveVideoWrapRef}
                    className="relative inline-block max-h-full max-w-full"
                    onMouseMove={moveRegionAdjust}
                    onMouseUp={endRegionAdjust}
                    onMouseLeave={endRegionAdjust}
                  >
                    <video ref={videoRef} autoPlay muted playsInline className="max-h-[72vh] max-w-full object-contain rounded-lg" />
                    {stream && (
                      <>
                        <div className="absolute inset-0 pointer-events-none bg-black/20 rounded-lg" />
                        <div
                          className="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]"
                          style={{
                            left: `${liveRegion.x * 100}%`,
                            top: `${liveRegion.y * 100}%`,
                            width: `${liveRegion.w * 100}%`,
                            height: `${liveRegion.h * 100}%`,
                          }}
                        >
                          <div className="absolute inset-0 cursor-move" onMouseDown={(event) => beginRegionAdjust(event, 'move')} />
                          <div className="absolute -left-2 -top-2 h-4 w-4 rounded-full border border-white bg-primary cursor-nwse-resize" onMouseDown={(event) => beginRegionAdjust(event, 'nw')} />
                          <div className="absolute -right-2 -top-2 h-4 w-4 rounded-full border border-white bg-primary cursor-nesw-resize" onMouseDown={(event) => beginRegionAdjust(event, 'ne')} />
                          <div className="absolute -left-2 -bottom-2 h-4 w-4 rounded-full border border-white bg-primary cursor-nesw-resize" onMouseDown={(event) => beginRegionAdjust(event, 'sw')} />
                          <div className="absolute -right-2 -bottom-2 h-4 w-4 rounded-full border border-white bg-primary cursor-nwse-resize" onMouseDown={(event) => beginRegionAdjust(event, 'se')} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {!stream && (
                  <p className="text-xs text-muted-foreground mt-3 leading-5">{t('capture.limitHint')}</p>
                )}
              </div>
              {stream && (
                <div className="fixed right-4 top-20 z-[121] rounded-2xl border border-border bg-card/95 backdrop-blur px-3 py-3 shadow-lg max-w-[calc(100vw-32px)]">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button size="sm" onClick={() => void captureVisibleArea()} className="gap-1">
                      <Camera className="w-4 h-4" /> {t('capture.captureVisible')}
                    </Button>
                    <Button size="sm" onClick={() => void captureSelectedRegionToEditor()} className="gap-1">
                      <Crop className="w-4 h-4" /> {t('capture.captureRegion')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLiveRegion({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })}
                      className="gap-1"
                    >
                      <RefreshCcw className="w-4 h-4" /> {t('capture.resetSelection')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 p-4 pt-20 pb-36 sm:p-6 sm:pt-20 sm:pb-36 overflow-auto">
              <div className="max-w-7xl mx-auto">
                <div
                  ref={previewRef}
                  className={`rounded-xl border border-border bg-background/50 p-2 mb-3 relative select-none ${tool === 'crop' ? 'cursor-crosshair' : ''}`}
                  onMouseDown={handlePreviewMouseDown}
                  onMouseMove={handlePreviewMouseMove}
                  onMouseUp={handlePreviewMouseUp}
                  onMouseLeave={handlePreviewMouseUp}
                >
                  <img
                    ref={imageRef}
                    src={captured}
                    alt={t('capture.previewAlt')}
                    className="w-full max-h-[70vh] object-contain rounded-lg"
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
                      {tool === 'crop' ? (
                        cropRect && cropRect.w > 0 && cropRect.h > 0 ? (
                          <>
                            <rect x={0} y={0} width={imageSize.width} height={cropRect.y} fill="rgba(15, 23, 42, 0.35)" />
                            <rect x={0} y={cropRect.y + cropRect.h} width={imageSize.width} height={Math.max(0, imageSize.height - cropRect.y - cropRect.h)} fill="rgba(15, 23, 42, 0.35)" />
                            <rect x={0} y={cropRect.y} width={cropRect.x} height={cropRect.h} fill="rgba(15, 23, 42, 0.35)" />
                            <rect x={cropRect.x + cropRect.w} y={cropRect.y} width={Math.max(0, imageSize.width - cropRect.x - cropRect.w)} height={cropRect.h} fill="rgba(15, 23, 42, 0.35)" />
                          </>
                        ) : (
                          <>
                            <rect x={0} y={0} width={imageSize.width} height={imageSize.height} fill="rgba(15, 23, 42, 0.18)" />
                            <line x1={imageSize.width / 2} y1={0} x2={imageSize.width / 2} y2={imageSize.height} stroke="rgba(59,130,246,0.65)" strokeWidth={1.5} strokeDasharray="6 6" />
                            <line x1={0} y1={imageSize.height / 2} x2={imageSize.width} y2={imageSize.height / 2} stroke="rgba(59,130,246,0.65)" strokeWidth={1.5} strokeDasharray="6 6" />
                          </>
                        )
                      ) : null}
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
              </div>

              <div className="fixed left-1/2 bottom-4 z-[121] -translate-x-1/2 w-[min(1180px,calc(100vw-20px))] rounded-xl border border-border bg-card/95 backdrop-blur px-2 py-2 shadow-lg">
                <div className="overflow-x-auto">
                  <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
                    <Button size="sm" variant={tool === 'none' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('none')}>{t('capture.toolNone')}</Button>
                    <Button size="sm" variant={tool === 'crop' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('crop')}><Crop className="w-3.5 h-3.5" /> {t('capture.toolCrop')}</Button>
                    <Button size="sm" variant={tool === 'draw' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('draw')}><Brush className="w-3.5 h-3.5" /> {t('capture.toolDraw')}</Button>
                    <Button size="sm" variant={tool === 'highlight' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('highlight')}><Highlighter className="w-3.5 h-3.5" /> {t('capture.toolHighlight')}</Button>
                    <Button size="sm" variant={tool === 'rect' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('rect')}><Square className="w-3.5 h-3.5" /> {t('capture.toolRect')}</Button>
                    <Button size="sm" variant={tool === 'arrow' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('arrow')}><ArrowUpRight className="w-3.5 h-3.5" /> {t('capture.toolArrow')}</Button>
                    <Button size="sm" variant={tool === 'text' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('text')}><Type className="w-3.5 h-3.5" /> {t('capture.toolText')}</Button>
                    <Button size="sm" variant={tool === 'mosaic' ? 'default' : 'outline'} className="h-8 gap-1" onClick={() => setTool('mosaic')}><Square className="w-3.5 h-3.5" /> {t('capture.toolMosaic')}</Button>

                    <div className="h-5 w-px bg-border mx-1" />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
                      {t('capture.color')}
                      <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-8 w-8 rounded border border-border bg-transparent p-0" />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      {t('capture.brushSize')}
                      <input className="w-20" type="range" min={2} max={24} step={1} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
                      <span className="text-foreground">{brushSize}px</span>
                    </label>
                    {tool === 'text' && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        {t('capture.textLabel')}
                        <input
                          value={textDraft}
                          onChange={(event) => setTextDraft(event.target.value)}
                          placeholder={t('capture.textPlaceholder')}
                          className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                        />
                      </label>
                    )}

                    <div className="h-5 w-px bg-border mx-1" />
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={undoAnnotation} disabled={annotations.length === 0}><Undo2 className="w-3.5 h-3.5" /> {t('capture.toolUndo')}</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={clearAnnotations} disabled={annotations.length === 0 && !draftAnnotation}><RefreshCcw className="w-3.5 h-3.5" /> {t('capture.toolClear')}</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void applyCrop()} disabled={tool !== 'crop'}><Crop className="w-3.5 h-3.5" /> {t('capture.applyCrop')}</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void resetCapture()}><RefreshCcw className="w-3.5 h-3.5" /> {t('capture.resetCrop')}</Button>

                    <div className="h-5 w-px bg-border mx-1" />
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void copyToClipboard()}><Clipboard className="w-3.5 h-3.5" /> {t('capture.copyClipboard')}</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void downloadImage('png')}><Download className="w-3.5 h-3.5" /> {t('capture.formatPng')}</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void downloadImage('jpeg')}><Download className="w-3.5 h-3.5" /> {t('capture.formatJpg')}</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void downloadImage('webp')}><Download className="w-3.5 h-3.5" /> {t('capture.formatWebp')}</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void downloadPdf()}><Square className="w-3.5 h-3.5" /> {t('capture.formatPdf')}</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
