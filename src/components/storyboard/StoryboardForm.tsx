import { useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2 } from 'lucide-react';
import { StoryboardParams } from './types';

interface Props {
  params: StoryboardParams;
  onChange: (params: StoryboardParams) => void;
  onGenerate: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export default function StoryboardForm({ params, onChange, onGenerate, isLoading, disabled }: Props) {
  const { t } = useLanguage();
  const themeRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeThemeInput = () => {
    const el = themeRef.current;
    if (!el) return;

    el.style.height = 'auto';
    const maxHeight = 180;
    const nextHeight = Math.min(Math.max(el.scrollHeight, 80), maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    resizeThemeInput();
  }, [params.theme]);

  const update = <K extends keyof StoryboardParams>(key: K, value: StoryboardParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Theme - Required */}
      <div className="space-y-2">
        <Label htmlFor="theme" className="text-sm font-medium">
          {t('storyboard.theme')} <span className="text-destructive">*</span>
        </Label>
        <Textarea
          ref={themeRef}
          id="theme"
          value={params.theme}
          onChange={(e) => update('theme', e.target.value)}
          onInput={resizeThemeInput}
          rows={3}
          placeholder={t('storyboard.themePlaceholder')}
          className="min-h-[80px] max-h-[180px] resize-y leading-6 [overflow-wrap:anywhere] break-words bg-background"
        />
      </div>

      {/* Audience */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('storyboard.audience')}</Label>
        <Select value={params.audience} onValueChange={(v) => update('audience', v as StoryboardParams['audience'])}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="middle-school">{t('storyboard.audience.middleSchool')}</SelectItem>
            <SelectItem value="high-school">{t('storyboard.audience.highSchool')}</SelectItem>
            <SelectItem value="college">{t('storyboard.audience.college')}</SelectItem>
            <SelectItem value="teacher">{t('storyboard.audience.teacher')}</SelectItem>
            <SelectItem value="general">{t('storyboard.audience.general')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('storyboard.tone')}</Label>
        <Select value={params.tone} onValueChange={(v) => update('tone', v as StoryboardParams['tone'])}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="educational">{t('storyboard.tone.educational')}</SelectItem>
            <SelectItem value="serious">{t('storyboard.tone.serious')}</SelectItem>
            <SelectItem value="encouraging">{t('storyboard.tone.encouraging')}</SelectItem>
            <SelectItem value="critical">{t('storyboard.tone.critical')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Layout Mode */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('storyboard.layoutMode')}</Label>
        <Select value={params.layoutMode} onValueChange={(v) => {
          const mode = v as StoryboardParams['layoutMode'];
          onChange({ ...params, layoutMode: mode, panelCount: mode === 'unified' ? 1 : (params.panelCount === 1 ? 4 : params.panelCount) });
        }}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="panels">{t('storyboard.layoutMode.panels')}</SelectItem>
            <SelectItem value="unified">{t('storyboard.layoutMode.unified')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground leading-snug">
          {params.layoutMode === 'unified' ? t('storyboard.layoutMode.unifiedHint') : t('storyboard.layoutMode.panelsHint')}
        </p>
      </div>

      {/* Panel Count - only for panels mode */}
      {params.layoutMode === 'panels' && (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('storyboard.panelCount')}</Label>
        <Select value={String(params.panelCount)} onValueChange={(v) => update('panelCount', Number(v) as StoryboardParams['panelCount'])}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 {t('storyboard.panels')}</SelectItem>
            <SelectItem value="4">4 {t('storyboard.panels')}</SelectItem>
            <SelectItem value="5">5 {t('storyboard.panels')}</SelectItem>
            <SelectItem value="6">6 {t('storyboard.panels')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      )}

      {/* Text Mode */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('storyboard.textMode')}</Label>
        <Select value={params.textMode} onValueChange={(v) => update('textMode', v as StoryboardParams['textMode'])}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overlay">{t('storyboard.textMode.overlay')}</SelectItem>
            <SelectItem value="embedded">{t('storyboard.textMode.embedded')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground leading-snug">
          {params.textMode === 'embedded' ? t('storyboard.textMode.embeddedHint') : t('storyboard.textMode.overlayHint')}
        </p>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('storyboard.aspectRatio')}</Label>
        <Select value={params.aspectRatio} onValueChange={(v) => update('aspectRatio', v as StoryboardParams['aspectRatio'])}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1:1">1:1 ({t('storyboard.square')})</SelectItem>
            <SelectItem value="4:3">4:3 ({t('storyboard.landscape')})</SelectItem>
            <SelectItem value="3:4">3:4 ({t('storyboard.portrait')})</SelectItem>
            <SelectItem value="16:9">16:9 ({t('storyboard.widescreen')})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Language */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('storyboard.language')}</Label>
        <Select value={params.language} onValueChange={(v) => update('language', v as StoryboardParams['language'])}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh">{t('storyboard.lang.zh')}</SelectItem>
            <SelectItem value="en">{t('storyboard.lang.en')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Color Scheme */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('storyboard.colorScheme')}</Label>
        <Select value={params.colorScheme} onValueChange={(v) => update('colorScheme', v as StoryboardParams['colorScheme'])}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="soft">{t('storyboard.color.soft')}</SelectItem>
            <SelectItem value="high-contrast">{t('storyboard.color.highContrast')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Text Density */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('storyboard.textDensity')}</Label>
        <Select value={params.textDensity} onValueChange={(v) => update('textDensity', v as StoryboardParams['textDensity'])}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">{t('storyboard.density.low')}</SelectItem>
            <SelectItem value="medium">{t('storyboard.density.medium')}</SelectItem>
            <SelectItem value="high">{t('storyboard.density.high')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Generate Button */}
      <Button
        onClick={onGenerate}
        disabled={!params.theme.trim() || isLoading || disabled}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t('storyboard.generating')}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            {t('storyboard.generate')}
          </>
        )}
      </Button>
    </div>
  );
}
