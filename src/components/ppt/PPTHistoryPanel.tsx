import { useState, useEffect } from 'react';
import { PPTProject } from './pptTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Trash2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const HISTORY_KEY = 'ppt-history';
const MAX_HISTORY = 20;

interface Props {
  onLoad: (project: PPTProject) => void;
}

export function savePPTProject(project: PPTProject) {
  const history = getPPTHistory();
  const updated = [project, ...history.filter(p => p.id !== project.id)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export function getPPTHistory(): PPTProject[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function PPTHistoryPanel({ onLoad }: Props) {
  const { t } = useLanguage();
  const [history, setHistory] = useState<PPTProject[]>([]);

  useEffect(() => {
    setHistory(getPPTHistory());
  }, []);

  const handleDelete = (id: string) => {
    const updated = history.filter(p => p.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    setHistory(updated);
  };

  if (history.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        {t('ppt.noHistory')}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 pr-4">
        {history.map(project => (
          <div
            key={project.id}
            className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onLoad(project)}>
              <div className="font-medium text-sm truncate">{project.title}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(project.createdAt).toLocaleString()} • {project.outline.slides.length} {t('ppt.slides')}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onLoad(project)}
              >
                <FileDown className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(project.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
