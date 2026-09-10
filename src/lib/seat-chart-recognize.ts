import { supabase } from '@/integrations/supabase/client';
import { buildTileGrid, tilePointToImage, type ChartTile } from './seat-chart-tiles';
import { dedupeMarkers, sanitizeMarkers, applyMarkerLimit, type SeatChartMarker } from './seat-chart-markers';

export interface RecognizeProgress {
  done: number;
  total: number;
  found: number;
}

export interface RecognizeResult {
  markers: SeatChartMarker[];
  truncated: number;
  failedTiles: number;
  lastError: string | null;
}

const MAX_TILE_EDGE = 1600;
const CONCURRENCY = 3;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => reject(new Error('图片加载超时')), 30000);
    img.onload = () => { window.clearTimeout(timer); resolve(img); };
    img.onerror = () => { window.clearTimeout(timer); reject(new Error('图片无法加载')); };
    img.src = src;
  });
}

function cropTile(img: HTMLImageElement, tile: ChartTile): string {
  const scale = Math.min(1, MAX_TILE_EDGE / Math.max(tile.sw, tile.sh));
  const w = Math.max(1, Math.round(tile.sw * scale));
  const h = Math.max(1, Math.round(tile.sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持画布');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, tile.sx, tile.sy, tile.sw, tile.sh, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Recognize every name on a seating-chart picture by splitting it into
 * overlapping tiles and asking the AI for per-tile normalized coordinates,
 * then mapping the results back into whole-image coordinates.
 */
export async function recognizeSeatChartMarkers(
  imageUrl: string,
  onProgress?: (p: RecognizeProgress) => void,
): Promise<RecognizeResult> {
  const img = await loadImage(imageUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const tiles = buildTileGrid(width, height, { overlap: 0.12 });

  const collected: SeatChartMarker[] = [];
  let done = 0;
  let failedTiles = 0;
  let lastError: string | null = null;

  const runTile = async (tile: ChartTile) => {
    try {
      const dataUrl = cropTile(img, tile);
      const { data, error } = await supabase.functions.invoke('parse-seat-chart-markers', {
        body: { imageBase64: dataUrl, mimeType: 'image/jpeg' },
      });
      if (error) throw error;
      const raw = sanitizeMarkers((data as { markers?: unknown })?.markers);
      for (const m of raw) {
        const mapped = tilePointToImage(tile, m.x, m.y, width, height);
        collected.push({ ...m, x: mapped.x, y: mapped.y });
      }
    } catch (err) {
      failedTiles += 1;
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      done += 1;
      onProgress?.({ done, total: tiles.length, found: collected.length });
    }
  };

  const queue = [...tiles];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const tile = queue.shift();
      if (!tile) break;
      await runTile(tile);
    }
  });
  await Promise.all(workers);

  const { markers, truncated } = applyMarkerLimit(dedupeMarkers(collected));
  return { markers, truncated, failedTiles, lastError };
}
