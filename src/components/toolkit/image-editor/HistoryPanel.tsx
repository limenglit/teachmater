import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface HistoryEntry {
  id: number;
  label: string;
  thumbnail: string; // small data URL
  timestamp: number;
}

interface Props {
  entries: HistoryEntry[];
  currentIndex: number;
  onJump: (index: number) => void;
  onClear: () => void;
}

export default function HistoryPanel({ entries, currentIndex, onJump, onClear }: Props) {
  const { t } = useLanguage();

  if (entries.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        {t('imgEdit.noHistory')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
          <History className="w-3.5 h-3.5" />
          {t('imgEdit.history')}
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClear} title={t('imgEdit.clearHistory')}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      <ScrollArea className="h-48">
        <div className="space-y-1 pr-2">
          {entries.map((entry, idx) => (
            <button
              key={entry.id}
              onClick={() => onJump(idx)}
              className={`w-full flex items-center gap-2 p-1.5 rounded-md transition-colors text-left ${
                idx === currentIndex
                  ? 'bg-primary/10 border border-primary/30'
                  : idx > currentIndex
                  ? 'opacity-40 hover:opacity-70 hover:bg-muted/50'
                  : 'hover:bg-muted/50'
              }`}
            >
              <img
                src={entry.thumbnail}
                alt=""
                className="w-10 h-10 rounded border border-border object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{entry.label}</p>
                <p className="text-[10px] text-muted-foreground">#{entry.id}</p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
