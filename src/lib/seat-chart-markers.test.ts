import { describe, it, expect } from 'vitest';
import {
  sanitizeMarkers,
  dedupeMarkers,
  applyMarkerLimit,
  prepareMarkers,
  findMarkerByName,
  findAllMarkersByName,
  describeMarker,
  markerNamePool,
  normalizeMarkerName,
} from './seat-chart-markers';
import { buildTileGrid, suggestTileGrid, tilePointToImage } from './seat-chart-tiles';

describe('seat-chart-markers', () => {
  it('drops entries without a name or coordinates', () => {
    const out = sanitizeMarkers([
      { name: '张三', x: 0.1, y: 0.2 },
      { name: '  ', x: 0.5, y: 0.5 },
      { name: '李四' },
      { name: '王五', x: 'abc', y: 0.3 },
      null,
    ]);
    expect(out.map(m => m.name)).toEqual(['张三']);
  });

  it('clamps coordinates and keeps optional metadata', () => {
    const [m] = sanitizeMarkers([{ name: '张 三', x: 1.7, y: -3, row: 4.2, seatNo: 9, zone: ' A区 ' }]);
    expect(m).toEqual({ name: '张三', x: 1, y: 0, row: 4, seatNo: 9, zone: 'A区' });
  });

  it('merges duplicates from overlapping tiles and keeps distinct same-name people', () => {
    const merged = dedupeMarkers(sanitizeMarkers([
      { name: '张三', x: 0.200, y: 0.300 },
      { name: '张三', x: 0.205, y: 0.302, row: 3 },
      { name: '张三', x: 0.800, y: 0.700 },
    ]));
    expect(merged).toHaveLength(2);
    expect(merged[0].row).toBe(3);
  });

  it('applies the marker cap', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `人${i}`, x: i / 12, y: 0.5 }));
    const { markers, truncated } = applyMarkerLimit(sanitizeMarkers(many), 10);
    expect(markers).toHaveLength(10);
    expect(truncated).toBe(2);
  });

  it('finds a person ignoring whitespace, and reports same-name duplicates', () => {
    const { markers } = prepareMarkers([
      { name: '李 蒙', x: 0.4, y: 0.4, row: 2, seatNo: 5, zone: 'B区' },
      { name: '李蒙', x: 0.9, y: 0.9 },
    ]);
    expect(findMarkerByName(markers, ' 李蒙 ')?.row).toBe(2);
    expect(findAllMarkersByName(markers, '李蒙')).toHaveLength(2);
    expect(findMarkerByName(markers, '不存在')).toBeNull();
  });

  it('describes a marker position', () => {
    expect(describeMarker({ name: '李蒙', x: 0, y: 0, row: 2, seatNo: 5, zone: 'B区' }))
      .toBe('B区 · 第 2 排 · 5 号');
    expect(describeMarker({ name: '李蒙', x: 0, y: 0 })).toBeNull();
    expect(describeMarker(null)).toBeNull();
  });

  it('builds a unique sorted name pool', () => {
    const pool = markerNamePool(sanitizeMarkers([
      { name: '王五', x: 0.1, y: 0.1 },
      { name: '李四', x: 0.2, y: 0.2 },
      { name: '李四', x: 0.9, y: 0.9 },
    ]));
    expect(pool).toHaveLength(2);
    expect(pool).toContain('李四');
  });

  it('normalizes full-width spaces', () => {
    expect(normalizeMarkerName('张\u3000三 ')).toBe('张三');
  });
});

describe('seat-chart-tiles', () => {
  it('suggests a grid biased by aspect ratio', () => {
    const wide = suggestTileGrid(4000, 1200);
    expect(wide.cols).toBeGreaterThanOrEqual(wide.rows);
    expect(suggestTileGrid(0, 0)).toEqual({ cols: 1, rows: 1 });
  });

  it('builds overlapping tiles that stay inside the image', () => {
    const tiles = buildTileGrid(1000, 800, { cols: 2, rows: 2, overlap: 0.1 });
    expect(tiles).toHaveLength(4);
    for (const t of tiles) {
      expect(t.sx).toBeGreaterThanOrEqual(0);
      expect(t.sy).toBeGreaterThanOrEqual(0);
      expect(t.sx + t.sw).toBeLessThanOrEqual(1000 + 1e-6);
      expect(t.sy + t.sh).toBeLessThanOrEqual(800 + 1e-6);
    }
    // overlap widens interior tiles beyond the base cell
    expect(tiles[0].sw).toBeGreaterThan(500);
  });

  it('maps tile-local coordinates back into whole-image coordinates', () => {
    const tiles = buildTileGrid(1000, 800, { cols: 2, rows: 1, overlap: 0 });
    const p = tilePointToImage(tiles[1], 0.5, 0.5, 1000, 800);
    expect(p.x).toBeCloseTo(0.75, 5);
    expect(p.y).toBeCloseTo(0.5, 5);
  });
});
