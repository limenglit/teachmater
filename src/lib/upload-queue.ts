/**
 * Upload Queue with retry, concurrency control, image compression, and progress tracking.
 * Designed for high-concurrency classroom scenarios (100+ simultaneous uploads).
 */

import { supabase } from '@/integrations/supabase/client';
import { TokenBucketLimiter } from '@/lib/concurrency-utils';

// Global rate limiter: 10 uploads/sec burst, 5/sec sustained
const uploadLimiter = new TokenBucketLimiter(10, 5);

// ─── Configuration ───────────────────────────────────────────────
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE_MB: 10,           // Max file size in MB
  MAX_IMAGE_DIMENSION: 1920,      // Max width/height for compressed images
  IMAGE_QUALITY: 0.8,             // JPEG compression quality (0-1)
  CONCURRENCY: 3,                 // Max simultaneous uploads
  MAX_RETRIES: 3,                 // Retry count on failure
  RETRY_DELAY_MS: 1000,           // Base delay between retries (exponential)
} as const;

// ─── Types ───────────────────────────────────────────────────────
export interface UploadTask {
  id: string;
  file: File;
  bucket: string;
  path: string;
  status: 'queued' | 'uploading' | 'success' | 'failed';
  progress: number;  // 0-100
  retries: number;
  publicUrl?: string;
  error?: string;
}

type UploadListener = (tasks: UploadTask[]) => void;

// ─── Image Compression ──────────────────────────────────────────
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];

export async function compressImage(file: File): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type)) return file;
  // Skip small images (< 500KB)
  if (file.size < 500 * 1024) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      const max = UPLOAD_CONFIG.MAX_IMAGE_DIMENSION;

      let w = width, h = height;
      if (w > max || h > max) {
        const ratio = Math.min(max / w, max / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const compressed = new File([blob], file.name, { type: 'image/jpeg' });
            resolve(compressed);
          } else {
            resolve(file); // Keep original if compression made it larger
          }
        },
        'image/jpeg',
        UPLOAD_CONFIG.IMAGE_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original
    };
    img.src = url;
  });
}

// ─── File Validation ─────────────────────────────────────────────
export function validateFile(file: File): string | null {
  const maxBytes = UPLOAD_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `文件大小超过 ${UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB 限制`;
  }
  return null;
}

// ─── Upload Queue Class ─────────────────────────────────────────
class UploadQueue {
  private tasks: UploadTask[] = [];
  private activeCount = 0;
  private listeners: Set<UploadListener> = new Set();

  subscribe(listener: UploadListener): () => void {
    this.listeners.add(listener);
    listener([...this.tasks]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = [...this.tasks];
    this.listeners.forEach(l => l(snapshot));
  }

  enqueue(file: File, bucket: string, basePath: string): UploadTask {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${basePath}/${crypto.randomUUID()}.${ext}`;
    const task: UploadTask = {
      id: crypto.randomUUID(),
      file,
      bucket,
      path,
      status: 'queued',
      progress: 0,
      retries: 0,
    };
    this.tasks.push(task);
    this.notify();
    this.processNext();
    return task;
  }

  private async processNext() {
    if (this.activeCount >= UPLOAD_CONFIG.CONCURRENCY) return;

    const next = this.tasks.find(t => t.status === 'queued');
    if (!next) return;

    this.activeCount++;
    next.status = 'uploading';
    next.progress = 10;
    this.notify();

    try {
      // Compress if image
      let fileToUpload = next.file;
      if (IMAGE_TYPES.includes(next.file.type)) {
        next.progress = 20;
        this.notify();
        fileToUpload = await compressImage(next.file);
      }

      next.progress = 40;
      this.notify();

      // Upload with retry
      let lastError: string | undefined;
      for (let attempt = 0; attempt <= UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delay = UPLOAD_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, delay));
          next.retries = attempt;
          next.progress = 40;
          this.notify();
        }

        const { data, error } = await supabase.storage
          .from(next.bucket)
          .upload(next.path, fileToUpload, { upsert: false });

        if (!error && data) {
          const { data: urlData } = supabase.storage
            .from(next.bucket)
            .getPublicUrl(data.path);
          next.publicUrl = urlData.publicUrl;
          next.status = 'success';
          next.progress = 100;
          lastError = undefined;
          break;
        }

        lastError = error?.message || 'Upload failed';
        next.progress = 40 + attempt * 10;
        this.notify();
      }

      if (lastError) {
        next.status = 'failed';
        next.error = lastError;
      }
    } catch (err) {
      next.status = 'failed';
      next.error = err instanceof Error ? err.message : 'Unknown error';
    }

    this.notify();
    this.activeCount--;
    this.processNext();
  }

  getStats() {
    const total = this.tasks.length;
    const success = this.tasks.filter(t => t.status === 'success').length;
    const failed = this.tasks.filter(t => t.status === 'failed').length;
    const pending = this.tasks.filter(t => t.status === 'queued' || t.status === 'uploading').length;
    return { total, success, failed, pending };
  }

  clear() {
    this.tasks = this.tasks.filter(t => t.status === 'uploading');
    this.notify();
  }

  retryFailed() {
    this.tasks.forEach(t => {
      if (t.status === 'failed') {
        t.status = 'queued';
        t.retries = 0;
        t.error = undefined;
        t.progress = 0;
      }
    });
    this.notify();
    this.processNext();
  }
}

// Singleton instance
export const uploadQueue = new UploadQueue();

// ─── Batch Card Insert ──────────────────────────────────────────
/**
 * Insert multiple board cards in a single DB call to reduce connection overhead.
 */
export async function batchInsertCards(
  cards: Array<{
    board_id: string;
    content: string;
    card_type: string;
    url: string;
    color: string;
    author_nickname: string;
    is_approved: boolean;
    column_id: string;
    media_url: string;
    position_x: number;
    position_y: number;
    sort_order: number;
  }>
) {
  if (cards.length === 0) return { error: null };
  // Supabase supports batch insert natively
  const { error } = await supabase.from('board_cards').insert(cards);
  return { error };
}
