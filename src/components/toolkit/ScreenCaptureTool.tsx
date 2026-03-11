import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Camera, Crop, Download, Monitor, RefreshCcw, Square, StopCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

export default function ScreenCaptureTool() {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sourceMode, setSourceMode] = useState<'screen' | 'window' | 'browser'>('screen');
  const [captured, setCaptured] = useState<string>('');
  const [originalCapture, setOriginalCapture] = useState<string>('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

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

  const captureFrame = () => {
    const run = async () => {
      if (!stream) {
        toast({ title: t('capture.noFrame'), variant: 'destructive' });
        return;
      }

      const track = stream.getVideoTracks()[0];
      if (!track) {
        toast({ title: t('capture.noFrame'), variant: 'destructive' });
        return;
      }

      try {
        const canvas = document.createElement('canvas');

        if ('ImageCapture' in window) {
          const imageCapture = new (window as any).ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        } else {
          const video = videoRef.current;
          if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
            toast({ title: t('capture.noFrame'), variant: 'destructive' });
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        const dataUrl = canvas.toDataURL('image/png');
        setOriginalCapture(dataUrl);
        setCaptured(dataUrl);
        setImageSize({ width: canvas.width, height: canvas.height });
        setCropRect(null);
        setDragStart(null);
        toast({ title: t('capture.captured') });
      } catch {
        toast({ title: t('capture.noFrame'), variant: 'destructive' });
      }
    };

    void run();
  };

  const toPreviewPoint = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = previewRef.current?.getBoundingClientRect();
    if (!box) return null;
    const x = Math.max(0, Math.min(event.clientX - box.left, box.width));
    const y = Math.max(0, Math.min(event.clientY - box.top, box.height));
    return { x, y, width: box.width, height: box.height };
  };

  const onCropStart = (event: React.MouseEvent<HTMLDivElement>) => {
    const point = toPreviewPoint(event);
    if (!point) return;
    setDragging(true);
    setDragStart({ x: point.x, y: point.y });
    setCropRect({ x: point.x, y: point.y, w: 0, h: 0 });
  };

  const onCropMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || !dragStart) return;
    const point = toPreviewPoint(event);
    if (!point) return;
    const x = Math.min(dragStart.x, point.x);
    const y = Math.min(dragStart.y, point.y);
    const w = Math.abs(point.x - dragStart.x);
    const h = Math.abs(point.y - dragStart.y);
    setCropRect({ x, y, w, h });
  };

  const onCropEnd = () => {
    setDragging(false);
    setDragStart(null);
  };

  const applyCrop = () => {
    if (!captured || !cropRect || cropRect.w < 4 || cropRect.h < 4) {
      toast({ title: t('capture.noCropArea'), variant: 'destructive' });
      return;
    }

    const img = new Image();
    img.onload = () => {
      const previewBox = previewRef.current?.getBoundingClientRect();
      if (!previewBox) return;

      const scaleX = imageSize.width / previewBox.width;
      const scaleY = imageSize.height / previewBox.height;
      const sx = Math.max(0, Math.round(cropRect.x * scaleX));
      const sy = Math.max(0, Math.round(cropRect.y * scaleY));
      const sw = Math.max(1, Math.round(cropRect.w * scaleX));
      const sh = Math.max(1, Math.round(cropRect.h * scaleY));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const next = canvas.toDataURL('image/png');
      setCaptured(next);
      setImageSize({ width: sw, height: sh });
      setCropRect(null);
      toast({ title: t('capture.cropped') });
    };
    img.src = captured;
  };

  const resetCrop = () => {
    if (!originalCapture) return;
    setCaptured(originalCapture);
    const img = new Image();
    img.onload = () => setImageSize({ width: img.width, height: img.height });
    img.src = originalCapture;
    setCropRect(null);
  };

  const downloadImage = (format: 'png' | 'jpeg' | 'webp') => {
    if (!captured) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      const mime = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `capture-${Date.now()}.${format === 'jpeg' ? 'jpg' : format}`;
          a.click();
          URL.revokeObjectURL(url);
        },
        mime,
        0.95,
      );
    };
    img.src = captured;
  };

  const downloadPdf = () => {
    if (!captured) return;
    const img = new Image();
    img.onload = () => {
      const orientation = img.width > img.height ? 'l' : 'p';
      const pdf = new jsPDF({ orientation, unit: 'pt', format: [img.width, img.height] });
      pdf.addImage(captured, 'PNG', 0, 0, img.width, img.height);
      pdf.save(`capture-${Date.now()}.pdf`);
    };
    img.src = captured;
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <Monitor className="w-4 h-4" /> {t('capture.title')}
      </h3>

      <p className="text-xs text-muted-foreground mb-3">{t('capture.desc')}</p>

      <div className="mb-3">
        <label className="text-xs text-muted-foreground block mb-1">{t('capture.sourceLabel')}</label>
        <select
          value={sourceMode}
          onChange={(event) => setSourceMode(event.target.value as 'screen' | 'window' | 'browser')}
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
            <Button size="sm" onClick={captureFrame} className="gap-1">
              <Camera className="w-4 h-4" /> {t('capture.captureNow')}
            </Button>
            <Button size="sm" variant="outline" onClick={stopShare} className="gap-1">
              <StopCircle className="w-4 h-4" /> {t('capture.stop')}
            </Button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-background/50 p-2 mb-3">
        <video ref={videoRef} autoPlay muted playsInline className="w-full max-h-48 object-contain rounded-lg" />
      </div>

      {captured && (
        <>
          <div
            ref={previewRef}
            className="rounded-xl border border-border bg-background/50 p-2 mb-3 relative select-none"
            onMouseDown={onCropStart}
            onMouseMove={onCropMove}
            onMouseUp={onCropEnd}
            onMouseLeave={onCropEnd}
          >
            <img src={captured} alt={t('capture.previewAlt')} className="w-full max-h-48 object-contain rounded-lg" draggable={false} />
            {cropRect && (
              <div
                className="absolute border-2 border-primary bg-primary/20"
                style={{
                  left: `${cropRect.x}px`,
                  top: `${cropRect.y}px`,
                  width: `${cropRect.w}px`,
                  height: `${cropRect.h}px`,
                }}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <Button size="sm" variant="outline" className="gap-1" onClick={applyCrop}>
              <Crop className="w-3.5 h-3.5" /> {t('capture.applyCrop')}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={resetCrop}>
              <RefreshCcw className="w-3.5 h-3.5" /> {t('capture.resetCrop')}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadImage('png')}>
              <Download className="w-3.5 h-3.5" /> {t('capture.formatPng')}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadImage('jpeg')}>
              <Download className="w-3.5 h-3.5" /> {t('capture.formatJpg')}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadImage('webp')}>
              <Download className="w-3.5 h-3.5" /> {t('capture.formatWebp')}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={downloadPdf}>
              <Square className="w-3.5 h-3.5" /> {t('capture.formatPdf')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
