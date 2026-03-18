import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  COLOR_SCHEMES, FONT_FAMILIES, NODE_SHAPES, ICON_STYLES, CONNECTOR_STYLES,
  GRADIENT_MODES, SHADOW_STYLES, BG_PATTERNS, BORDER_STYLES, ASPECT_RATIOS,
  type TemplateStyle, type StructureType, type ChartType, type VisualSettings,
} from './visualTypes';
import { Button } from '@/components/ui/button';
import { Palette, Layout, BarChart3, Type, Maximize, ChevronDown, ChevronRight, Shapes, Link2, Sparkles, Square, Image, RectangleHorizontal } from 'lucide-react';
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

function CollapsibleSection({ title, icon, defaultOpen = false, children }: {
  title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/50 last:border-b-0 pb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left py-1 hover:text-foreground transition-colors"
      >
        {icon}
        <span className="text-xs font-medium flex-1">{title}</span>
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function OptionGrid<T extends string>({ items, value, onChange, renderItem }: {
  items: { id: T; [k: string]: any }[];
  value: T;
  onChange: (v: T) => void;
  renderItem: (item: any, active: boolean) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs transition-all ${
            value === item.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {renderItem(item, value === item.id)}
        </button>
      ))}
    </div>
  );
}

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
    <div className="space-y-1">
      {/* Structure Type - always open */}
      <CollapsibleSection title={t('visual.structureType')} icon={<Layout className="w-3.5 h-3.5 text-muted-foreground" />} defaultOpen>
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
      </CollapsibleSection>

      {/* Color Scheme */}
      <CollapsibleSection title={t('visual.colorScheme')} icon={<Palette className="w-3.5 h-3.5 text-muted-foreground" />} defaultOpen>
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
      </CollapsibleSection>

      {/* Template */}
      <CollapsibleSection title={t('visual.template')} icon={<Layout className="w-3.5 h-3.5 text-muted-foreground" />}>
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
      </CollapsibleSection>

      {/* Node Shape & Icon */}
      <CollapsibleSection title="节点样式" icon={<Shapes className="w-3.5 h-3.5 text-muted-foreground" />}>
        <div className="space-y-3">
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">形状</span>
            <OptionGrid
              items={NODE_SHAPES}
              value={visualSettings.nodeShape}
              onChange={v => updateSetting('nodeShape', v)}
              renderItem={(item) => <><span>{item.emoji}</span><span>{item.name}</span></>}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">图标</span>
            <OptionGrid
              items={ICON_STYLES}
              value={visualSettings.iconStyle}
              onChange={v => updateSetting('iconStyle', v)}
              renderItem={(item) => <><span>{item.example || '—'}</span><span>{item.name}</span></>}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Connector Style */}
      <CollapsibleSection title="连接线" icon={<Link2 className="w-3.5 h-3.5 text-muted-foreground" />}>
        <OptionGrid
          items={CONNECTOR_STYLES}
          value={visualSettings.connectorStyle}
          onChange={v => updateSetting('connectorStyle', v)}
          renderItem={(item) => <span>{item.name}</span>}
        />
      </CollapsibleSection>

      {/* Effects: Gradient, Shadow, Border */}
      <CollapsibleSection title="视觉效果" icon={<Sparkles className="w-3.5 h-3.5 text-muted-foreground" />}>
        <div className="space-y-3">
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">渐变</span>
            <OptionGrid
              items={GRADIENT_MODES}
              value={visualSettings.gradientMode}
              onChange={v => updateSetting('gradientMode', v)}
              renderItem={(item) => <span>{item.name}</span>}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">阴影</span>
            <OptionGrid
              items={SHADOW_STYLES}
              value={visualSettings.shadowStyle}
              onChange={v => updateSetting('shadowStyle', v)}
              renderItem={(item) => <span>{item.name}</span>}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">边框</span>
            <OptionGrid
              items={BORDER_STYLES}
              value={visualSettings.borderStyle}
              onChange={v => updateSetting('borderStyle', v)}
              renderItem={(item) => <span>{item.name}</span>}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Background Pattern */}
      <CollapsibleSection title="背景" icon={<Image className="w-3.5 h-3.5 text-muted-foreground" />}>
        <div className="space-y-3">
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">纹理</span>
            <OptionGrid
              items={BG_PATTERNS}
              value={visualSettings.backgroundPattern}
              onChange={v => updateSetting('backgroundPattern', v)}
              renderItem={(item) => <><span>{item.emoji}</span><span>{item.name}</span></>}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">比例</span>
            <OptionGrid
              items={ASPECT_RATIOS}
              value={visualSettings.aspectRatio}
              onChange={v => updateSetting('aspectRatio', v)}
              renderItem={(item) => <span>{item.name}</span>}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Font & Size */}
      <CollapsibleSection title={t('visual.font')} icon={<Type className="w-3.5 h-3.5 text-muted-foreground" />}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
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
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={visualSettings.showDescription} onChange={e => updateSetting('showDescription', e.target.checked)} className="rounded" />
              显示描述
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={visualSettings.showValues} onChange={e => updateSetting('showValues', e.target.checked)} className="rounded" />
              显示数值
            </label>
          </div>
        </div>
      </CollapsibleSection>

      {/* Layout Density */}
      <CollapsibleSection title={t('visual.layout')} icon={<Maximize className="w-3.5 h-3.5 text-muted-foreground" />}>
        <div className="flex flex-wrap gap-1.5">
          {([{ id: 'compact' as const, labelKey: 'visual.density.compact' }, { id: 'normal' as const, labelKey: 'visual.density.normal' }, { id: 'spacious' as const, labelKey: 'visual.density.spacious' }]).map(d => (
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
      </CollapsibleSection>

      {/* Chart Type */}
      {hasData && (
        <CollapsibleSection title={t('visual.chartType')} icon={<BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />} defaultOpen>
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
        </CollapsibleSection>
      )}
    </div>
  );
}
