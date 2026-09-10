/**
 * Tiling helpers for AI seat-chart recognition.
 *
 * A conference seating chart can hold ~1000 names. Sending the whole picture to
 * a vision model in one request loses most of them, so the image is split into
 * overlapping tiles, each tile recognized separately, and the per-tile
 * normalized coordinates mapped back into whole-image normalized coordinates.
 *
 * All functions here are pure so they can be unit-tested without a canvas.
 */

export interface ChartTile {
  index: number;
  /** Source rect in image pixels. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface TileGridOptions {
  cols?: number;
  rows?: number;
  /** Fraction of a tile repeated on each side, 0–0.4. */
  overlap?: number;
}

/**
 * Pick a tile grid from the image aspect ratio: wide charts get more columns,
 * tall charts get more rows. Keeps each tile roughly square so a vision model
 * sees a comparable amount of text per request.
 */
export function suggestTileGrid(width: number, height: number): { cols: number; rows: number } {
  if (!(width > 0) || !(height > 0)) return { cols: 1, rows: 1 };
  const area = width * height;
  // Target ~1.2M px per tile; clamp the tile count to a sane range.
  const target = Math.max(1, Math.min(12, Math.round(area / 1_200_000)));
  const ratio = width / height;
  let cols = Math.max(1, Math.round(Math.sqrt(target * ratio)));
  let rows = Math.max(1, Math.round(target / cols));
  cols = Math.min(5, cols);
  rows = Math.min(5, rows);
  return { cols, rows };
}

export function buildTileGrid(width: number, height: number, options: TileGridOptions = {}): ChartTile[] {
  if (!(width > 0) || !(height > 0)) return [];
  const suggested = suggestTileGrid(width, height);
  const cols = Math.max(1, Math.floor(options.cols ?? suggested.cols));
  const rows = Math.max(1, Math.floor(options.rows ?? suggested.rows));
  const overlap = Math.min(0.4, Math.max(0, options.overlap ?? 0.1));

  const baseW = width / cols;
  const baseH = height / rows;
  const padX = baseW * overlap;
  const padY = baseH * overlap;

  const tiles: ChartTile[] = [];
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.max(0, c * baseW - padX);
      const y0 = Math.max(0, r * baseH - padY);
      const x1 = Math.min(width, (c + 1) * baseW + padX);
      const y1 = Math.min(height, (r + 1) * baseH + padY);
      tiles.push({ index: index++, sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0 });
    }
  }
  return tiles;
}

/**
 * Map a point expressed in tile-normalized coordinates (0–1 inside the tile)
 * to whole-image normalized coordinates (0–1 of the full picture).
 */
export function tilePointToImage(
  tile: ChartTile,
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return { x: 0, y: 0 };
  const px = tile.sx + clamp01(x) * tile.sw;
  const py = tile.sy + clamp01(y) * tile.sh;
  return { x: clamp01(px / imageWidth), y: clamp01(py / imageHeight) };
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
