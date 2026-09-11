import { useMemo, useRef, useState } from 'react';
import { Search, Trash2, Plus, Crosshair, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  normalizeMarkerName,
  findDuplicateNameGroups,
  keepFirstPerName,
  diffAgainstRoster,
  type SeatChartMarker,
} from '@/lib/seat-chart-markers';

interface Props {
  imageUrl: string;
  markers: SeatChartMarker[];
  onChange: (markers: SeatChartMarker[]) => void;
  /** Class roster used to cross-check recognized names, when available. */
  rosterNames?: string[];
}

/**
 * Teacher-side review of AI-recognized name positions on the uploaded seating
 * chart: search, drag to correct, delete, and add missing names by tapping the
 * picture. Pointer events keep it usable on touch devices.
 */
export default function SeatChartMarkerEditor({ imageUrl, markers, onChange, rosterNames }: Props) {
  const [query, setQuery] = useState('');
  const [addName, setAddName] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);

  const q = normalizeMarkerName(query);
  const matchIndexes = useMemo(() => {
    if (!q) return new Set<number>();
    const set = new Set<number>();
    markers.forEach((m, i) => { if (m.name.includes(q)) set.add(i); });
    return set;
  }, [markers, q]);

  const duplicateGroups = useMemo(() => findDuplicateNameGroups(markers), [markers]);
  const duplicateExtra = duplicateGroups.reduce((sum, g) => sum + g.indexes.length - 1, 0);

  const roster = useMemo(
    () => (rosterNames ?? []).map(normalizeMarkerName).filter(Boolean),
    [rosterNames],
  );
  const rosterDiff = useMemo(
    () => (roster.length ? diffAgainstRoster(markers, roster) : null),
    [markers, roster],
  );
  const extraSet = useMemo(
    () => new Set(rosterDiff?.extraIndexes ?? []),
    [rosterDiff],
  );

  const removeIndexes = (indexes: Set<number>) => {
    onChange(markers.filter((_, i) => !indexes.has(i)));
    setActiveIndex(null);
  };


  const pointToNormalized = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const handleSurfacePointerDown = (e: React.PointerEvent) => {
    if (!addMode) return;
    const name = normalizeMarkerName(addName);
    if (!name) return;
    const p = pointToNormalized(e.clientX, e.clientY);
    if (!p) return;
    onChange([...markers, { name, x: p.x, y: p.y }]);
    setAddName('');
    setAddMode(false);
    setActiveIndex(markers.length);
  };

  const startDrag = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    draggingRef.current = index;
    setActiveIndex(index);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent) => {
    const index = draggingRef.current;
    if (index === null) return;
    const p = pointToNormalized(e.clientX, e.clientY);
    if (!p) return;
    const next = markers.slice();
    next[index] = { ...next[index], x: p.x, y: p.y };
    onChange(next);
  };

  const endDrag = () => { draggingRef.current = null; };

  const removeMarker = (index: number) => {
    onChange(markers.filter((_, i) => i !== index));
    setActiveIndex(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索姓名，检查识别是否正确"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          共识别 {markers.length} 人{q ? ` · 命中 ${matchIndexes.size} 人` : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={addName}
          onChange={e => setAddName(e.target.value)}
          placeholder="补录漏识别的姓名"
          className="h-9 w-40 text-xs"
        />
        <Button
          type="button"
          variant={addMode ? 'default' : 'outline'}
          size="sm"
          className="h-9 gap-1 text-xs"
          disabled={!normalizeMarkerName(addName)}
          onClick={() => setAddMode(v => !v)}
        >
          <Plus className="w-3.5 h-3.5" />
          {addMode ? '点击图片放置' : '补录并定位'}
        </Button>
        {activeIndex !== null && markers[activeIndex] && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 text-xs text-destructive"
            onClick={() => removeMarker(activeIndex)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除「{markers[activeIndex].name}」
          </Button>
        )}
      </div>

      <div
        ref={surfaceRef}
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative w-full overflow-hidden rounded-lg border border-border bg-muted/20 ${addMode ? 'cursor-crosshair' : ''}`}
        style={{ touchAction: 'none' }}
      >
        <img src={imageUrl} alt="座次表标注" className="w-full select-none" draggable={false} />
        {markers.map((m, i) => {
          const isMatch = matchIndexes.has(i);
          const isActive = activeIndex === i;
          return (
            <button
              key={`${m.name}-${i}`}
              type="button"
              onPointerDown={startDrag(i)}
              title={m.name}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border text-[10px] leading-none px-1.5 py-1 ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary z-20'
                  : isMatch
                    ? 'bg-amber-400 text-amber-950 border-amber-500 z-10'
                    : 'bg-background/85 text-foreground border-border'
              }`}
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
            >
              {m.name}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Crosshair className="w-3 h-3" />
        拖动标签可微调位置；点击标签后可删除；先输入姓名再点“补录并定位”，然后点击图片对应位置。
      </p>
    </div>
  );
}
