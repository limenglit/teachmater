/**
 * Seat-chart markers: named positions recognized on an uploaded seating-chart
 * picture, stored in `seat_checkin_sessions.scene_config.seatChartMarkers`.
 *
 * Coordinates are normalized (0–1) against the picture so the student view can
 * overlay them at any zoom level or screen size.
 */

export interface SeatChartMarker {
  name: string;
  /** Normalized 0–1 center of the name cell. */
  x: number;
  y: number;
  /** Optional row number read off the chart (1-based). */
  row?: number;
  /** Optional seat number read off the chart. */
  seatNo?: number;
  /** Optional zone label, e.g. "A区". */
  zone?: string;
  /**
   * Internal: index of the recognition tile this marker came from. Used to
   * merge duplicates produced by overlapping tiles; stripped before saving.
   */
  tile?: number;
}

/** Hard cap so `scene_config` stays a reasonable size. */
export const MAX_SEAT_CHART_MARKERS = 2000;

/** Same tile, same name, this close → the model listed the person twice. */
const DUPLICATE_DISTANCE = 0.02;
/**
 * Different tiles: the same person sits in the overlap band and is reported by
 * both requests, with a larger coordinate error because each tile normalizes
 * against its own crop. Merge much more generously in that case.
 */
const CROSS_TILE_DISTANCE = 0.07;

export function normalizeMarkerName(value: string): string {
  return String(value ?? '')
    .replace(/[\u3000\s]+/g, '')
    .trim();
}


function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Sanitize an arbitrary (AI or persisted) payload into valid markers.
 * Drops entries without a usable name or coordinates.
 */
export function sanitizeMarkers(input: unknown): SeatChartMarker[] {
  if (!Array.isArray(input)) return [];
  const out: SeatChartMarker[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const name = normalizeMarkerName(String(item.name ?? ''));
    if (!name) continue;
    const x = Number(item.x);
    const y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const marker: SeatChartMarker = { name, x: clamp01(x), y: clamp01(y) };
    const row = Number(item.row);
    if (Number.isFinite(row) && row > 0) marker.row = Math.floor(row);
    const seatNo = Number(item.seatNo);
    if (Number.isFinite(seatNo) && seatNo > 0) marker.seatNo = Math.floor(seatNo);
    const zone = typeof item.zone === 'string' ? item.zone.trim() : '';
    if (zone) marker.zone = zone.slice(0, 20);
    const tile = Number(item.tile);
    if (Number.isFinite(tile) && tile >= 0) marker.tile = Math.floor(tile);
    out.push(marker);
  }
  return out;
}

/**
 * Merge markers coming from overlapping tiles: the same name close enough to an
 * already-kept marker collapses into one entry (first wins, extra metadata
 * merged). Markers reported by two different tiles get a much larger merge
 * radius, because that is exactly the overlap-band double-count that made the
 * recognized head count come out too high.
 */
export function dedupeMarkers(markers: SeatChartMarker[]): SeatChartMarker[] {
  const kept: SeatChartMarker[] = [];
  const byName = new Map<string, SeatChartMarker[]>();
  for (const m of markers) {
    const bucket = byName.get(m.name);
    if (bucket) {
      const near = bucket.find((k) => {
        const limit = k.tile !== undefined && m.tile !== undefined && k.tile !== m.tile
          ? CROSS_TILE_DISTANCE
          : DUPLICATE_DISTANCE;
        return Math.hypot(k.x - m.x, k.y - m.y) <= limit;
      });
      if (near) {
        if (near.row === undefined && m.row !== undefined) near.row = m.row;
        if (near.seatNo === undefined && m.seatNo !== undefined) near.seatNo = m.seatNo;
        if (!near.zone && m.zone) near.zone = m.zone;
        continue;
      }
      bucket.push(m);
    } else {
      byName.set(m.name, [m]);
    }
    kept.push(m);
  }
  return kept;
}

/** Drop the internal tile tag before persisting into `scene_config`. */
export function stripMarkerInternals(markers: SeatChartMarker[]): SeatChartMarker[] {
  return markers.map(({ tile: _tile, ...rest }) => rest);
}

export interface DuplicateNameGroup {
  name: string;
  /** Indexes into the marker array, in order. */
  indexes: number[];
}

/**
 * Names that still appear more than once after merging. Either genuinely two
 * people with the same name, or a leftover mis-read — the teacher decides.
 */
export function findDuplicateNameGroups(markers: SeatChartMarker[]): DuplicateNameGroup[] {
  const byName = new Map<string, number[]>();
  markers.forEach((m, i) => {
    const list = byName.get(m.name);
    if (list) list.push(i);
    else byName.set(m.name, [i]);
  });
  const groups: DuplicateNameGroup[] = [];
  for (const [name, indexes] of byName) {
    if (indexes.length > 1) groups.push({ name, indexes });
  }
  return groups.sort((a, b) => b.indexes.length - a.indexes.length);
}

/** Keep only the first marker of every repeated name. */
export function keepFirstPerName(markers: SeatChartMarker[]): SeatChartMarker[] {
  const seen = new Set<string>();
  return markers.filter((m) => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });
}

export interface RosterDiff {
  /** Indexes of markers whose name is not in the roster (likely mis-read). */
  extraIndexes: number[];
  /** Roster names with no marker on the chart. */
  missingNames: string[];
  matchedCount: number;
}

/** Cross-check recognized names against the class roster, when one exists. */
export function diffAgainstRoster(
  markers: SeatChartMarker[],
  rosterNames: string[],
): RosterDiff {
  const roster = new Set(
    rosterNames.map((n) => normalizeMarkerName(n)).filter(Boolean),
  );
  const extraIndexes: number[] = [];
  const found = new Set<string>();
  markers.forEach((m, i) => {
    if (roster.has(m.name)) found.add(m.name);
    else extraIndexes.push(i);
  });
  const missingNames = [...roster].filter((n) => !found.has(n));
  return { extraIndexes, missingNames, matchedCount: found.size };
}

export interface MarkerLimitResult {
  markers: SeatChartMarker[];
  truncated: number;
}

export function applyMarkerLimit(
  markers: SeatChartMarker[],
  limit = MAX_SEAT_CHART_MARKERS,
): MarkerLimitResult {
  if (markers.length <= limit) return { markers, truncated: 0 };
  return { markers: markers.slice(0, limit), truncated: markers.length - limit };
}

/** Full pipeline used both by the recognition flow and when reading stored config. */
export function prepareMarkers(input: unknown, limit = MAX_SEAT_CHART_MARKERS): MarkerLimitResult {
  return applyMarkerLimit(dedupeMarkers(sanitizeMarkers(input)), limit);
}


/**
 * Find a person's marker. Exact (whitespace-insensitive) match first; when the
 * chart holds several people with that exact name, the first one is used and
 * the caller can show an "多个同名" hint via `findAllMarkersByName`.
 */
export function findMarkerByName(
  markers: SeatChartMarker[],
  name: string,
): SeatChartMarker | null {
  const target = normalizeMarkerName(name);
  if (!target) return null;
  return markers.find((m) => m.name === target) ?? null;
}

export function findAllMarkersByName(
  markers: SeatChartMarker[],
  name: string,
): SeatChartMarker[] {
  const target = normalizeMarkerName(name);
  if (!target) return [];
  return markers.filter((m) => m.name === target);
}

/** Human-readable position hint, e.g. 「第 3 排 · 7 号 · A区」. */
export function describeMarker(marker: SeatChartMarker | null): string | null {
  if (!marker) return null;
  const parts: string[] = [];
  if (marker.zone) parts.push(marker.zone);
  if (marker.row !== undefined) parts.push(`第 ${marker.row} 排`);
  if (marker.seatNo !== undefined) parts.push(`${marker.seatNo} 号`);
  return parts.length ? parts.join(' · ') : null;
}

/** Unique, sorted name pool for the "找朋友" search box. */
export function markerNamePool(markers: SeatChartMarker[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const m of markers) {
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    list.push(m.name);
  }
  return list.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}
