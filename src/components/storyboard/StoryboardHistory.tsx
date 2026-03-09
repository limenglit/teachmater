import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StoryboardResult } from './types';
import { History, Trash2 } from 'lucide-react';

interface Props {
  history: StoryboardResult[];
  onSelect: (result: StoryboardResult) => void;
  onClear: () => void;
}

export default function StoryboardHistory({ history, onSelect, onClear }: Props) {
  const { t } = useLanguage();

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History className="w-4 h-4" />
          {t('storyboard.history')} ({history.length})
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
          <Trash2 className="w-3 h-3 mr-1" />
          {t('storyboard.clearHistory')}
        </Button>
      </div>
      <ScrollArea className="h-32">
        <div className="space-y-2 pr-4">
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <img
                src={item.imageUrl}
                alt=""
                className="w-12 h-12 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.params.theme}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
