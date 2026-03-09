import { useLanguage } from '@/contexts/LanguageContext';
import { COLOR_SCHEMES, FONT_FAMILIES, type TemplateStyle, type StructureType, type ChartType, type FontFamily, type LayoutDensity, type VisualSettings } from './visualTypes';
import { Button } from '@/components/ui/button';
import { Palette, Layout, BarChart3, Type, Maximize } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

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
  visualSettings: VisualSettings;
  onVisualSettingsChange: (s: VisualSettings) => void;
}

const TEMPLATES: { id: TemplateStyle; labelKey: string }[] = [
  { id: 'modern', labelKey: 'visual.tpl.modern' },
  { id: 'classic', labelKey: 'visual.tpl.classic' },
  { id: 'playful', labelKey: 'visual.tpl.playful' },
  { id: 'dark', labelKey: 'visual.tpl.dark' },
  { id: 'magazine', labelKey: 'visual.tpl.magazine' },
  { id: 'tech', labelKey: 'visual.tpl.tech' },
  { id: 'elegant', labelKey: 'visual.tpl.elegant' },
  { id: 'bold', labelKey: 'visual.tpl.bold' },
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
  { id: 'mindmap', emoji: '🧠', labelKey: 'visual.struct.mindmap' },
  { id: 'matrix', emoji: '▦', labelKey: 'visual.struct.matrix' },
  { id: 'radial', emoji: '☀️', labelKey: 'visual.struct.radial' },
  { id: 'swot', emoji: '📐', labelKey: 'visual.struct.swot' },
];

const CHARTS: { id: ChartType; emoji: string; labelKey: string }[] = [
  { id: 'bar', emoji: '📊', labelKey: 'visual.chart.bar' },
  { id: 'line', emoji: '📈', labelKey: 'visual.chart.line' },
  { id: 'pie', emoji: '🥧', labelKey: 'visual.chart.pie' },
  { id: 'donut', emoji: '🍩', labelKey: 'visual.chart.donut' },
  { id: 'area', emoji: '📉', labelKey: 'visual.chart.area' },
  { id: 'radar', emoji: '🕸️', labelKey: 'visual.chart.radar' },
  { id: 'scatter', emoji: '⚬', labelKey: 'visual.chart.scatter' },
  { id: 'treemap', emoji: '🟩', labelKey: 'visual.chart.treemap' },
];

const DENSITIES: { id: LayoutDensity; labelKey: string }[] = [
  { id: 'compact', labelKey: 'visual.density.compact' },
  { id: 'normal', labelKey: 'visual.density.normal' },
  { id: 'spacious', labelKey: 'visual.density.spacious' },
];

export default function StyleControls({
  colorScheme, onColorChange, template, onTemplateChange,
  structureType, onStructureChange, chartType, onChartChange, hasData,
  visualSettings, onVisualSettingsChange,
}: Props) {
  const { t } = useLanguage();

  const updateSetting = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => {
    onVisualSettingsChange({ ...visualSettings, [key]: value });
  };

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
              title={s.name}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-all ${
                colorScheme === s.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground'
              }`}
            >
              <div className="flex gap-0.5">
                {s.colors.slice(0, 3).map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">{s.name}</span>
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

      {/* Font & Size */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Type className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{t('visual.font')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {FONT_FAMILIES.map(f => (
            <button
              key={f.id}
              onClick={() => updateSetting('fontFamily', f.id)}
              className={`px-2 py-1 rounded text-xs border transition-all ${
                visualSettings.fontFamily === f.id ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
              }`}
              style={{ fontFamily: f.css }}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('visual.fontSize')}</span>
          <Slider
            value={[visualSettings.fontSize]}
            min={12}
            max={24}
            step={1}
            onValueChange={([v]) => updateSetting('fontSize', v)}
            className="flex-1"
          />
          <span className="text-[10px] text-muted-foreground w-8 text-right">{visualSettings.fontSize}px</span>
        </div>
      </div>

      {/* Layout Density */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Maximize className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{t('visual.layout')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DENSITIES.map(d => (
            <Button
              key={d.id}
              variant={visualSettings.layoutDensity === d.id ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => updateSetting('layoutDensity', d.id)}
            >
              {t(d.labelKey)}
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
