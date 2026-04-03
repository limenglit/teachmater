import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Eye, EyeOff, ChevronUp, ChevronDown, Plus, Trash2, Layers, Merge
} from 'lucide-react';

export interface EditorLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
}

interface Props {
  layers: EditorLayer[];
  activeLayerId: string;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMerge: (ids: string[]) => void;
}

export default function LayerPanel({
  layers,
  activeLayerId,
  onSelect,
  onToggleVisibility,
  onOpacityChange,
  onMoveUp,
  onMoveDown,
  onAdd,
  onDelete,
  onRename,
  onMerge,
}: Props) {
  const { t } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeMode, setMergeMode] = useState(false);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleMerge = () => {
    if (selectedIds.size < 2) return;
    onMerge(Array.from(selectedIds));
    setSelectedIds(new Set());
    setMergeMode(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
          <Layers className="w-3.5 h-3.5" />
          {t('imgEdit.layers')}
        </div>
        <div className="flex items-center gap-0.5">
          {mergeMode ? (
            <>
              <Button
                variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                disabled={selectedIds.size < 2}
                onClick={handleMerge}
              >
                <Merge className="w-3 h-3 mr-0.5" />
                {t('imgEdit.mergeLayers')} ({selectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px] text-muted-foreground" onClick={() => { setMergeMode(false); setSelectedIds(new Set()); }}>
                ✕
              </Button>
            </>
          ) : (
            <>
              {layers.length > 1 && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMergeMode(true)} title={t('imgEdit.mergeLayers')}>
                  <Merge className="w-3 h-3" />
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onAdd} title={t('imgEdit.addLayer')}>
                <Plus className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>
      <ScrollArea className="h-44">
        <div className="space-y-1 pr-2">
          {layers.map((layer, idx) => (
            <div
              key={layer.id}
              className={`rounded-md border p-1.5 transition-colors cursor-pointer ${
                layer.id === activeLayerId
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
              onClick={() => onSelect(layer.id)}
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title={layer.visible ? t('imgEdit.hideLayer') : t('imgEdit.showLayer')}
                >
                  {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <input
                  className="flex-1 min-w-0 text-xs bg-transparent border-none outline-none truncate text-foreground"
                  value={layer.name}
                  onChange={(e) => onRename(layer.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveUp(layer.id); }}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveDown(layer.id); }}
                    disabled={idx === layers.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {!layer.locked && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-muted-foreground shrink-0 w-5">
                  {Math.round(layer.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(layer.opacity * 100)}
                  onChange={(e) => { e.stopPropagation(); onOpacityChange(layer.id, Number(e.target.value) / 100); }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-1 accent-primary"
                />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
