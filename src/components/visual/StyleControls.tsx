import { useLanguage } from '@/contexts/LanguageContext';
import { COLOR_SCHEMES, type ColorScheme, type TemplateStyle, type StructureType, type ChartType } from './visualTypes';
import { Button } from '@/components/ui/button';
import { Palette, Layout, BarChart3 } from 'lucide-react';

interface Props {
  colorScheme: string;
  onColorChange: (id: string) => void;
  template: TemplateStyle;
  onTemplateChange: (t: TemplateStyle) => void;
  structureType: StructureType;
  onStructureChange: (s: StructureType) => void;
  chartType: ChartType;
  onChartChange: (c: ChartType) => void;
  hasData: boolean;
}

const TEMPLATES: { id: TemplateStyle; labelKey: string }[] = [
  { id: 'modern', labelKey: 'visual.tpl.modern' },
  { id: 'classic', labelKey: 'visual.tpl.classic' },
  { id: 'playful', labelKey: 'visual.tpl.playful' },
  { id: 'dark', labelKey: 'visual.tpl.dark' },
];

const STRUCTURES: { id: StructureType; emoji: string; labelKey: string }[] = [
  { id: 'flow', emoji: '➡️', labelKey: 'visual.struct.flow' },
  { id: 'comparison', emoji: '⚖️', labelKey: 'visual.struct.comparison' },
  { id: 'pyramid', emoji: '🔺', labelKey: 'visual.struct.pyramid' },
  { id: 'funnel', emoji: '🔻', labelKey: 'visual.struct.funnel' },
  { id: 'timeline', emoji: '📅', labelKey: 'visual.struct.timeline' },
  { id: 'cycle', emoji: '🔄', labelKey: 'visual.struct.cycle' },
  { id: 'list', emoji: '📋', labelKey: 'visual.struct.list' },
  { id: 'hierarchy', emoji: '🌳', labelKey: 'visual.struct.hierarchy' },
];

const CHARTS: { id: ChartType; emoji: string; labelKey: string }[] = [
  { id: 'bar', emoji: '📊', labelKey: 'visual.chart.bar' },
  { id: 'line', emoji: '📈', labelKey: 'visual.chart.line' },
  { id: 'pie', emoji: '🥧', labelKey: 'visual.chart.pie' },
  { id: 'radar', emoji: '🕸️', labelKey: 'visual.chart.radar' },
  { id: 'scatter', emoji: '⚬', labelKey: 'visual.chart.scatter' },
];

export default function StyleControls({ colorScheme, onColorChange, template, onTemplateChange, structureType, onStructureChange, chartType, onChartChange, hasData }: Props) {
  const { t } = useLanguage();
  const scheme = COLOR_SCHEMES.find(s => s.id === colorScheme) || COLOR_SCHEMES[0];

  return (
    <div className="space-y-4">
      {/* Color Scheme */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Palette className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{t('visual.colorScheme')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_SCHEMES.map(s => (
            <button
              key={s.id}
              onClick={() => onColorChange(s.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-all ${
                colorScheme === s.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground'
              }`}
            >
              <div className="flex gap-0.5">
                {s.colors.slice(0, 3).map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Template */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Layout className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{t('visual.template')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map(tp => (
            <Button
              key={tp.id}
              variant={template === tp.id ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => onTemplateChange(tp.id)}
            >
              {t(tp.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      {/* Structure Type */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Layout className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{t('visual.structureType')}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {STRUCTURES.map(s => (
            <button
              key={s.id}
              onClick={() => onStructureChange(s.id)}
              className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs transition-all ${
                structureType === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{s.emoji}</span>
              <span>{t(s.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart Type */}
      {hasData && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{t('visual.chartType')}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {CHARTS.map(c => (
              <button
                key={c.id}
                onClick={() => onChartChange(c.id)}
                className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs transition-all ${
                  chartType === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{c.emoji}</span>
                <span>{t(c.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
