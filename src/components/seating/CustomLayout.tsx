import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SeatCell } from './SeatCell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Shuffle, RotateCcw, DoorOpen, Presentation, Wind, Save, QrCode, Trash2, Pencil, Undo2, Redo2, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import SeatLayoutPreviewDialog, { type ParsedLayout } from './SeatLayoutPreviewDialog';
import { useSeatExportQr } from './useSeatExportQr';
import { buildOrganizationColorResolver } from '@/lib/org-color';
import { buildTitleScorer, loadTitleRankRuleText, saveTitleRankRuleText } from '@/lib/title-rank';
import TitleRankConfigDialog from './TitleRankConfigDialog';
import {
  loadCustomLayoutSnapshot,
  saveCustomLayoutSnapshot,
  loadCustomLayoutHistory,
  saveCustomLayoutHistory,
  deleteSeatHistoryLocal,
  renameSeatHistoryLocal,
  type CustomLayoutSnapshot,
  type CustomLayoutHistoryItem,
} from '@/lib/teamwork-local';
import {
  saveCloudSeatHistory,
  fetchCloudSeatHistory,
  migrateLocalToCloudOnce,
  deleteCloudSeatHistory,
  renameCloudSeatHistory,
} from '@/lib/seat-history-cloud';
import { snapState, pushUndo as pushUndoLib, popUndo, popRedo, type BulkSnap } from '@/lib/bulk-undo';
import { computeSegments, alignRow, placementCols, type SeatAlignment } from '@/lib/seat-alignment';

interface Student { id: string; name: string; organization?: string; gender?: string; title?: string }
interface Props { students: Student[] }

type Side = 'top' | 'bottom' | 'left' | 'right';
type WinSide = 'left' | 'right';
type Strategy = 'sequential' | 'random' | 'byOrg' | 'byTitle' | 'byOrgTitle';
interface DoorDef { id: string; label: string; side: Side }

const MAX_COLS_PER_ROW = 30;
const MAX_ROWS = 30;

export default function CustomLayout({ students }: Props) {
  const { t } = useLanguage();

  const [rowCols, setRowCols] = useState<number[]>([6, 6, 8, 8, 8]);
  const [rowAisles, setRowAisles] = useState<number[]>([1]);
  const [colAisles, setColAisles] = useState<number[]>([]);
  const [aisleGap, setAisleGap] = useState<number>(16);
  const [doors, setDoors] = useState<DoorDef[]>([{ id: 'front', label: t('seat.nav.frontDoor') || '前门', side: 'top' }]);
  const [podiumSide, setPodiumSide] = useState<Side | 'none'>('top');
  const [windowSide, setWindowSide] = useState<WinSide>('left');
  const [strategy, setStrategy] = useState<Strategy>('sequential');
  const [seats, setSeats] = useState<(string | null)[][]>([]);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [flashRow, setFlashRow] = useState<{ index: number; mode: 'enable' | 'disable' } | null>(null);
  const [flashCol, setFlashCol] = useState<{ index: number; mode: 'enable' | 'disable' } | null>(null);
  const [recordName, setRecordName] = useState('');
  const [historyItems, setHistoryItems] = useState<CustomLayoutHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [showOrgColorMark, setShowOrgColorMark] = useState(true);
  const [titleRankRuleText, setTitleRankRuleText] = useState(() => loadTitleRankRuleText('customLayout'));
  /** Per-segment alignment. Key `${row}-${segIdx}` → alignment. */
  const [rowSegAlign, setRowSegAlign] = useState<Record<string, SeatAlignment>>({});
  /** Performance mode: when on, disables hover highlights and per-cell
   *  drop-target ring updates so dragging across a wide grid produces zero
   *  re-renders of seat cells. Persisted across reloads. */
  const [perfMode, setPerfMode] = useState<boolean>(() => {
    try { return localStorage.getItem('seat.custom.perfMode') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('seat.custom.perfMode', perfMode ? '1' : '0'); } catch { /* ignore */ }
  }, [perfMode]);

  /** Undo/redo stack for bulk row/col disable operations. Snapshots { disabled, seats }
   *  which matches exactly the subset of `CustomLayoutSnapshot` (`disabledSeats` + `seats`)
   *  that gets exported to history, keeping undo/redo state consistent with exports. */
  const [undoStack, setUndoStack] = useState<BulkSnap[]>([]);
  const [redoStack, setRedoStack] = useState<BulkSnap[]>([]);
  const snapNow = (): BulkSnap => snapState(disabled, seats);
  const pushUndo = () => {
    setUndoStack(prev => pushUndoLib(prev, snapNow()));
    setRedoStack([]);
  };
  const applySnap = (s: BulkSnap) => {
    setDisabled(new Set(s.disabled));
    setSeats(s.seats.map(row => [...row]));
  };
  const undoBulk = () => {
    const res = popUndo(undoStack, redoStack, snapNow());
    if (!res) { toast.info(t('seat.custom.undoEmpty') || '没有可撤销的批量操作'); return; }
    setUndoStack(res.undoStack);
    setRedoStack(res.redoStack);
    applySnap(res.restored);
    toast.success(t('seat.custom.undoDone') || '已撤销批量操作');
  };
  const redoBulk = () => {
    const res = popRedo(undoStack, redoStack, snapNow());
    if (!res) { toast.info(t('seat.custom.redoEmpty') || '没有可重做的批量操作'); return; }
    setUndoStack(res.undoStack);
    setRedoStack(res.redoStack);
    applySnap(res.restored);
    toast.success(t('seat.custom.redoDone') || '已重做批量操作');
  };


  const seatKey = (r: number, c: number) => `${r}-${c}`;
  const dragFromRef = useRef<{ r: number; c: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ r: number; c: number } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const restoredOnceRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageParsing, setImageParsing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedLayout | null>(null);

  const applyParsedLayout = (parsed: any) => {
    if (!parsed || typeof parsed !== 'object') {
      toast.error(t('seat.custom.imageParseFailed') || '识别结果无效');
      return;
    }
    const rc: number[] = Array.isArray(parsed.rowCols) ? parsed.rowCols.map((n: any) => Math.max(1, Math.floor(Number(n) || 1))) : [];
    if (rc.length === 0) {
      toast.error(t('seat.custom.imageParseFailed') || '识别结果无效');
      return;
    }
    const rawSeats: any[][] = Array.isArray(parsed.seats) ? parsed.seats : [];
    const newSeats: (string | null)[][] = rc.map((cols, r) => {
      const row = Array.isArray(rawSeats[r]) ? rawSeats[r] : [];
      return Array.from({ length: cols }, (_, c) => {
        const v = row[c];
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        return s || null;
      });
    });
    setRowCols(rc);
    setSeats(newSeats);
    setRowAisles(Array.isArray(parsed.rowAisles) ? parsed.rowAisles.filter((n: any) => Number.isInteger(n)) : []);
    setColAisles(Array.isArray(parsed.colAisles) ? parsed.colAisles.filter((n: any) => Number.isInteger(n)) : []);
    setDisabled(new Set());
    const podium = parsed.podiumSide;
    if (['top', 'bottom', 'left', 'right', 'none'].includes(podium)) setPodiumSide(podium);
    const win = parsed.windowSide;
    if (win === 'left' || win === 'right') setWindowSide(win);
    if (typeof parsed.title === 'string' && parsed.title.trim() && !recordName.trim()) setRecordName(parsed.title.trim());
    const filledCount = newSeats.flat().filter(v => typeof v === 'string' && v).length;
    toast.success((t('seat.custom.imageParsedOk') || '已根据图片生成布局') + `（${rc.length} 排 / ${filledCount} 个姓名）`);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('seat.custom.imageInvalid') || '请上传图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('seat.custom.imageTooLarge') || '图片过大（最大 10MB）');
      return;
    }
    setImageParsing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('parse-seat-layout-image', {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      // Open preview dialog instead of applying immediately, so the teacher can
      // tweak rows/cols/aisles/seat names before committing.
      setPreviewData(data as ParsedLayout);
      setPreviewOpen(true);
    } catch (e: any) {
      console.error('parse-seat-layout-image error', e);
      toast.error((t('seat.custom.imageParseFailed') || '图片识别失败') + (e?.message ? `: ${e.message}` : ''));
    } finally {
      setImageParsing(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const totalSeats = useMemo(
    () => rowCols.reduce((s, n, r) => s + n - Array.from({ length: n }, (_, c) => disabled.has(seatKey(r, c)) ? 1 : 0).reduce((a, b) => a + b, 0), 0),
    [rowCols, disabled]
  );
  const maxCols = useMemo(() => Math.max(0, ...rowCols), [rowCols]);

  const scoreTitle = useMemo(() => buildTitleScorer(titleRankRuleText), [titleRankRuleText]);

  const orgByName = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach(s => { const org = s.organization?.trim(); if (org) map.set(s.name, org); });
    return map;
  }, [students]);
  const resolveOrgColor = useMemo(() => buildOrganizationColorResolver(Array.from(orgByName.values())), [orgByName]);
  const getNameColor = useCallback((name: string) => {
    if (!showOrgColorMark) return undefined;
    const org = orgByName.get(name);
    return org ? resolveOrgColor(org) : undefined;
  }, [showOrgColorMark, orgByName, resolveOrgColor]);

  const setRowColCount = (r: number, raw: string) => {
    const n = Math.max(1, Math.floor(Number(raw) || 1));
    setRowCols(prev => prev.map((v, i) => (i === r ? n : v)));
    setSeats(prev => {
      const next = prev.map(row => [...row]);
      if (next[r]) {
        if (next[r].length > n) next[r] = next[r].slice(0, n);
        else while (next[r].length < n) next[r].push(null);
      }
      return next;
    });
  };

  const addRow = () => { if (rowCols.length < MAX_ROWS) setRowCols(prev => [...prev, prev[prev.length - 1] ?? 6]); };
  const removeRow = (r: number) => {
    if (rowCols.length <= 1) return;
    setRowCols(prev => prev.filter((_, i) => i !== r));
    setSeats(prev => prev.filter((_, i) => i !== r));
    setRowAisles(prev => prev.filter(a => a !== r).map(a => (a > r ? a - 1 : a)));
    setDisabled(prev => {
      const next = new Set<string>();
      prev.forEach(k => {
        const [rs, cs] = k.split('-');
        const rr = Number(rs);
        if (rr === r) return;
        next.add(rr > r ? `${rr - 1}-${cs}` : k);
      });
      return next;
    });
  };

  const toggleRowAisle = (afterRow: number) =>
    setRowAisles(prev => (prev.includes(afterRow) ? prev.filter(a => a !== afterRow) : [...prev, afterRow].sort((a, b) => a - b)));
  const toggleColAisle = (afterCol: number) =>
    setColAisles(prev => (prev.includes(afterCol) ? prev.filter(a => a !== afterCol) : [...prev, afterCol].sort((a, b) => a - b)));

  const toggleDisabled = useCallback((r: number, c: number) => {
    setDisabled(prev => {
      const next = new Set(prev);
      const k = `${r}-${c}`;
      if (next.has(k)) next.delete(k);
      else {
        next.add(k);
        setSeats(s => {
          const g = s.map(row => [...row]);
          if (g[r]) g[r][c] = null;
          return g;
        });
      }
      return next;
    });
  }, []);

  /**
   * Refill previously-cleared seats when re-enabling a row/col.
   * Uses current strategy order; only fills names not already placed on the grid.
   * Returns { filled, remaining } where remaining = re-enabled seats left empty due to no candidates.
   */
  const refillSeats = (
    targets: Array<[number, number]>,
    baseSeats: (string | null)[][]
  ): { grid: (string | null)[][]; filled: number; remaining: number } => {
    const grid = baseSeats.map(row => [...row]);
    const placed = new Set<string>();
    grid.forEach(row => row.forEach(n => { if (n) placed.add(n); }));
    const pool = orderedNames(false).filter(n => !placed.has(n));
    let i = 0;
    let filled = 0;
    for (const [r, c] of targets) {
      if (!grid[r]) continue;
      if (grid[r][c]) continue; // safety: don't overwrite
      if (i >= pool.length) break;
      grid[r][c] = pool[i++];
      filled++;
    }
    return { grid, filled, remaining: targets.length - filled };
  };

  /** Shift+click on a row label: toggle the whole row's disabled state. */
  const toggleRowDisabled = (r: number) => {
    const count = rowCols[r] || 0;
    if (count <= 0) return;
    pushUndo();
    const allDisabled = Array.from({ length: count }, (_, c) => disabled.has(seatKey(r, c))).every(Boolean);
    setDisabled(prev => {
      const next = new Set(prev);
      for (let c = 0; c < count; c++) {
        const k = seatKey(r, c);
        if (allDisabled) next.delete(k);
        else next.add(k);
      }
      return next;
    });
    let refilled = 0;
    if (!allDisabled) {
      // Disable path: clear all names in the row.
      setSeats(s => {
        const g = s.map(row => [...row]);
        if (g[r]) for (let c = 0; c < count; c++) g[r][c] = null;
        return g;
      });
    } else {
      // Enable path: refill cleared seats from unassigned pool for consistency.
      setSeats(s => {
        const targets: Array<[number, number]> = [];
        for (let c = 0; c < count; c++) if (!s[r]?.[c]) targets.push([r, c]);
        const { grid, filled } = refillSeats(targets, s);
        refilled = filled;
        return grid;
      });
    }
    const mode = allDisabled ? 'enable' : 'disable';
    setFlashRow({ index: r, mode });
    setTimeout(() => setFlashRow(null), 1200);
    if (allDisabled) {
      const base = t('seat.custom.rowEnabledDetail')?.replace('{0}', String(r + 1)).replace('{1}', String(count)) || `第 ${r + 1} 行已开放，恢复 ${count} 个座位`;
      toast.success(refilled > 0 ? `${base}（回填 ${refilled} 人）` : base);
    } else {
      toast.success(t('seat.custom.rowDisabledDetail')?.replace('{0}', String(r + 1)).replace('{1}', String(count)) || `第 ${r + 1} 行已关闭，关闭 ${count} 个座位`);
    }
  };

  /** Shift+click on a column label: toggle the whole column's disabled state. */
  const toggleColDisabled = (c: number) => {
    const keys: Array<[number, number]> = [];
    for (let r = 0; r < rowCols.length; r++) if (c < (rowCols[r] || 0)) keys.push([r, c]);
    if (keys.length === 0) return;
    pushUndo();
    const allDisabled = keys.every(([r, cc]) => disabled.has(seatKey(r, cc)));
    setDisabled(prev => {
      const next = new Set(prev);
      keys.forEach(([r, cc]) => {
        const k = seatKey(r, cc);
        if (allDisabled) next.delete(k);
        else next.add(k);
      });
      return next;
    });
    let refilled = 0;
    if (!allDisabled) {
      setSeats(s => {
        const g = s.map(row => [...row]);
        keys.forEach(([r, cc]) => { if (g[r]) g[r][cc] = null; });
        return g;
      });
    } else {
      setSeats(s => {
        const targets = keys.filter(([r, cc]) => !s[r]?.[cc]);
        const { grid, filled } = refillSeats(targets, s);
        refilled = filled;
        return grid;
      });
    }
    const mode = allDisabled ? 'enable' : 'disable';
    setFlashCol({ index: c, mode });
    setTimeout(() => setFlashCol(null), 1200);
    if (allDisabled) {
      const base = t('seat.custom.colEnabledDetail')?.replace('{0}', String(c + 1)).replace('{1}', String(keys.length)) || `第 ${c + 1} 列已开放，恢复 ${keys.length} 个座位`;
      toast.success(refilled > 0 ? `${base}（回填 ${refilled} 人）` : base);
    } else {
      toast.success(t('seat.custom.colDisabledDetail')?.replace('{0}', String(c + 1)).replace('{1}', String(keys.length)) || `第 ${c + 1} 列已关闭，关闭 ${keys.length} 个座位`);
    }
  };

  /* -------- alignment (irregular venues, per column-aisle segment) -------- */
  const segments = useMemo(() => computeSegments(colAisles, maxCols), [colAisles, maxCols]);
  const alignKey = (r: number, segIdx: number) => `${r}-${segIdx}`;
  const getSegAlign = useCallback(
    (r: number, segIdx: number): SeatAlignment => rowSegAlign[alignKey(r, segIdx)] ?? 'left',
    [rowSegAlign],
  );

  /**
   * Re-align one row using its current per-segment alignment. Called after any
   * alignment change so the visible layout matches the config immediately.
   */
  const applyRowAlignment = (
    r: number,
    overrideAlign?: Record<string, SeatAlignment>,
  ) => {
    const source = overrideAlign ?? rowSegAlign;
    const perSeg = segments.map((_, i) => source[alignKey(r, i)] ?? 'left');
    setSeats(prev => {
      const rowLen = rowCols[r] || 0;
      const row = prev[r] ? [...prev[r]] : Array.from({ length: rowLen }, () => null);
      const { seatsRow, disabledAdd, disabledRemove } = alignRow({
        r, rowLength: rowLen, seatsRow: row, disabled, segments,
        segmentAlignments: perSeg,
      });
      if (disabledAdd.length || disabledRemove.length) {
        setDisabled(prevD => {
          const next = new Set(prevD);
          disabledAdd.forEach(k => next.add(k));
          disabledRemove.forEach(k => next.delete(k));
          return next;
        });
      }
      const nextGrid = prev.map(rr => [...rr]);
      nextGrid[r] = seatsRow.slice(0, rowLen);
      return nextGrid;
    });
  };

  /** Set alignment for one segment (or all segments in a row) then re-align. */
  const setAlignment = (r: number, segIdx: number | 'all', value: SeatAlignment) => {
    pushUndo();
    setRowSegAlign(prev => {
      const next = { ...prev };
      if (segIdx === 'all') {
        segments.forEach((_, i) => { next[alignKey(r, i)] = value; });
      } else {
        next[alignKey(r, segIdx)] = value;
      }
      // Defer applyRowAlignment to next tick so it sees the fresh map.
      queueMicrotask(() => applyRowAlignment(r, next));
      return next;
    });
  };

  /** Apply current alignment settings to every row (bulk button). */
  const applyAlignmentAll = () => {
    pushUndo();
    for (let r = 0; r < rowCols.length; r++) applyRowAlignment(r);
    toast.success(t('seat.custom.alignmentApplied') || '已应用对齐');
  };

  /**
   * Set the exact number of seats in one segment of one row. Preserves existing
   * named seats (in column order, up to `count`) and enables/disables cells to
   * match the row's current alignment for that segment.
   */
  const setSegmentSeatCount = (r: number, segIdx: number, rawCount: number) => {
    const seg = segments[segIdx];
    if (!seg) return;
    const rowLen = rowCols[r] || 0;
    const segCols: number[] = [];
    for (let c = seg.start; c < Math.min(seg.end, rowLen); c++) segCols.push(c);
    const width = segCols.length;
    if (width <= 0) return;
    const target = Math.max(0, Math.min(width, Math.floor(rawCount) || 0));
    const alignment = getSegAlign(r, segIdx);
    const enabledCols = placementCols(segCols, target, alignment);
    const enabledSet = new Set(enabledCols);
    const currentNames = segCols
      .filter(c => !disabled.has(seatKey(r, c)) && seats[r]?.[c])
      .map(c => seats[r]![c] as string)
      .slice(0, target);
    pushUndo();
    setSeats(prev => {
      const g = prev.map(row => [...row]);
      if (!g[r]) return g;
      for (const c of segCols) g[r][c] = null;
      enabledCols.forEach((c, i) => { g[r][c] = currentNames[i] ?? null; });
      return g;
    });
    setDisabled(prev => {
      const next = new Set(prev);
      for (const c of segCols) {
        const k = seatKey(r, c);
        if (enabledSet.has(c)) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  /** Count currently-enabled (not disabled) cells within a segment of a row. */
  const getSegmentEnabledCount = (r: number, segIdx: number): number => {
    const seg = segments[segIdx];
    if (!seg) return 0;
    const rowLen = rowCols[r] || 0;
    let n = 0;
    for (let c = seg.start; c < Math.min(seg.end, rowLen); c++) {
      if (!disabled.has(seatKey(r, c))) n++;
    }
    return n;
  };

  /**
   * Built-in preset: irregular 3-block conference hall, 10 rows, with 4 column
   * aisles (2 walls + 2 middle double-column aisles). Segment widths 11/19/11
   * (max row = 41 cols). Each row's per-segment seat counts differ; all
   * segments start centered so unused edge cells are disabled visually.
   */
  const IRREGULAR_HALL_PRESET = {
    rowSegCounts: [
      [10, 8, 10], [10, 12, 10], [11, 13, 11], [11, 14, 11], [11, 15, 11],
      [11, 16, 11], [11, 17, 11], [11, 18, 11], [11, 19, 11], [11, 19, 11],
    ],
    segWidths: [11, 19, 11],
  } as const;

  const applyIrregularHallPreset = () => {
    const { rowSegCounts, segWidths } = IRREGULAR_HALL_PRESET;
    const totalCols = segWidths.reduce((a, b) => a + b, 0);
    const newColAisles = [segWidths[0] - 1, segWidths[0] + segWidths[1] - 1];
    const newRowCols = rowSegCounts.map(() => totalCols);
    const newSeats: (string | null)[][] = rowSegCounts.map(() =>
      Array.from({ length: totalCols }, () => null),
    );
    const newDisabled = new Set<string>();
    const newSegAlign: Record<string, SeatAlignment> = {};
    rowSegCounts.forEach((counts, r) => {
      let colOffset = 0;
      counts.forEach((n, si) => {
        const width = segWidths[si];
        const offset = Math.floor((width - n) / 2); // center
        for (let c = 0; c < width; c++) {
          if (c < offset || c >= offset + n) newDisabled.add(`${r}-${colOffset + c}`);
        }
        newSegAlign[`${r}-${si}`] = 'center';
        colOffset += width;
      });
    });
    pushUndo();
    setRowCols(newRowCols);
    setSeats(newSeats);
    setColAisles(newColAisles);
    setRowAisles([]);
    setDisabled(newDisabled);
    setRowSegAlign(newSegAlign);
    setPodiumSide('top');
    setWindowSide('left');
    toast.success(t('seat.custom.presetLoaded') || '已加载「三段异形会议厅」示例（10 行 · 41 列 · 4 列走道）');
  };




  const orderedNames = (shuffle: boolean): string[] => {
    if (shuffle || strategy === 'random') {
      return [...students.map(s => s.name)].sort(() => Math.random() - 0.5);
    }
    if (strategy === 'byOrg') {
      const grouped = new Map<string, string[]>();
      students.forEach(s => {
        const k = s.organization?.trim() || t('seat.editor.common.unassignedOrg') || '未指定';
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push(s.name);
      });
      // larger orgs first, keeps each contiguous
      return Array.from(grouped.values()).sort((a, b) => b.length - a.length).flat();
    }
    if (strategy === 'byTitle') {
      return [...students].sort((a, b) => scoreTitle(b.title) - scoreTitle(a.title)).map(s => s.name);
    }
    if (strategy === 'byOrgTitle') {
      const grouped = new Map<string, Student[]>();
      students.forEach(s => {
        const k = s.organization?.trim() || t('seat.editor.common.unassignedOrg') || '未指定';
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push(s);
      });
      // org buckets sorted by top-title score desc, then size desc; within bucket by title score desc
      return Array.from(grouped.values())
        .map(g => g.slice().sort((a, b) => scoreTitle(b.title) - scoreTitle(a.title)))
        .sort((a, b) => {
          const top = scoreTitle(b[0]?.title) - scoreTitle(a[0]?.title);
          if (top !== 0) return top;
          return b.length - a.length;
        })
        .flat()
        .map(s => s.name);
    }
    return students.map(s => s.name);
  };

  const autoSeat = (shuffle = false) => {
    const names = orderedNames(shuffle);
    const grid: (string | null)[][] = rowCols.map(n => Array.from({ length: n }, () => null));
    let idx = 0;
    for (let r = 0; r < rowCols.length && idx < names.length; r++) {
      for (let c = 0; c < rowCols[r] && idx < names.length; c++) {
        if (disabled.has(seatKey(r, c))) continue;
        grid[r][c] = names[idx++];
      }
    }
    setSeats(grid);
    if (idx < names.length) toast.warning(t('seat.custom.overflow') || `名单中有 ${names.length - idx} 人未能安排座位`);
    else toast.success(t('seat.custom.assigned') || '排座完成');
  };

  const clearSeats = () => setSeats(rowCols.map(n => Array.from({ length: n }, () => null)));

  /** Refs keep the drag handlers stable so memoized SeatCell children
   *  do not re-render when `seats` updates during/after a drop. */
  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  const perfModeRef = useRef(perfMode);
  perfModeRef.current = perfMode;

  const handleDragStart = useCallback((r: number, c: number) => {
    if (seatsRef.current[r]?.[c]) dragFromRef.current = { r, c };
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Performance mode: don't update dropTarget at all during drag → zero
    // seat-cell re-renders. The drop itself still works because handleDrop
    // reads dragFromRef + the (r,c) it's called with.
    if (perfModeRef.current) return;
    // Skip state churn when the pointer is still over the same cell.
    setDropTarget(prev => (prev?.r === r && prev?.c === c ? prev : { r, c }));
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    const from = dragFromRef.current;
    if (!from) return;
    setSeats(prev => {
      const next = prev.map(row => [...row]);
      const tmp = next[r]?.[c] ?? null;
      if (next[r]) next[r][c] = next[from.r][from.c];
      next[from.r][from.c] = tmp;
      return next;
    });
    dragFromRef.current = null;
    setDropTarget(null);
  }, []);
  const handleDragEnd = useCallback(() => {
    dragFromRef.current = null;
    setDropTarget(null);
  }, []);

  const addDoor = () => {
    const idx = doors.length + 1;
    setDoors(prev => [...prev, { id: `door-${Date.now()}`, label: `${t('seat.nav.entry') || '门'} ${idx}`, side: 'bottom' }]);
  };
  const removeDoor = (id: string) => setDoors(prev => prev.filter(d => d.id !== id));
  const updateDoor = (id: string, patch: Partial<DoorDef>) => setDoors(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));

  /* -------- snapshot + history (local + cloud) -------- */
  /**
   * Drop disabled-seat keys that fall outside the given row/col bounds.
   * Keeps persistence stable when the grid shrinks between sessions.
   */
  const sanitizeDisabledKeys = (keys: Iterable<string>, rc: number[]): string[] => {
    const out: string[] = [];
    for (const k of keys) {
      const [rs, cs] = String(k).split('-');
      const r = Number(rs); const c = Number(cs);
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
      if (r < 0 || r >= rc.length) continue;
      if (c < 0 || c >= (rc[r] || 0)) continue;
      out.push(`${r}-${c}`);
    }
    return Array.from(new Set(out));
  };

  /** Derive fully-disabled row / column indices from a disabled-keys set. */
  const deriveFullyDisabled = (set: Set<string>, rc: number[]) => {
    const rows: number[] = [];
    for (let r = 0; r < rc.length; r++) {
      const n = rc[r] || 0;
      if (n > 0 && Array.from({ length: n }, (_, c) => set.has(`${r}-${c}`)).every(Boolean)) rows.push(r);
    }
    const cols: number[] = [];
    const mc = Math.max(0, ...rc);
    for (let c = 0; c < mc; c++) {
      const applicable: Array<[number, number]> = [];
      for (let r = 0; r < rc.length; r++) if (c < (rc[r] || 0)) applicable.push([r, c]);
      if (applicable.length > 0 && applicable.every(([r, cc]) => set.has(`${r}-${cc}`))) cols.push(c);
    }
    return { rows, cols };
  };

  /** Re-apply fully-disabled rows/cols on top of a disabled set (used during restore for consistency). */
  const applyFullyDisabled = (set: Set<string>, rc: number[], rows: number[] | undefined, cols: number[] | undefined) => {
    (rows || []).forEach(r => {
      const n = rc[r] || 0;
      for (let c = 0; c < n; c++) set.add(`${r}-${c}`);
    });
    (cols || []).forEach(c => {
      for (let r = 0; r < rc.length; r++) if (c < (rc[r] || 0)) set.add(`${r}-${c}`);
    });
  };

  const buildSnapshot = (): CustomLayoutSnapshot => {
    const sanitized = sanitizeDisabledKeys(disabled, rowCols);
    const set = new Set(sanitized);
    const { rows: disabledRows, cols: disabledCols } = deriveFullyDisabled(set, rowCols);
    return {
      rowCols, rowAisles, colAisles, aisleGap, doors, podiumSide, windowSide, strategy,
      seats, disabledSeats: sanitized, disabledRows, disabledCols,
      rowSegAlign,
      updatedAt: new Date().toISOString(),
    };
  };

  // restore last snapshot once
  useEffect(() => {
    if (restoredOnceRef.current) return;
    const snap = loadCustomLayoutSnapshot();
    if (snap && Array.isArray(snap.rowCols) && snap.rowCols.length > 0) {
      const validNames = new Set(students.map(s => s.name));
      const sanitized = (snap.seats || []).map(row => row.map(n => (n && validNames.has(n) ? n : null)));
      setRowCols(snap.rowCols);
      setRowAisles(snap.rowAisles || []);
      setColAisles(snap.colAisles || []);
      if (typeof snap.aisleGap === 'number') setAisleGap(Math.max(4, Math.min(48, snap.aisleGap)));
      setDoors(snap.doors?.length ? snap.doors : doors);
      setPodiumSide(snap.podiumSide || 'top');
      setWindowSide(snap.windowSide || 'left');
      setStrategy(snap.strategy || 'sequential');
      setSeats(sanitized);
      const restoredSet = new Set(sanitizeDisabledKeys(snap.disabledSeats || [], snap.rowCols));
      applyFullyDisabled(restoredSet, snap.rowCols, snap.disabledRows, snap.disabledCols);
      setDisabled(restoredSet);
      if (snap.rowSegAlign && typeof snap.rowSegAlign === 'object') setRowSegAlign({ ...snap.rowSegAlign });
    }
    restoredOnceRef.current = true;
  }, [students]);

  // persist snapshot when meaningful state changes
  useEffect(() => {
    if (!restoredOnceRef.current) return;
    saveCustomLayoutSnapshot(buildSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowCols, rowAisles, colAisles, aisleGap, doors, podiumSide, windowSide, strategy, seats, disabled, rowSegAlign]);

  // load history (local + cloud)
  useEffect(() => {
    setHistoryItems(loadCustomLayoutHistory());
    (async () => {
      await migrateLocalToCloudOnce('custom_layout');
      const cloud = await fetchCloudSeatHistory<CustomLayoutSnapshot>('custom_layout');
      if (cloud) setHistoryItems(cloud.map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt, snapshot: r.snapshot })));
    })();
  }, []);

  // Keyboard shortcuts for bulk undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoBulk(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redoBulk(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, seats, undoStack, redoStack]);

  const saveToHistory = async () => {
    const hasAny = seats.some(row => row.some(n => !!n));
    if (!hasAny) { toast.error(t('seat.editor.common.noSeatsToSave') || '尚未排座，无法保存'); return; }
    const name = recordName.trim() || `${t('seat.editor.scene.custom') || '自定义场景'}-${new Date().toLocaleString()}`;
    const item = saveCustomLayoutHistory(name, buildSnapshot());
    let saved: CustomLayoutHistoryItem = item;
    const cloud = await saveCloudSeatHistory('custom_layout', name, item.snapshot);
    if (cloud) saved = { id: cloud.id, name: cloud.name, createdAt: cloud.createdAt, snapshot: cloud.snapshot as CustomLayoutSnapshot };
    setHistoryItems(prev => [saved, ...prev].slice(0, 50));
    setSelectedHistoryId(saved.id);
    setRecordName(name);
    toast.success(cloud ? (t('seat.editor.common.savedHistoryCloud') || '已保存到云端') : (t('seat.editor.common.savedHistoryLocal') || '已保存到本地'));
  };

  const restoreFromHistory = () => {
    const item = historyItems.find(h => h.id === selectedHistoryId);
    if (!item) { toast.error(t('seat.editor.common.noHistorySelected') || '请选择记录'); return; }
    const snap = item.snapshot;
    const validNames = new Set(students.map(s => s.name));
    const sanitized = (snap.seats || []).map(row => row.map(n => (n && validNames.has(n) ? n : null)));
    setRowCols(snap.rowCols || [6]);
    setRowAisles(snap.rowAisles || []);
    setColAisles(snap.colAisles || []);
    if (typeof snap.aisleGap === 'number') setAisleGap(Math.max(4, Math.min(48, snap.aisleGap)));
    setDoors(snap.doors?.length ? snap.doors : doors);
    setPodiumSide(snap.podiumSide || 'top');
    setWindowSide(snap.windowSide || 'left');
    setStrategy(snap.strategy || 'sequential');
    setSeats(sanitized);
    const rc = snap.rowCols || [6];
    const restoredSet = new Set(sanitizeDisabledKeys(snap.disabledSeats || [], rc));
    applyFullyDisabled(restoredSet, rc, snap.disabledRows, snap.disabledCols);
    setDisabled(restoredSet);
    setRowSegAlign(snap.rowSegAlign && typeof snap.rowSegAlign === 'object' ? { ...snap.rowSegAlign } : {});
    setRecordName(item.name);
    toast.success(t('seat.editor.common.restoredHistory') || '记录已恢复');
  };

  /* -------- export + check-in QR -------- */
  const exportSceneConfig = useMemo(() => {
    const sanitized = sanitizeDisabledKeys(disabled, rowCols);
    const set = new Set(sanitized);
    const { rows: disabledRows, cols: disabledCols } = deriveFullyDisabled(set, rowCols);
    return {
      rows: rowCols.length,
      cols: maxCols,
      windowOnLeft: windowSide === 'left',
      colAisles,
      rowAisles,
      aisleGap,
      disabledSeats: sanitized,
      disabledRows,
      disabledCols,
      entryDoorMode: 'front' as const,
      frontDoorPosition: (doors[0]?.side || 'top') as Side,
      backDoorPosition: ((doors.find(d => d.id !== doors[0]?.id)?.side) || 'bottom') as Side,
      rowCols,
    };
  }, [rowCols, maxCols, windowSide, colAisles, rowAisles, aisleGap, disabled, doors]);

  const studentNames = useMemo(() => students.map(s => s.name), [students]);
  const seatAssignmentReady = seats.some(row => row.some(n => !!n));

  const { resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: seats,
    studentNames,
    seatAssignmentReady,
    sceneConfig: exportSceneConfig,
    sceneType: 'classroom',
  });

  /* -------- render seat row --------
   * Uses memoized <SeatCell> so dragging across a wide row only re-renders
   * the two cells whose dropTarget flag actually changed. */
  const rowLabel = t('seat.custom.row') || '行';
  const colLabel = t('seat.custom.col') || '列';
  const disabledLabel = t('seat.nav.disabledSeat') || '不可用';
  const renderRow = (r: number) => {
    const cellCount = rowCols[r];
    const cells: React.ReactNode[] = [];
    for (let c = 0; c < cellCount; c++) {
      const name = seats[r]?.[c] ?? null;
      const isDisabled = disabled.has(seatKey(r, c));
      const isDropTarget = dropTarget?.r === r && dropTarget?.c === c;
      const title = `${rowLabel} ${r + 1} · ${colLabel} ${c + 1}${isDisabled ? ' · ' + disabledLabel : ''}`;
      cells.push(
        <SeatCell
          key={`s-${r}-${c}`}
          r={r}
          c={c}
          name={name}
          isDisabled={isDisabled}
          isDropTarget={isDropTarget}
          color={name ? getNameColor(name) : undefined}
          title={title}
          disabledLabel={disabledLabel}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onShiftClick={toggleDisabled}
          perfMode={perfMode}
        />
      );
      if (colAisles.includes(c) && c < cellCount - 1) {
        cells.push(<div key={`v-${r}-${c}`} className="shrink-0" style={{ width: aisleGap }} aria-hidden />);
      }
    }
    const isRowFlashing = flashRow?.index === r;
    const rowFlashClass = isRowFlashing
      ? (flashRow?.mode === 'disable'
        ? 'text-destructive bg-destructive/15 ring-1 ring-destructive/30 rounded px-0.5'
        : 'text-primary bg-primary/15 ring-1 ring-primary/30 rounded px-0.5')
      : '';
    return (
      <div className="flex items-center justify-start gap-1.5 w-max">
        <span
          className={`text-[10px] text-muted-foreground w-6 text-right cursor-pointer hover:text-primary select-none ${rowFlashClass}`}
          onClick={(e) => { if (e.shiftKey) toggleRowDisabled(r); }}
          title={t('seat.custom.toggleRowDisabled') || 'Shift+点击 关闭/开放整行'}
        >
          {r + 1}
        </span>
        <div className="flex items-center gap-1.5 flex-nowrap justify-start">{cells}</div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeRow(r)} title={t('seat.custom.removeRow') || '删除该行'}>
          <Minus className="w-3 h-3" />
        </Button>
      </div>
    );
  };

  /* -------- column header row (shift+click to toggle whole column) -------- */
  const renderColHeader = () => {
    if (maxCols <= 0) return null;
    const cells: React.ReactNode[] = [];
    for (let c = 0; c < maxCols; c++) {
      const isColFlashing = flashCol?.index === c;
      const colFlashClass = isColFlashing
        ? (flashCol?.mode === 'disable'
          ? 'text-destructive bg-destructive/15 ring-1 ring-destructive/30 rounded px-0.5'
          : 'text-primary bg-primary/15 ring-1 ring-primary/30 rounded px-0.5')
        : '';
      cells.push(
        <div
          key={`h-${c}`}
          className={`text-[10px] text-muted-foreground w-[60px] text-center cursor-pointer hover:text-primary select-none ${colFlashClass}`}
          onClick={(e) => { if (e.shiftKey) toggleColDisabled(c); }}
          title={t('seat.custom.toggleColDisabled') || 'Shift+点击 关闭/开放整列'}
        >
          {c + 1}
        </div>
      );
      if (colAisles.includes(c) && c < maxCols - 1) {
        cells.push(<div key={`hv-${c}`} className="shrink-0" style={{ width: aisleGap }} aria-hidden />);
      }
    }
    return (
      <div className="flex items-center justify-start gap-1.5 pb-1 w-max">
        <span className="w-6 shrink-0" aria-hidden />
        <div className="flex items-center gap-1.5 flex-nowrap justify-start">{cells}</div>
        <span className="w-6 shrink-0" aria-hidden />
      </div>
    );
  };

  const doorBadge = (side: Side) => (
    <div className="flex flex-wrap items-center justify-center gap-2 py-1">
      {doors.filter(d => d.side === side).map(d => (
        <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 text-primary px-2 py-0.5 text-[11px]">
          🚪 {d.label}
        </span>
      ))}
    </div>
  );

  const podiumBadge = (side: Side) => (
    podiumSide === side ? (
      <div className="flex justify-center py-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-accent/30 border border-accent-foreground/20 px-3 py-1 text-[11px] font-medium">
          <Presentation className="w-3 h-3" />{t('seat.nav.podium') || '讲台'}
        </span>
      </div>
    ) : null
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-xl border border-border bg-card/60 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => autoSeat(false)}>{t('seat.custom.autoSeat') || '一键排座'}</Button>
          <Button size="sm" variant="secondary" onClick={() => autoSeat(true)}><Shuffle className="w-3.5 h-3.5 mr-1" />{t('seat.custom.shuffle') || '随机'}</Button>
          <Button size="sm" variant="outline" onClick={clearSeats}><RotateCcw className="w-3.5 h-3.5 mr-1" />{t('seat.custom.clear') || '清空'}</Button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => imageInputRef.current?.click()}
            disabled={imageParsing}
            title={t('seat.custom.uploadImageHint') || '上传座位示意图，AI 自动生成布局与姓名'}
            className="gap-1.5"
          >
            {imageParsing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('seat.custom.uploadImageParsing') || '识别中...'}</>
              : <><Upload className="w-3.5 h-3.5" />{t('seat.custom.uploadImage') || '上传图片识别'}</>}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={undoBulk}
            disabled={undoStack.length === 0}
            title={t('seat.custom.undoBulk') || '撤销批量行/列开关 (Ctrl+Z)'}
          >
            <Undo2 className="w-3.5 h-3.5 mr-1" />{t('seat.custom.undo') || '撤销'}{undoStack.length > 0 ? ` (${undoStack.length})` : ''}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={redoBulk}
            disabled={redoStack.length === 0}
            title={t('seat.custom.redoBulk') || '重做批量行/列开关 (Ctrl+Shift+Z)'}
          >
            <Redo2 className="w-3.5 h-3.5 mr-1" />{t('seat.custom.redo') || '重做'}{redoStack.length > 0 ? ` (${redoStack.length})` : ''}
          </Button>

          <Button
            size="sm"
            variant={perfMode ? 'default' : 'outline'}
            onClick={() => setPerfMode(v => !v)}
            title={t('seat.custom.perfModeHint') || '性能模式：拖拽时关闭悬停高亮与即时反馈，适合大场地'}
          >
            ⚡ {t('seat.custom.perfMode') || '性能模式'}{perfMode ? ` · ${t('seat.custom.on') || '开'}` : ''}
          </Button>



          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t('seat.editor.common.mode') || '策略'}
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as Strategy)}
              className="h-7 text-xs px-2 rounded border border-input bg-background"
            >
              <option value="sequential">{t('seat.custom.stratSequential') || '顺序排座'}</option>
              <option value="random">{t('seat.custom.stratRandom') || '随机排座'}</option>
              <option value="byOrg">{t('seat.custom.stratByOrg') || '按单位集中'}</option>
              <option value="byTitle">{t('seat.custom.stratByTitle') || '按职务排序（前排优先）'}</option>
              <option value="byOrgTitle">{t('seat.custom.stratByOrgTitle') || '单位集中＋职务排序'}</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showOrgColorMark} onChange={(e) => setShowOrgColorMark(e.target.checked)} className="accent-primary" />
            {t('seat.editor.common.orgColor') || '单位上色'}
          </label>

          <TitleRankConfigDialog
            value={titleRankRuleText}
            sceneLabel={t('seat.editor.scene.custom') || '自定义场景'}
            onSave={(next) => { const saved = saveTitleRankRuleText(next, 'customLayout'); setTitleRankRuleText(saved); }}
          />

          <span className="text-xs text-muted-foreground ml-auto">
            {t('seat.custom.totalSeats') || '可用座位'}: <b>{totalSeats}</b> · {t('seat.custom.totalStudents') || '名单'}: <b>{students.length}</b>
          </span>
        </div>

        {/* Save / history / checkin / export */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
          <Input
            type="text"
            value={recordName}
            onChange={(e) => setRecordName(e.target.value)}
            placeholder={t('seat.editor.common.namePlaceholder') || '记录名称'}
            className="h-8 w-full sm:w-56 text-xs"
          />
          <Button size="sm" variant="outline" onClick={saveToHistory} disabled={!seatAssignmentReady} className="gap-1.5 h-8">
            <Save className="w-3.5 h-3.5" />{t('seat.editor.common.saveHistory') || '保存历史'}
          </Button>
          <select
            value={selectedHistoryId}
            onChange={(e) => setSelectedHistoryId(e.target.value)}
            className="h-8 text-xs px-2 rounded border border-input bg-background flex-1 sm:flex-none sm:min-w-[14rem] sm:max-w-72"
          >
            <option value="">{t('seat.editor.common.selectHistory') || '选择历史记录'}</option>
            {historyItems.map(item => (
              <option key={item.id} value={item.id}>{item.name}（{new Date(item.createdAt).toLocaleString()}）</option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={!selectedHistoryId} onClick={restoreFromHistory} className="gap-1.5 h-8">
            <RotateCcw className="w-3.5 h-3.5" />{t('seat.editor.common.restoreHistory') || '恢复'}
          </Button>
          <Button
            size="icon" variant="outline" className="h-8 w-8" disabled={!selectedHistoryId}
            title={t('seat.editor.common.renameTitle') || '重命名'}
            onClick={async () => {
              const id = selectedHistoryId;
              const current = historyItems.find(h => h.id === id);
              if (!id || !current) return;
              const next = window.prompt(t('seat.editor.common.renamePrompt') || '请输入新名称', current.name)?.trim();
              if (!next || next === current.name) return;
              await renameCloudSeatHistory(id, next);
              renameSeatHistoryLocal('custom_layout', id, next);
              setHistoryItems(prev => prev.map(h => (h.id === id ? { ...h, name: next } : h)));
              toast.success(t('seat.editor.common.renamed') || '已重命名');
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon" variant="outline" className="h-8 w-8 text-destructive hover:text-destructive" disabled={!selectedHistoryId}
            title={t('seat.editor.common.deleteTitle') || '删除'}
            onClick={async () => {
              const id = selectedHistoryId;
              if (!id) return;
              if (!window.confirm(t('seat.editor.common.deleteConfirm') || '确定删除？')) return;
              await deleteCloudSeatHistory(id);
              deleteSeatHistoryLocal('custom_layout', id);
              setHistoryItems(prev => prev.filter(h => h.id !== id));
              setSelectedHistoryId('');
              toast.success(t('seat.editor.common.deleted') || '已删除');
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>

          {seatAssignmentReady && (
            <>
              <ExportButtons
                targetRef={printRef}
                filename={recordName.trim() || (t('seat.editor.scene.custom') || '自定义座次表')}
                resolveQrCode={resolveQrCode}
                titleValue={recordName}
                onTitleChange={setRecordName}
                hideTitleInput
              />
              <Button size="sm" variant="outline" onClick={() => setCheckinOpen(true)} className="gap-1.5 h-8">
                <QrCode className="w-3.5 h-3.5" />{t('seat.editor.common.checkin') || '签到'}
              </Button>
            </>
          )}
        </div>

        {/* Preset scenes */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium text-foreground/80">
            {t('seat.custom.presetTitle') || '示例场景'}
          </span>
          <select
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'irregular3') applyIrregularHallPreset();
              e.currentTarget.value = '';
            }}
            className="h-7 text-xs px-2 rounded border border-input bg-background"
            title={t('seat.custom.presetPickHint') || '选择一个内置示例快速填充布局'}
          >
            <option value="">{t('seat.custom.presetPick') || '选择示例…'}</option>
            <option value="irregular3">
              {t('seat.custom.presetIrregular3') || '异形会议厅：三段（10/8/10 → 11/19/11 · 10 行 · 4 列走道）'}
            </option>
          </select>
          <span className="text-[11px] text-muted-foreground">
            {t('seat.custom.presetHint') || '加载后可继续调整每段座位数与对齐方式'}
          </span>
        </div>

        {/* Row config */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-foreground/80">{t('seat.custom.rowsConfig') || '各行列数（按行独立设置）'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {rowCols.map((n, r) => (
              <div key={`rc-${r}`} className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground w-10 shrink-0">{(t('seat.custom.row') || '第')}{r + 1}{(t('seat.custom.rowSuffix') || '行')}</Label>
                <Input type="number" min={1} value={n} onChange={(e) => setRowColCount(r, e.target.value)} className="h-7 text-xs px-2" />
                <button
                  type="button"
                  onClick={() => toggleRowAisle(r)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${rowAisles.includes(r) ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground'}`}
                  title={t('seat.custom.toggleRowAisle') || '在该行后添加横向走道'}
                >
                  {rowAisles.includes(r) ? '↧' : '↧?'}
                </button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={addRow} disabled={rowCols.length >= MAX_ROWS}>
            <Plus className="w-3.5 h-3.5 mr-1" />{t('seat.custom.addRow') || '添加行'}
          </Button>
        </div>

        {/* Aisles: vertical + horizontal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-foreground/80">{t('seat.custom.colAislesConfig')}</div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: Math.max(0, maxCols - 1) }, (_, i) => (
                <button
                  key={`ca-${i}`}
                  type="button"
                  onClick={() => toggleColAisle(i)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${colAisles.includes(i) ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                >
                  {i + 1}↦
                </button>
              ))}
              {maxCols <= 1 && <span className="text-[11px] text-muted-foreground/60">—</span>}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-foreground/80">{t('seat.custom.rowAislesConfig')}</div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: Math.max(0, rowCols.length - 1) }, (_, i) => (
                <button
                  key={`ra-${i}`}
                  type="button"
                  onClick={() => toggleRowAisle(i)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${rowAisles.includes(i) ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                  title={t('seat.custom.toggleRowAisle')}
                >
                  {i + 1}↧
                </button>
              ))}
              {rowCols.length <= 1 && <span className="text-[11px] text-muted-foreground/60">—</span>}
            </div>
          </div>
        </div>

        {/* Aisle gap width */}
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs font-medium text-foreground/80">
            {t('seat.custom.aisleGap') || '走道间距'}
          </Label>
          <input
            type="range"
            min={4}
            max={48}
            step={1}
            value={aisleGap}
            onChange={(e) => setAisleGap(Math.max(4, Math.min(48, Number(e.target.value) || 16)))}
            className="accent-primary w-40"
            aria-label={t('seat.custom.aisleGap') || '走道间距'}
          />
          <Input
            type="number"
            min={4}
            max={48}
            value={aisleGap}
            onChange={(e) => setAisleGap(Math.max(4, Math.min(48, Number(e.target.value) || 16)))}
            className="h-7 w-16 text-xs px-2"
          />
          <span className="text-[11px] text-muted-foreground">px</span>
        </div>

        {/* Row alignment (irregular venue: per row, per column-aisle segment) */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-medium text-foreground/80">
              {t('seat.custom.alignmentTitle') || '行/段对齐（异形会场：靠墙 / 靠走道）'}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {t('seat.custom.alignmentHint') || '按列走道自动分段；每段可独立选择左/右/居中/两端对齐；座位数量不变，仅调整位置'}
            </span>
            <Button size="sm" variant="outline" className="ml-auto h-7" onClick={applyAlignmentAll}>
              {t('seat.custom.applyAlignmentAll') || '重新应用全部对齐'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-56 overflow-auto pr-1">
            {rowCols.map((_, r) => {
              const segCount = segments.length;
              // Whole-row select shows current value only when all segments share it.
              const first = getSegAlign(r, 0);
              const uniform = segments.every((_, i) => getSegAlign(r, i) === first);
              return (
                <div key={`align-${r}`} className="flex items-center gap-1.5 flex-wrap border border-border/50 rounded px-1.5 py-1">
                  <span className="text-[11px] text-muted-foreground w-14 shrink-0">
                    {(t('seat.custom.row') || '第') + (r + 1) + (t('seat.custom.rowSuffix') || '行')}
                  </span>
                  <select
                    value={uniform ? first : 'mixed'}
                    onChange={(e) => {
                      const v = e.target.value as SeatAlignment | 'mixed';
                      if (v === 'mixed') return;
                      setAlignment(r, 'all', v);
                    }}
                    className="h-6 text-[11px] px-1 rounded border border-input bg-background"
                    title={t('seat.custom.alignmentWholeRow') || '整行对齐（应用到所有段）'}
                  >
                    <option value="left">{t('seat.custom.alignLeft') || '左对齐'}</option>
                    <option value="right">{t('seat.custom.alignRight') || '右对齐'}</option>
                    <option value="center">{t('seat.custom.alignCenter') || '居中'}</option>
                    <option value="justify">{t('seat.custom.alignJustify') || '两端对齐'}</option>
                    {!uniform && <option value="mixed">{t('seat.custom.alignMixed') || '分段混合…'}</option>}
                  </select>
                  {segCount > 1 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {segments.map((_, si) => (
                        <label key={`seg-${r}-${si}`} className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <span className="rounded bg-muted px-1">{`§${si + 1}`}</span>
                          <select
                            value={getSegAlign(r, si)}
                            onChange={(e) => setAlignment(r, si, e.target.value as SeatAlignment)}
                            className="h-5 text-[10px] px-0.5 rounded border border-input bg-background"
                            title={t('seat.custom.alignmentSegment') || '本段对齐'}
                          >
                            <option value="left">←</option>
                            <option value="center">↔</option>
                            <option value="right">→</option>
                            <option value="justify">⇔</option>
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>


        {/* Doors / podium / window */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <div className="text-xs font-medium flex items-center gap-1"><DoorOpen className="w-3.5 h-3.5" />{t('seat.custom.doors') || '门'}</div>
            <div className="space-y-1">
              {doors.map(d => (
                <div key={d.id} className="flex items-center gap-1.5">
                  <Input value={d.label} onChange={(e) => updateDoor(d.id, { label: e.target.value })} className="h-7 text-xs px-2 flex-1" />
                  <select
                    value={d.side}
                    onChange={(e) => updateDoor(d.id, { side: e.target.value as Side })}
                    className="h-7 text-xs px-1 rounded border border-input bg-background"
                  >
                    <option value="top">{t('seat.custom.sideTop') || '上'}</option>
                    <option value="bottom">{t('seat.custom.sideBottom') || '下'}</option>
                    <option value="left">{t('seat.custom.sideLeft') || '左'}</option>
                    <option value="right">{t('seat.custom.sideRight') || '右'}</option>
                  </select>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeDoor(d.id)}><Minus className="w-3 h-3" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addDoor}><Plus className="w-3.5 h-3.5 mr-1" />{t('seat.custom.addDoor') || '添加门'}</Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium flex items-center gap-1"><Presentation className="w-3.5 h-3.5" />{t('seat.custom.podium') || '讲台位置'}</div>
            <select value={podiumSide} onChange={(e) => setPodiumSide(e.target.value as any)} className="h-8 text-xs px-2 rounded border border-input bg-background w-full">
              <option value="none">{t('seat.custom.none') || '无'}</option>
              <option value="top">{t('seat.custom.sideTop') || '上'}</option>
              <option value="bottom">{t('seat.custom.sideBottom') || '下'}</option>
              <option value="left">{t('seat.custom.sideLeft') || '左'}</option>
              <option value="right">{t('seat.custom.sideRight') || '右'}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium flex items-center gap-1"><Wind className="w-3.5 h-3.5" />{t('seat.custom.window') || '窗户位置'}</div>
            <select value={windowSide} onChange={(e) => setWindowSide(e.target.value as WinSide)} className="h-8 text-xs px-2 rounded border border-input bg-background w-full">
              <option value="left">{t('seat.custom.sideLeft') || '左'}</option>
              <option value="right">{t('seat.custom.sideRight') || '右'}</option>
            </select>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {t('seat.custom.tips') || '提示：Shift+点击座位可关闭/开放单个座位；Shift+点击行号或列号可关闭/开放整行或整列；拖动姓名可互换座位；行/列走道按需开关。'}
        </p>
      </div>

      {/* Stage (exported area) */}
      <div ref={printRef} className="rounded-2xl border border-border bg-muted/10 p-3 overflow-auto max-h-[75vh]">
        {podiumBadge('top')}
        {doorBadge('top')}

        <div className="flex">
          <div className="flex flex-col items-center justify-center gap-2 pr-2 shrink-0">
            {windowSide === 'left' && <div className="text-[10px] text-muted-foreground -rotate-90 whitespace-nowrap">🪟 {t('seat.nav.window') || '窗'}</div>}
            {doors.filter(d => d.side === 'left').map(d => (
              <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 text-primary px-2 py-0.5 text-[10px]">🚪 {d.label}</span>
            ))}
            {podiumSide === 'left' && <span className="text-[10px] bg-accent/30 px-2 py-0.5 rounded">{t('seat.nav.podium') || '讲台'}</span>}
          </div>

          <div className="flex-1 min-w-0 overflow-x-auto">
            <div className="flex flex-col gap-1.5">
              {renderColHeader()}
              {rowCols.map((_, r) => (
                <div key={`row-wrap-${r}`}>
                  {renderRow(r)}
                  {rowAisles.includes(r) && r < rowCols.length - 1 && (
                    <div className="border-t border-dashed border-muted-foreground/30 relative" style={{ marginTop: aisleGap / 2, marginBottom: aisleGap / 2 }}>
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-muted px-1.5 text-[9px] text-muted-foreground rounded">
                        {t('seat.custom.aisle') || '走道'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 pl-2 shrink-0">
            {windowSide === 'right' && <div className="text-[10px] text-muted-foreground -rotate-90 whitespace-nowrap">🪟 {t('seat.nav.window') || '窗'}</div>}
            {doors.filter(d => d.side === 'right').map(d => (
              <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 text-primary px-2 py-0.5 text-[10px]">🚪 {d.label}</span>
            ))}
            {podiumSide === 'right' && <span className="text-[10px] bg-accent/30 px-2 py-0.5 rounded">{t('seat.nav.podium') || '讲台'}</span>}
          </div>
        </div>

        {doorBadge('bottom')}
        {podiumBadge('bottom')}
      </div>

      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={seats}
        studentNames={studentNames}
        seatAssignmentReady={seatAssignmentReady}
        sceneConfig={exportSceneConfig}
        sceneType="classroom"
        className={recordName.trim() || (t('seat.editor.scene.custom') || '自定义场景')}
        pngFileName={recordName.trim() || (t('seat.editor.scene.custom') || '自定义场景')}
        onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)}
      />

      <SeatLayoutPreviewDialog
        open={previewOpen}
        initial={previewData}
        onCancel={() => { setPreviewOpen(false); setPreviewData(null); }}
        onApply={(final) => {
          applyParsedLayout(final);
          setPreviewOpen(false);
          setPreviewData(null);
        }}
      />
    </div>
  );
}
