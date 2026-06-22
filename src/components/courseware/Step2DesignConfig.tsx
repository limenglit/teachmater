import { ArrowLeft, ArrowRight, Palette as PaletteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useCoursewareStore,
  type Ratio,
  type Style,
  type PaletteId,
  type FontPairId,
  type TransitionId,
} from '@/stores/coursewareStore';
import { cn } from '@/lib/utils';

const RATIOS: { id: Ratio; label: string; aspect: string }[] = [
  { id: '16:9', label: '16:9 · 1280×720', aspect: 'aspect-[16/9]' },
  { id: '4:3', label: '4:3 · 1024×768', aspect: 'aspect-[4/3]' },
];

const STYLES: { id: Style; labelKey: string; preview: { bg: string; fg: string; accent: string } }[] = [
  { id: 'icon', labelKey: 'cw.style.icon', preview: { bg: '#ffffff', fg: '#0f172a', accent: '#2563eb' } },
  { id: 'minimalist', labelKey: 'cw.style.minimalist', preview: { bg: '#fafafa', fg: '#262626', accent: '#737373' } },
  { id: 'corporate', labelKey: 'cw.style.corporate', preview: { bg: '#f1f5f9', fg: '#0f172a', accent: '#1e40af' } },
  { id: 'creative', labelKey: 'cw.style.creative', preview: { bg: '#fdf4ff', fg: '#581c87', accent: '#ec4899' } },
  { id: 'hand-drawn', labelKey: 'cw.style.handDrawn', preview: { bg: '#fffbeb', fg: '#78350f', accent: '#f59e0b' } },
  { id: 'dark-neon', labelKey: 'cw.style.darkNeon', preview: { bg: '#0a0a0a', fg: '#e5e5e5', accent: '#22d3ee' } },
  { id: 'editorial', labelKey: 'cw.style.editorial', preview: { bg: '#ffffff', fg: '#111827', accent: '#b91c1c' } },
  { id: 'infographic', labelKey: 'cw.style.infographic', preview: { bg: '#ecfdf5', fg: '#064e3b', accent: '#10b981' } },
];

const PALETTES: { id: PaletteId; colors: string[] }[] = [
  { id: 'calm-blue', colors: ['#2563eb', '#60a5fa', '#dbeafe'] },
  { id: 'energetic-orange', colors: ['#ea580c', '#fb923c', '#ffedd5'] },
  { id: 'tech-gray', colors: ['#334155', '#94a3b8', '#f1f5f9'] },
  { id: 'green-growth', colors: ['#059669', '#34d399', '#d1fae5'] },
  { id: 'dark-navy', colors: ['#0f172a', '#1e293b', '#475569'] },
  { id: 'warm-beige', colors: ['#92400e', '#d97706', '#fef3c7'] },
  { id: 'custom', colors: ['#000', '#000', '#000'] },
];

const FONT_PAIRS: { id: FontPairId; label: string }[] = [
  { id: 'noto-sc', label: 'Noto Sans SC + Noto Serif SC' },
  { id: 'inter-source', label: 'Inter + Source Serif Pro' },
  { id: 'playfair-source', label: 'Playfair Display + Source Sans Pro' },
  { id: 'space-grotesk-dm', label: 'Space Grotesk + DM Sans' },
  { id: 'caveat-noto', label: 'Caveat + Noto Sans SC' },
  { id: 'jb-mono', label: 'JetBrains Mono + Inter' },
];

const TRANSITIONS: TransitionId[] = ['none', 'fade', 'slide', 'zoom'];

export function Step2DesignConfig() {
  const { t } = useLanguage();
  const { config, patchConfig, patchCustomColors, setStep } = useCoursewareStore();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-card/70 backdrop-blur p-6 shadow-sm space-y-6">
        {/* Ratio */}
        <section className="space-y-3">
          <Label className="text-base">{t('cw.s2.ratio')}</Label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {RATIOS.map((r) => {
              const active = config.ratio === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => patchConfig({ ratio: r.id })}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all',
                    active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:border-primary/40',
                  )}
                >
                  <div className={cn('rounded-md bg-muted mb-2', r.aspect)} />
                  <div className="text-sm font-medium">{r.label}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Style */}
        <section className="space-y-3">
          <Label className="text-base">{t('cw.s2.style')}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STYLES.map((s) => {
              const active = config.style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => patchConfig({ style: s.id })}
                  className={cn(
                    'rounded-xl border overflow-hidden text-left transition-all',
                    active ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40',
                  )}
                >
                  <div
                    className="aspect-[16/9] flex items-center justify-center text-sm font-semibold"
                    style={{ background: s.preview.bg, color: s.preview.fg }}
                  >
                    <span style={{ borderBottom: `3px solid ${s.preview.accent}`, paddingBottom: 2 }}>Aa</span>
                  </div>
                  <div className="p-2 text-xs font-medium text-center">{t(s.labelKey)}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Palette */}
        <section className="space-y-3">
          <Label className="text-base flex items-center gap-2">
            <PaletteIcon className="h-4 w-4" />
            {t('cw.s2.palette')}
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PALETTES.map((p) => {
              const active = config.palette === p.id;
              const isCustom = p.id === 'custom';
              return (
                <button
                  key={p.id}
                  onClick={() => patchConfig({ palette: p.id })}
                  className={cn(
                    'rounded-xl border p-3 transition-all text-left',
                    active ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40',
                  )}
                >
                  <div className="flex gap-1 mb-2">
                    {isCustom ? (
                      <>
                        <div className="h-6 w-6 rounded" style={{ background: config.customColors.primary }} />
                        <div className="h-6 w-6 rounded" style={{ background: config.customColors.secondary }} />
                        <div className="h-6 w-6 rounded" style={{ background: config.customColors.accent }} />
                      </>
                    ) : (
                      p.colors.map((c, i) => <div key={i} className="h-6 w-6 rounded" style={{ background: c }} />)
                    )}
                  </div>
                  <div className="text-xs font-medium">{t(`cw.palette.${p.id}`)}</div>
                </button>
              );
            })}
          </div>
          {config.palette === 'custom' && (
            <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
              {(['primary', 'secondary', 'accent'] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{t(`cw.palette.custom.${k}`)}</Label>
                  <Input
                    type="color"
                    value={config.customColors[k]}
                    onChange={(e) => patchCustomColors({ [k]: e.target.value })}
                    className="h-10 w-full p-1"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Font + Transition */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('cw.s2.font')}</Label>
            <Select value={config.fontPair} onValueChange={(v) => patchConfig({ fontPair: v as FontPairId })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_PAIRS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('cw.s2.transition')}</Label>
            <Select value={config.transition} onValueChange={(v) => patchConfig({ transition: v as TransitionId })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITIONS.map((tr) => (
                  <SelectItem key={tr} value={tr}>
                    {t(`cw.transition.${tr}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Footer + page numbers */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('cw.s2.footer')}</Label>
            <Input
              value={config.footer}
              onChange={(e) => patchConfig({ footer: e.target.value })}
              placeholder={t('cw.s2.footer.ph')}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('cw.s2.pageNum')}</Label>
              <Switch
                checked={config.showPageNumbers}
                onCheckedChange={(v) => patchConfig({ showPageNumbers: v })}
              />
            </div>
            {config.showPageNumbers && (
              <Select
                value={config.pageNumberPosition}
                onValueChange={(v) => patchConfig({ pageNumberPosition: v as 'left' | 'center' | 'right' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">{t('cw.pos.left')}</SelectItem>
                  <SelectItem value="center">{t('cw.pos.center')}</SelectItem>
                  <SelectItem value="right">{t('cw.pos.right')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </section>

        {/* Icon density */}
        {(config.style === 'icon' || config.style === 'infographic') && (
          <section className="space-y-2">
            <Label>{t('cw.s2.iconDensity')}</Label>
            <div className="flex gap-2">
              {(['low', 'med', 'high'] as const).map((d) => (
                <Button
                  key={d}
                  variant={config.iconDensity === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => patchConfig({ iconDensity: d })}
                >
                  {t(`cw.density.${d}`)}
                </Button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {t('cw.back')}
        </Button>
        <Button onClick={() => setStep(3)} className="gap-2">
          {t('cw.s2.next')} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
