import { supabase } from '@/integrations/supabase/client';

/**
 * Seat-chart picture upload.
 *
 * Conference seat charts are often 10–20 MB phone photos. Sending the raw file
 * over a slow classroom network frequently stalls, so the picture is downscaled
 * in the browser first, then uploaded with real byte-level progress (XHR) and
 * one automatic retry on network failure.
 */

const MAX_EDGE = 2600;
const TARGET_MAX_BYTES = 4 * 1024 * 1024;

export interface SeatChartUploadResult {
  publicUrl: string;
  path: string;
  bytes: number;
}

function loadLocalImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片无法读取，请换一张图片')); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', quality));
}

/** Downscale + re-encode. Returns the original file when it is already small. */
export async function compressSeatChart(file: File): Promise<{ blob: Blob; contentType: string; ext: string }> {
  const isJpegLike = /image\/(jpe?g|png|webp)/i.test(file.type);
  if (!isJpegLike) return { blob: file, contentType: file.type, ext: extOf(file) };
  if (file.size <= TARGET_MAX_BYTES) {
    try {
      const probe = await loadLocalImage(file);
      const maxEdge = Math.max(probe.naturalWidth, probe.naturalHeight);
      if (maxEdge <= MAX_EDGE) return { blob: file, contentType: file.type, ext: extOf(file) };
    } catch {
      return { blob: file, contentType: file.type, ext: extOf(file) };
    }
  }

  try {
    const img = await loadLocalImage(file);
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, contentType: file.type, ext: extOf(file) };
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let quality = 0.92;
    let blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > TARGET_MAX_BYTES && quality > 0.6) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, quality);
    }
    if (!blob || blob.size >= file.size) return { blob: file, contentType: file.type, ext: extOf(file) };
    return { blob, contentType: 'image/jpeg', ext: 'jpg' };
  } catch {
    return { blob: file, contentType: file.type, ext: extOf(file) };
  }
}

function extOf(file: File): string {
  const fromName = (file.name.split('.').pop() || '').toLowerCase();
  if (/^(png|jpe?g|webp|gif|bmp)$/.test(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
  if (/png/i.test(file.type)) return 'png';
  if (/webp/i.test(file.type)) return 'webp';
  return 'jpg';
}

function xhrUpload(
  path: string,
  body: Blob,
  contentType: string,
  accessToken: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/storage/v1/object/board-media/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', apiKey);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    if (contentType) xhr.setRequestHeader('content-type', contentType);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(100); resolve(); return; }
      let message = `上传失败（${xhr.status}）`;
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed?.message || parsed?.error) message = String(parsed.message || parsed.error);
      } catch { /* keep default */ }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error('网络中断，上传失败'));
    xhr.ontimeout = () => reject(new Error('上传超时，请检查网络后重试'));
    xhr.timeout = 180000;
    xhr.send(body);
  });
}

export async function uploadSeatChartImage(
  file: File,
  onProgress?: (pct: number, stage: 'compress' | 'upload') => void,
): Promise<SeatChartUploadResult> {
  onProgress?.(2, 'compress');
  const { blob, contentType, ext } = await compressSeatChart(file);
  onProgress?.(8, 'upload');

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const path = `seat-charts/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    try {
      await xhrUpload(path, blob, contentType, accessToken, pct => {
        onProgress?.(8 + Math.round(pct * 0.8), 'upload');
      });
      const { data } = supabase.storage.from('board-media').getPublicUrl(path);
      return { publicUrl: data.publicUrl, path, bytes: blob.size };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('上传失败，请重试');
}
