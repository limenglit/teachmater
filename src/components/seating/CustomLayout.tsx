import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Shuffle, RotateCcw, DoorOpen, Presentation, Wind } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface Student { id: string; name: string; organization?: string; gender?: string; title?: string }
interface Props { students: Student[] }

type Side = 'top' | 'bottom' | 'left' | 'right';
type WinSide = 'left' | 'right';

interface DoorDef { id: string; label: string; side: Side }

const MAX_COLS_PER_ROW = 30;
const MAX_ROWS = 30;

export default function CustomLayout({ students }: Props) {
  const { t } = useLanguage();

  // Layout state: cols per row
  const [rowCols, setRowCols] = useState<number[]>([6, 6, 8, 8, 8]);
  // Horizontal aisle: gap inserted AFTER given row index
  const [rowAisles, setRowAisles] = useState<number[]>([1]);
  // Vertical aisle: gap inserted AFTER given global column index (applied within each row if that column exists)
  const [colAisles, setColAisles] = useState<number[]>([]);

  // Doors / podium / window
  const [doors, setDoors] = useState<DoorDef[]>([
    { id: 'front', label: t('seat.nav.frontDoor') || '前门', side: 'top' },
  ]);
  const [podiumSide, setPodiumSide] = useState<Side | 'none'>('top');
  const [windowSide, setWindowSide] = useState<WinSide>('left');

  // Seat grid mirrors rowCols structure: seats[r][c] or null/disabled
  const [seats, setSeats] = useState<(string | null)[][]>([]);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const seatKey = (r: number, c: number) => `${r}-${c}`;

  // Drag swap
  const dragFromRef = useRef<{ r: number; c: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ r: number; c: number } | null>(null);

  const totalSeats = useMemo(
    () => rowCols.reduce((s, n, r) => s + n - Array.from({ length: n }, (_, c) => disabled.has(seatKey(r, c)) ? 1 : 0).reduce((a, b) => a + b, 0), 0),
    [rowCols, disabled]
  );

  const setRowColCount = (r: number, raw: string) => {
    const n = Math.max(1, Math.min(MAX_COLS_PER_ROW, Math.floor(Number(raw) || 1)));
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

  const addRow = () => {
    if (rowCols.length >= MAX_ROWS) return;
    setRowCols(prev => [...prev, prev[prev.length - 1] ?? 6]);
  };

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

  const toggleRowAisle = (afterRow: number) => {
    setRowAisles(prev => (prev.includes(afterRow) ? prev.filter(a => a !== afterRow) : [...prev, afterRow].sort((a, b) => a - b)));
  };

  const toggleColAisle = (afterCol: number) => {
    setColAisles(prev => (prev.includes(afterCol) ? prev.filter(a => a !== afterCol) : [...prev, afterCol].sort((a, b) => a - b)));
  };

  const maxCols = useMemo(() => Math.max(0, ...rowCols), [rowCols]);

  const toggleDisabled = (r: number, c: number) => {
    setDisabled(prev => {
      const next = new Set(prev);
      const k = seatKey(r, c);
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
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5) : students.map(s => s.name);
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

  const handleDragStart = (r: number, c: number) => {
    if (!seats[r]?.[c]) return;
    dragFromRef.current = { r, c };
  };
  const handleDragOver = (e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ r, c });
  };
  const handleDrop = (e: React.DragEvent, r: number, c: number) => {
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
  };
  const handleDragEnd = () => {
    dragFromRef.current = null;
    setDropTarget(null);
  };

  const addDoor = () => {
    const idx = doors.length + 1;
    setDoors(prev => [...prev, { id: `door-${Date.now()}`, label: `${t('seat.nav.entry') || '门'} ${idx}`, side: 'bottom' }]);
  };
  const removeDoor = (id: string) => setDoors(prev => prev.filter(d => d.id !== id));
  const updateDoor = (id: string, patch: Partial<DoorDef>) => setDoors(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));

  // Visual: render each row centered, with vertical aisle gaps and disabled cells
  const renderRow = (r: number) => {
    const cellCount = rowCols[r];
    const cells: React.ReactNode[] = [];
    for (let c = 0; c < cellCount; c++) {
      const name = seats[r]?.[c] ?? null;
      const isDisabled = disabled.has(seatKey(r, c));
      const isDropTarget = dropTarget?.r === r && dropTarget?.c === c;
      cells.push(
        <div
          key={`s-${r}-${c}`}
          draggable={!!name}
          onDragStart={() => handleDragStart(r, c)}
          onDragOver={(e) => handleDragOver(e, r, c)}
          onDrop={(e) => handleDrop(e, r, c)}
          onDragEnd={handleDragEnd}
          onClick={(e) => { if (e.shiftKey) toggleDisabled(r, c); }}
          title={`${t('seat.custom.row') || '行'} ${r + 1} · ${t('seat.custom.col') || '列'} ${c + 1}${isDisabled ? ' · ' + (t('seat.nav.disabledSeat') || '不可用') : ''}`}
          className={[
            'select-none cursor-pointer rounded-md border text-[11px] leading-tight px-1 py-1.5 flex items-center justify-center text-center min-h-[36px] w-[60px]',
            isDisabled
              ? 'bg-muted/40 border-dashed border-muted-foreground/40 text-muted-foreground'
              : name
                ? 'bg-card border-border hover:border-primary/60'
                : 'bg-muted/20 border-border/40 text-muted-foreground',
            isDropTarget ? 'ring-2 ring-primary' : '',
          ].join(' ')}
        >
          {isDisabled ? '✕' : (name || `${r + 1}-${c + 1}`)}
        </div>
      );
      // vertical aisle gap (after column c, only if exists in this row)
      if (colAisles.includes(c) && c < cellCount - 1) {
        cells.push(<div key={`v-${r}-${c}`} className="w-4 shrink-0" aria-hidden />);
      }
    }
    return (
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-[10px] text-muted-foreground w-6 text-right">{r + 1}</span>
        <div className="flex items-center gap-1.5 flex-wrap justify-center">{cells}</div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeRow(r)} title={t('seat.custom.removeRow') || '删除该行'}>
          <Minus className="w-3 h-3" />
        </Button>
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
          <span className="text-xs text-muted-foreground ml-auto">
            {t('seat.custom.totalSeats') || '可用座位'}: <b>{totalSeats}</b> · {t('seat.custom.totalStudents') || '名单'}: <b>{students.length}</b>
          </span>
        </div>

        {/* Row config */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-foreground/80">{t('seat.custom.rowsConfig') || '各行列数（按行独立设置）'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {rowCols.map((n, r) => (
              <div key={`rc-${r}`} className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground w-10 shrink-0">{(t('seat.custom.row') || '第')}{r + 1}{(t('seat.custom.rowSuffix') || '行')}</Label>
                <Input type="number" min={1} max={MAX_COLS_PER_ROW} value={n} onChange={(e) => setRowColCount(r, e.target.value)} className="h-7 text-xs px-2" />
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

        {/* Vertical aisles */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-foreground/80">{t('seat.custom.colAislesConfig') || '纵向走道（在第 N 列后）'}</div>
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
          {t('seat.custom.tips') || '提示：按住 Shift 点击座位可临时禁用；拖动姓名可互换座位；行/列走道按需开关。'}
        </p>
      </div>

      {/* Stage */}
      <div className="rounded-2xl border border-border bg-muted/10 p-3 overflow-x-auto">
        {/* Top side decorations */}
        {podiumBadge('top')}
        {doorBadge('top')}

        <div className="flex">
          {/* Left side decorations */}
          <div className="flex flex-col items-center justify-center gap-2 pr-2 shrink-0">
            {windowSide === 'left' && <div className="text-[10px] text-muted-foreground -rotate-90 whitespace-nowrap">🪟 {t('seat.nav.window') || '窗'}</div>}
            {doors.filter(d => d.side === 'left').map(d => (
              <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 text-primary px-2 py-0.5 text-[10px]">🚪 {d.label}</span>
            ))}
            {podiumSide === 'left' && <span className="text-[10px] bg-accent/30 px-2 py-0.5 rounded">{t('seat.nav.podium') || '讲台'}</span>}
          </div>

          {/* Seat rows */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-1.5">
              {rowCols.map((_, r) => (
                <div key={`row-wrap-${r}`}>
                  {renderRow(r)}
                  {rowAisles.includes(r) && r < rowCols.length - 1 && (
                    <div className="my-1.5 border-t border-dashed border-muted-foreground/30 relative">
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-muted px-1.5 text-[9px] text-muted-foreground rounded">
                        {t('seat.custom.aisle') || '走道'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right side decorations */}
          <div className="flex flex-col items-center justify-center gap-2 pl-2 shrink-0">
            {windowSide === 'right' && <div className="text-[10px] text-muted-foreground -rotate-90 whitespace-nowrap">🪟 {t('seat.nav.window') || '窗'}</div>}
            {doors.filter(d => d.side === 'right').map(d => (
              <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 text-primary px-2 py-0.5 text-[10px]">🚪 {d.label}</span>
            ))}
            {podiumSide === 'right' && <span className="text-[10px] bg-accent/30 px-2 py-0.5 rounded">{t('seat.nav.podium') || '讲台'}</span>}
          </div>
        </div>

        {/* Bottom side decorations */}
        {doorBadge('bottom')}
        {podiumBadge('bottom')}
      </div>
    </div>
  );
}
