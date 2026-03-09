import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TEMPLATES, StoryboardParams, DEFAULT_PARAMS, TemplateConfig } from './types';
import { Lightbulb } from 'lucide-react';

interface Props {
  onSelect: (params: StoryboardParams) => void;
}

export default function StoryboardTemplates({ onSelect }: Props) {
  const { t } = useLanguage();

  const handleSelect = (template: TemplateConfig) => {
    onSelect({ ...DEFAULT_PARAMS, ...template.params });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Lightbulb className="w-4 h-4" />
        {t('storyboard.templates')} ({TEMPLATES.length})
      </div>
      <ScrollArea className="h-[200px]">
        <div className="grid grid-cols-2 gap-2 pr-4">
          {TEMPLATES.map((template) => (
            <Button
              key={template.name}
              variant="outline"
              size="sm"
              className="h-auto py-2 px-3 text-left justify-start"
              onClick={() => handleSelect(template)}
            >
              <span className="truncate text-xs">{t(template.nameKey)}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
