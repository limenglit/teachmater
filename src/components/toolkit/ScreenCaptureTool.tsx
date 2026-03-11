import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Camera, Download, Monitor, Square, StopCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

export default function ScreenCaptureTool() {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string>('');

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
        video: true,
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
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast({ title: t('capture.noFrame'), variant: 'destructive' });
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCaptured(canvas.toDataURL('image/png'));
    toast({ title: t('capture.captured') });
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
          <div className="rounded-xl border border-border bg-background/50 p-2 mb-3">
            <img src={captured} alt={t('capture.previewAlt')} className="w-full max-h-48 object-contain rounded-lg" />
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
