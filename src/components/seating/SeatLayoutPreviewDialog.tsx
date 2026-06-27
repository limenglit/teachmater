import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Trash2, RotateCcw, AlignLeft, AlignCenter, AlignRight, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type Side = 'top' | 'bottom' | 'left' | 'right' | 'none';

export interface ParsedLayout {
  rowCols: number[];
  rowAisles?: number[];
  colAisles?: number[];
  seats?: (string | null)[][];
  podiumSide?: Side;
  windowSide?: 'left' | 'right';
  title?: string;
}

interface Props {
  open: boolean;
  initial: ParsedLayout | null;
  onCancel: () => void;
  onApply: (final: ParsedLayout) => void;
}

/**
 * Preview & edit dialog for AI-parsed seat layouts.
 * Lets the teacher tweak row/col counts, aisle positions, podium side, and seat names
 * (click to rename, drag to swap, × to clear, +/− to grow/shrink rows) before
 * committing the result back to the parent CustomLayout state.
 */
export default function SeatLayoutPreviewDialog({ open, initial, onCancel, onApply }: Props) {
  const { t } = useLanguage();

  const [rowCols, setRowCols] = useState<number[]>([]);
  const [rowAisles, setRowAisles] = useState<number[]>([]);
  const [colAisles, setColAisles] = useState<number[]>([]);
  const [seats, setSeats] = useState<(string | null)[][]>([]);
  const [podiumSide, setPodiumSide] = useState<Side>('top');
  const [windowSide, setWindowSide] = useState<'left' | 'right'>('left');

  // View helpers: zoom level (0.5 – 1.6), row alignment (left/center/right)
  const [zoom, setZoom] = useState(1);
  const [rowAlign, setRowAlign] = useState<'left' | 'center' | 'right'>('center');

  const dragFromRef = useRef<{ r: number; c: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ r: number; c: number } | null>(null);

  // re-initialize draft each time a new parsed payload is loaded
  useEffect(() => {
    if (!open || !initial) return;
    const rc = (initial.rowCols || []).map(n => Math.max(1, Math.floor(Number(n) || 1)));
    const rawSeats = initial.seats || [];
    const grid: (string | null)[][] = rc.map((cols, r) => {
      const row = Array.isArray(rawSeats[r]) ? rawSeats[r] : [];
      return Array.from({ length: cols }, (_, c) => {
        const v = row[c];
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        return s || null;
      });
    });
    setRowCols(rc);
    setSeats(grid);
    setRowAisles((initial.rowAisles || []).filter(n => Number.isInteger(n)));
    setColAisles((initial.colAisles || []).filter(n => Number.isInteger(n)));
    const ps = initial.podiumSide;
    setPodiumSide(ps && ['top', 'bottom', 'left', 'right', 'none'].includes(ps) ? ps : 'top');
    setWindowSide(initial.windowSide === 'right' ? 'right' : 'left');
  }, [open, initial]);

  const maxCols = useMemo(() => Math.max(0, ...rowCols), [rowCols]);
  const totalNames = useMemo(() => seats.flat().filter(v => typeof v === 'string' && v).length, [seats]);

  const setRowColCount = (r: number, n: number) => {
    const next = Math.max(1, Math.floor(n || 1));
    setRowCols(prev => prev.map((v, i) => (i === r ? next : v)));
    setSeats(prev => {
      const g = prev.map(row => [...row]);
      if (g[r]) {
        if (g[r].length > next) g[r] = g[r].slice(0, next);
        else while (g[r].length < next) g[r].push(null);
      }
      return g;
    });
  };

  const addRow = () => {
    setRowCols(prev => [...prev, prev[prev.length - 1] ?? 6]);
    setSeats(prev => [...prev, Array.from({ length: rowCols[rowCols.length - 1] ?? 6 }, () => null)]);
  };

  const removeRow = (r: number) => {
    if (rowCols.length <= 1) return;
    setRowCols(prev => prev.filter((_, i) => i !== r));
    setSeats(prev => prev.filter((_, i) => i !== r));
    setRowAisles(prev => prev.filter(a => a !== r).map(a => (a > r ? a - 1 : a)));
  };

  const setName = (r: number, c: number, name: string) => {
    setSeats(prev => {
      const g = prev.map(row => [...row]);
      if (g[r]) g[r][c] = name.trim() || null;
      return g;
    });
  };

  const clearSeat = (r: number, c: number) => setName(r, c, '');

  const toggleRowAisle = (afterRow: number) =>
    setRowAisles(prev => (prev.includes(afterRow) ? prev.filter(a => a !== afterRow) : [...prev, afterRow].sort((a, b) => a - b)));
  const toggleColAisle = (afterCol: number) =>
    setColAisles(prev => (prev.includes(afterCol) ? prev.filter(a => a !== afterCol) : [...prev, afterCol].sort((a, b) => a - b)));

  // Snap-to-grid: pad every row up to the widest row so columns align visually.
  const padRowsToMax = () => {
    const target = Math.max(1, ...rowCols);
    setRowCols(prev => prev.map(() => target));
    setSeats(prev => prev.map(row => {
      const next = [...row];
      while (next.length < target) next.push(null);
      return next.slice(0, target);
    }));
  };

  const onDragStart = (r: number, c: number) => {
    if (seats[r]?.[c]) dragFromRef.current = { r, c };
  };
  const onDragOver = (e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ r, c });
  };
  const onDrop = (e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    const from = dragFromRef.current;
    if (!from) return;
    setSeats(prev => {
      const g = prev.map(row => [...row]);
      const tmp = g[r]?.[c] ?? null;
      if (g[r]) g[r][c] = g[from.r][from.c];
      g[from.r][from.c] = tmp;
      return g;
    });
    dragFromRef.current = null;
    setDropTarget(null);
  };
  const onDragEnd = () => {
    dragFromRef.current = null;
    setDropTarget(null);
  };

  const handleApply = () => {
    onApply({
      rowCols,
      rowAisles,
      colAisles,
      seats,
      podiumSide,
      windowSide,
      title: initial?.title,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('seat.preview.title') || '识别预览：调整后再应用'}</DialogTitle>
          <DialogDescription>
            {t('seat.preview.desc') || '点击姓名可编辑，拖拽可互换座位，按 + / − 调整每行列数，点击行/列之间的虚线可设置走道。'}
          </DialogDescription>
        </DialogHeader>

        {/* Global controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t('seat.preview.podium') || '讲台位置'}
            <select
              value={podiumSide}
              onChange={(e) => setPodiumSide(e.target.value as Side)}
              className="h-7 text-xs px-2 rounded border border-input bg-background"
            >
              <option value="top">{t('seat.preview.sideTop') || '上方'}</option>
              <option value="bottom">{t('seat.preview.sideBottom') || '下方'}</option>
              <option value="left">{t('seat.preview.sideLeft') || '左侧'}</option>
              <option value="right">{t('seat.preview.sideRight') || '右侧'}</option>
              <option value="none">{t('seat.preview.sideNone') || '无'}</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t('seat.preview.window') || '窗户位置'}
            <select
              value={windowSide}
              onChange={(e) => setWindowSide(e.target.value as 'left' | 'right')}
              className="h-7 text-xs px-2 rounded border border-input bg-background"
            >
              <option value="left">{t('seat.preview.sideLeft') || '左侧'}</option>
              <option value="right">{t('seat.preview.sideRight') || '右侧'}</option>
            </select>
          </label>
          <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5 h-8">
            <Plus className="w-3.5 h-3.5" />{t('seat.preview.addRow') || '增加一行'}
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {(t('seat.preview.summary') || '共 {0} 行 · {1} 列 · {2} 个姓名')
              .replace('{0}', String(rowCols.length))
              .replace('{1}', String(maxCols))
              .replace('{2}', String(totalNames))}
          </span>
        </div>

        {/* View helpers: zoom + alignment + snap-to-grid */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
          <span className="text-[11px] text-muted-foreground mr-1">{t('seat.preview.viewTools') || '视图辅助'}</span>

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))} title={t('seat.preview.zoomOut') || '缩小'}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <input
              type="range"
              min={50}
              max={160}
              step={5}
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              className="w-28 accent-primary"
              title={t('seat.preview.zoom') || '缩放'}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(1.6, +(z + 0.1).toFixed(2)))} title={t('seat.preview.zoomIn') || '放大'}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="text-[11px] text-muted-foreground hover:text-foreground w-10 text-center tabular-nums"
              title={t('seat.preview.zoomReset') || '重置为 100%'}
            >
              {Math.round(zoom * 100)}%
            </button>
          </div>

          <div className="h-5 w-px bg-border mx-1" />

          <div className="flex items-center gap-0.5" role="group" aria-label={t('seat.preview.rowAlign') || '行对齐'}>
            <Button size="icon" variant={rowAlign === 'left' ? 'default' : 'ghost'} className="h-7 w-7" onClick={() => setRowAlign('left')} title={t('seat.preview.alignLeft') || '左对齐'}>
              <AlignLeft className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant={rowAlign === 'center' ? 'default' : 'ghost'} className="h-7 w-7" onClick={() => setRowAlign('center')} title={t('seat.preview.alignCenter') || '居中对齐'}>
              <AlignCenter className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant={rowAlign === 'right' ? 'default' : 'ghost'} className="h-7 w-7" onClick={() => setRowAlign('right')} title={t('seat.preview.alignRight') || '右对齐'}>
              <AlignRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="h-5 w-px bg-border mx-1" />

          <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={padRowsToMax} title={t('seat.preview.padHint') || '将所有行补齐到最长行的列数，便于网格对齐'}>
            <Maximize2 className="w-3.5 h-3.5" />
            {t('seat.preview.padToMax') || '按最长行对齐'}
          </Button>
        </div>

        {/* Podium hint top */}
        {podiumSide === 'top' && (
          <div className="text-center text-[11px] text-muted-foreground py-1">— {t('seat.preview.podiumMark') || '讲台'} —</div>
        )}

        {/* Grid editor */}
        <div className="overflow-auto max-h-[60vh] rounded-md bg-[linear-gradient(to_right,hsl(var(--border)/0.25)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.25)_1px,transparent_1px)] [background-size:24px_24px] p-2">
          <div
            className="space-y-1 origin-top-left transition-transform"
            style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
          >
          {rowCols.map((cols, r) => {
            const justify = rowAlign === 'left' ? 'justify-start' : rowAlign === 'right' ? 'justify-end' : 'justify-center';
            return (
            <div key={`row-${r}`}>
              <div className={`flex items-center gap-1.5 min-w-max py-0.5 ${justify}`}>
                <div className="flex items-center gap-1 w-28 shrink-0">
                  <span className="text-[11px] text-muted-foreground w-8 text-right">{r + 1}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setRowColCount(r, cols - 1)} title={t('seat.preview.minusCol') || '减少一列'}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={cols}
                    onChange={(e) => setRowColCount(r, Number(e.target.value))}
                    className="h-6 w-12 text-xs px-1 text-center"
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setRowColCount(r, cols + 1)} title={t('seat.preview.plusCol') || '增加一列'}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  {Array.from({ length: cols }, (_, c) => {
                    const name = seats[r]?.[c] ?? '';
                    const isTarget = dropTarget?.r === r && dropTarget?.c === c;
                    const cell = (
                      <div
                        key={`cell-${r}-${c}`}
                        draggable={!!name}
                        onDragStart={() => onDragStart(r, c)}
                        onDragOver={(e) => onDragOver(e, r, c)}
                        onDrop={(e) => onDrop(e, r, c)}
                        onDragEnd={onDragEnd}
                        className={[
                          'group relative rounded-md border bg-card flex items-center',
                          isTarget ? 'ring-2 ring-primary' : 'border-border',
                        ].join(' ')}
                      >
                        <Input
                          value={name}
                          placeholder={`${r + 1}-${c + 1}`}
                          onChange={(e) => setName(r, c, e.target.value)}
                          className="h-7 w-[78px] text-[11px] px-1.5 border-0 focus-visible:ring-1"
                        />
                        {name && (
                          <button
                            type="button"
                            onClick={() => clearSeat(r, c)}
                            className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center"
                            title={t('seat.preview.clearSeat') || '清空'}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                    const showAisle = colAisles.includes(c) && c < cols - 1;
                    return (
                      <div key={`wrap-${r}-${c}`} className="flex items-center">
                        {cell}
                        {c < cols - 1 && (
                          <button
                            type="button"
                            onClick={() => toggleColAisle(c)}
                            className={[
                              'h-7 mx-0.5 rounded transition-all',
                              showAisle ? 'w-4 bg-primary/20 border border-primary/40' : 'w-1 hover:w-2 hover:bg-primary/20',
                            ].join(' ')}
                            title={t('seat.preview.toggleColAisle') || '切换列走道'}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button size="icon" variant="ghost" className="h-6 w-6 ml-1 text-destructive" onClick={() => removeRow(r)} disabled={rowCols.length <= 1} title={t('seat.preview.removeRow') || '删除该行'}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              {/* Row-aisle toggle strip */}
              {r < rowCols.length - 1 && (
                <button
                  type="button"
                  onClick={() => toggleRowAisle(r)}
                  className={[
                    'w-full rounded transition-all',
                    rowAisles.includes(r)
                      ? 'h-3 bg-primary/20 border border-primary/40 my-1'
                      : 'h-1 hover:h-2 hover:bg-primary/20 my-0.5',
                  ].join(' ')}
                  title={t('seat.preview.toggleRowAisle') || '切换行走道'}
                />
              )}
            </div>
          ))}
        </div>

        {podiumSide === 'bottom' && (
          <div className="text-center text-[11px] text-muted-foreground py-1">— {t('seat.preview.podiumMark') || '讲台'} —</div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />{t('common.cancel') || '取消'}
          </Button>
          <Button onClick={handleApply}>
            {t('seat.preview.apply') || '应用到自定义场景'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
