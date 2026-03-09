import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { TEMPLATES, TEMPLATE_CATEGORIES, StoryboardParams, DEFAULT_PARAMS, TemplateConfig, TemplateCategory } from './types';
import { Lightbulb } from 'lucide-react';
import TemplateMiniPreview from './TemplateMiniPreview';

interface Props {
  onSelect: (params: StoryboardParams) => void;
}

export default function StoryboardTemplates({ onSelect }: Props) {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');

  const handleSelect = (template: TemplateConfig) => {
    onSelect({ ...DEFAULT_PARAMS, ...template.params });
  };

  const filteredTemplates = selectedCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === selectedCategory);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Lightbulb className="w-4 h-4" />
        {t('storyboard.templates')} ({filteredTemplates.length})
      </div>
      
      {/* Category Filter */}
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          className="cursor-pointer text-xs"
          onClick={() => setSelectedCategory('all')}
        >
          {t('storyboard.category.all')}
        </Badge>
        {TEMPLATE_CATEGORIES.map((cat) => (
          <Badge
            key={cat.key}
            variant={selectedCategory === cat.key ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setSelectedCategory(cat.key)}
          >
            {t(cat.nameKey)}
          </Badge>
        ))}
      </div>

      <ScrollArea className="h-[180px]">
        <div className="grid grid-cols-2 gap-2 pr-4">
          {filteredTemplates.map((template) => (
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
