import { Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCoursewareStore, type ModelId } from '@/stores/coursewareStore';
import { cn } from '@/lib/utils';

const MODELS: { id: ModelId; labelKey: string; descKey: string }[] = [
  { id: 'deepseek/deepseek-chat', labelKey: 'cw.model.deepseek', descKey: 'cw.model.deepseek.desc' },
  { id: 'google/gemini-2.5-flash', labelKey: 'cw.model.gemini', descKey: 'cw.model.gemini.desc' },
];

export function Step1TopicInput() {
  const { t } = useLanguage();
  const { topic, audience, slideCountHint, config, setTopic, setAudience, setSlideCountHint, patchConfig, setStep } =
    useCoursewareStore();

  const canSubmit = topic.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border bg-card/70 backdrop-blur p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{t('cw.s1.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('cw.s1.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cw-topic">
            {t('cw.s1.topic')} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="cw-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('cw.s1.topic.ph')}
            rows={3}
            className="resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cw-audience">{t('cw.s1.audience')}</Label>
            <Input
              id="cw-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder={t('cw.s1.audience.ph')}
            />
          </div>
          <div className="space-y-2">
            <Label>
              {t('cw.s1.slides')}: <span className="font-semibold text-foreground">{slideCountHint}</span>
            </Label>
            <Slider
              value={[slideCountHint]}
              onValueChange={(v) => setSlideCountHint(v[0])}
              min={5}
              max={20}
              step={1}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('cw.s1.model')}</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODELS.map((m) => {
              const active = config.model === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => patchConfig({ model: m.id })}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all',
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{t(m.labelKey)}</div>
                    {active && <div className="text-xs text-primary font-semibold">✓</div>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{t(m.descKey)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="lg" disabled={!canSubmit} onClick={() => setStep(2)} className="gap-2">
          <Wand2 className="h-4 w-4" />
          {t('cw.s1.next')}
        </Button>
      </div>
    </div>
  );
}
