import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SeatAlignment, Segment } from '@/lib/seat-alignment';

interface Props {
  /** Number of rows to expose alignment controls for. */
  rows: number;
  /** Column segments (computed from column aisles). */
  segments: Segment[];
  getAlign: (r: number, segIdx: number) => SeatAlignment;
  onSetAlign: (r: number, segIdx: number | 'all', value: SeatAlignment) => void;
  onApplyAll: () => void;
  className?: string;
}

/**
 * Reusable "auto align / even spacing" toolbar shared by grid-based seating
 * scenes (classroom, custom venue, ...). Purely presentational: all state and
 * grid mutation live in the owning scene via `useSeatAlignment`.
 */
export default function SeatAlignmentPanel({ rows, segments, getAlign, onSetAlign, onApplyAll, className }: Props) {
  const { t } = useLanguage();
  if (rows <= 0 || segments.length === 0) return null;

  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-medium text-foreground/80">
          {t('seat.custom.alignmentTitle') || '座椅自动对齐与等间距'}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {t('seat.custom.alignmentHint') || '按列走道自动分段；每段可独立选择左/右/居中/两端对齐；座位数量不变，仅调整位置'}
        </span>
        <Button size="sm" variant="outline" className="ml-auto h-8 min-h-8" onClick={onApplyAll}>
          {t('seat.custom.applyAlignmentAll') || '重新应用全部对齐'}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-56 overflow-auto pr-1">
        {Array.from({ length: rows }, (_, r) => {
          const first = getAlign(r, 0);
          const uniform = segments.every((_, i) => getAlign(r, i) === first);
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
                  onSetAlign(r, 'all', v);
                }}
                className="h-8 text-[11px] px-1 rounded border border-input bg-background"
                title={t('seat.custom.alignmentWholeRow') || '整行对齐（应用到所有段）'}
              >
                <option value="left">{t('seat.custom.alignLeft') || '左对齐'}</option>
                <option value="right">{t('seat.custom.alignRight') || '右对齐'}</option>
                <option value="center">{t('seat.custom.alignCenter') || '居中'}</option>
                <option value="justify">{t('seat.custom.alignJustify') || '两端对齐'}</option>
                {!uniform && <option value="mixed">{t('seat.custom.alignMixed') || '分段混合…'}</option>}
              </select>
              {segments.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {segments.map((_, si) => (
                    <label key={`seg-${r}-${si}`} className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <span className="rounded bg-muted px-1">{`§${si + 1}`}</span>
                      <select
                        value={getAlign(r, si)}
                        onChange={(e) => onSetAlign(r, si, e.target.value as SeatAlignment)}
                        className="h-8 text-[10px] px-0.5 rounded border border-input bg-background"
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
  );
}
