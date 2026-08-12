import { useState, useCallback, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { X, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { uploadBoardMediaFile, type UploadBoardMediaOptions, type UploadBoardMediaResult } from '@/lib/board-media-upload';
import { compressImage } from '@/lib/upload-queue';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Upload item type ────────────────────────────────────────
export interface UploadItem {
  id: string;
  file: File;
  options: UploadBoardMediaOptions;
  status: 'compressing' | 'uploading' | 'success' | 'failed';
  progress: number;
  /** Bytes transferred so far. */
  loaded?: number;
  /** Total bytes to transfer. */
  total?: number;
  /** Transfer speed in bytes per second. */
  speed?: number;
  /** Estimated seconds remaining. */
  eta?: number;
  result?: UploadBoardMediaResult;
  error?: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return `${m}m${rest.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h${(m % 60).toString().padStart(2, '0')}m`;
}

// ─── Hook: useUploadProgress ─────────────────────────────────
export function useUploadProgress() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  itemsRef.current = items;

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }, []);

  const processUpload = useCallback(async (item: UploadItem): Promise<UploadBoardMediaResult | null> => {
    const { id, file, options } = item;

    try {
      // Stage 1: Compress if image
      let fileToUpload: Blob | File = file;
      if (file.type.startsWith('image/')) {
        updateItem(id, { status: 'compressing', progress: 15 });
        fileToUpload = await compressImage(file);
      }

      // Stage 2: Upload with real byte-level progress
      const totalBytes = fileToUpload.size;
      updateItem(id, { status: 'uploading', progress: 0, loaded: 0, total: totalBytes, speed: 0, eta: undefined });

      const startedAt = Date.now();
      let lastAt = startedAt;
      let lastLoaded = 0;
      let smoothedSpeed = 0;

      try {
        const result = await uploadBoardMediaFile(fileToUpload, {
          ...options,
          fileName: file.name,
          onProgress: (loaded, total) => {
            const now = Date.now();
            const dt = (now - lastAt) / 1000;
            if (dt >= 0.2) {
              const instant = (loaded - lastLoaded) / dt;
              smoothedSpeed = smoothedSpeed ? smoothedSpeed * 0.7 + instant * 0.3 : instant;
              lastAt = now;
              lastLoaded = loaded;
            }
            const denom = total || totalBytes || 1;
            const remaining = Math.max(0, denom - loaded);
            updateItem(id, {
              progress: Math.min(99, Math.round((loaded / denom) * 100)),
              loaded,
              total: denom,
              speed: smoothedSpeed,
              eta: smoothedSpeed > 0 ? remaining / smoothedSpeed : undefined,
            });
          },
        });
        const elapsed = Math.max(0.001, (Date.now() - startedAt) / 1000);
        updateItem(id, {
          status: 'success',
          progress: 100,
          loaded: totalBytes,
          total: totalBytes,
          speed: totalBytes / elapsed,
          eta: 0,
          result,
        });
        return result;
      } catch (err) {
        throw err;
      }
    } catch (err: any) {
      updateItem(id, {
        status: 'failed',
        progress: 0,
        speed: 0,
        eta: undefined,
        error: err?.message || 'Upload failed',
      });
      return null;
    }
  }, [updateItem]);

  const addUpload = useCallback((file: File, options: UploadBoardMediaOptions) => {
    const item: UploadItem = {
      id: crypto.randomUUID(),
      file,
      options,
      status: 'compressing',
      progress: 5,
    };
    setItems(prev => [...prev, item]);
    return { item, promise: processUpload(item) };
  }, [processUpload]);

  const retryUpload = useCallback((id: string) => {
    const item = itemsRef.current.find(it => it.id === id);
    if (!item || item.status !== 'failed') return null;
    updateItem(id, { status: 'compressing', progress: 5, error: undefined, loaded: 0, speed: 0, eta: undefined });
    return processUpload({ ...item, status: 'compressing', progress: 5, error: undefined });
  }, [processUpload, updateItem]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(it => it.status !== 'success'));
  }, []);

  const hasActive = items.some(it => it.status === 'compressing' || it.status === 'uploading');

  return { items, addUpload, retryUpload, removeItem, clearCompleted, hasActive };
}

// ─── UI Component ────────────────────────────────────────────
interface UploadProgressPanelProps {
  items: UploadItem[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
}

export function UploadProgressPanel({ items, onRetry, onRemove, onClearCompleted }: UploadProgressPanelProps) {
  const { t } = useLanguage();
  if (items.length === 0) return null;

  const statusLabel = (status: UploadItem['status']) => {
    switch (status) {
      case 'compressing': return t('board.uploadCompressing');
      case 'uploading': return t('board.uploading');
      case 'success': return t('board.uploadDone');
      case 'failed': return t('board.uploadFailed');
    }
  };

  const hasCompleted = items.some(it => it.status === 'success');

  return (
    <div className="absolute bottom-2 right-2 z-50 w-72 bg-background/95 backdrop-blur border rounded-lg shadow-lg p-3 space-y-2 max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-foreground">{t('board.uploadProgress')}</span>
        {hasCompleted && (
          <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={onClearCompleted}>
            {t('board.uploadClearDone')}
          </Button>
        )}
      </div>
      {items.map(item => (
        <div key={item.id} className="space-y-1">
          <div className="flex items-center gap-1.5">
            {item.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
            {item.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
            {(item.status === 'compressing' || item.status === 'uploading') && (
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
            )}
            <span className="text-xs truncate flex-1" title={item.file.name}>{item.file.name}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{statusLabel(item.status)}</span>
            {item.status === 'failed' && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-1.5 text-[10px] gap-1 shrink-0"
                onClick={() => onRetry(item.id)}
                title={t('board.uploadRetry')}
              >
                <RotateCcw className="w-3 h-3" />
                {t('board.uploadRetry')}
              </Button>
            )}
            {(item.status === 'success' || item.status === 'failed') && (
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onRemove(item.id)}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          {(item.status === 'compressing' || item.status === 'uploading') && (
            <>
              <Progress value={item.progress} className="h-1.5" />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>
                  {item.status === 'uploading' && item.total
                    ? `${formatBytes(item.loaded || 0)} / ${formatBytes(item.total)} · ${item.progress}%`
                    : formatBytes(item.file.size)}
                </span>
                {item.status === 'uploading' && (
                  <span>
                    {item.speed ? `${formatBytes(item.speed)}/s` : '--'}
                    {item.eta !== undefined ? ` · ${formatDuration(item.eta)}` : ''}
                  </span>
                )}
              </div>
            </>
          )}
          {item.status === 'success' && (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatBytes(item.total || item.file.size)}
              {item.speed ? ` · ${formatBytes(item.speed)}/s` : ''}
            </div>
          )}
          {item.status === 'failed' && item.error && (
            <p className="text-[10px] text-destructive truncate">{item.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}
