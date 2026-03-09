import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
        <Input
          id="theme"
          value={params.theme}
          onChange={(e) => update('theme', e.target.value)}
          placeholder={t('storyboard.themePlaceholder')}
          className="bg-background"
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

      {/* Panel Count */}
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
