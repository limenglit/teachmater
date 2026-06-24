import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Plus, RefreshCw, Sparkles, Trash2, ChevronUp, ChevronDown, AlertCircle, Eye, EyeOff, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCoursewareStore, type Slide, type SlideType } from '@/stores/coursewareStore';
import { generateCoursewareHtml } from '@/lib/courseware/htmlGenerator';

const SLIDE_TYPES: SlideType[] = [
  'title', 'toc', 'content', 'two-column', 'image-text',
  'comparison', 'quote', 'timeline', 'conclusion',
];

export function Step3OutlinePanel() {
  const { t, lang } = useLanguage();
  const langMap: Record<string, string> = { zh: 'zh-CN', en: 'en', ru: 'ru', ja: 'ja', ko: 'ko', es: 'es' };
  const {
    topic, audience, slideCountHint, config,
    outline, setOutline, loading, setLoading, setStep, error, setError,
    setHtml,
  } = useCoursewareStore();

  const [autoTried, setAutoTried] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewHtml, setPreviewHtml] = useState('');
  const debounceRef = useRef<number | null>(null);

  // Debounced rebuild of preview HTML whenever outline or config changes
  const outlineKey = useMemo(() => (outline ? JSON.stringify(outline) : ''), [outline]);
  const configKey = useMemo(() => JSON.stringify(config), [config]);
  useEffect(() => {
    if (!outline || outline.slides.length === 0) {
      setPreviewHtml('');
      setHtml('');
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      try {
        const html = generateCoursewareHtml(outline, config);
        setPreviewHtml(html);
        setHtml(html);
      } catch (e) {
        console.error('[courseware] preview render failed', e);
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlineKey, configKey]);

  const downloadHtml = () => {
    if (!previewHtml || !outline) return;
    const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${outline.title || 'courseware'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openInNewTab = () => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const generate = async () => {
    setError(undefined);
    setLoading({ outline: true });
    try {
      const { data, error: invErr } = await supabase.functions.invoke('generate-courseware-outline', {
        body: {
          topic,
          audience,
          slideCount: slideCountHint,
          style: config.style,
          language: langMap[lang] || 'en',
          model: config.model,
        },
      });
      if (invErr) {
        const msg = invErr.message || '';
        if (msg.includes('429')) toast.error(t('cw.err.rate'));
        else if (msg.includes('402')) toast.error(t('cw.err.payment'));
        else if (msg.includes('401')) toast.error(t('cw.err.auth'));
        else toast.error(t('cw.err.generic'));
        setError(t('cw.err.generic'));
        return;
      }
      if (data?.outline) {
        setOutline(data.outline);
        toast.success(t('cw.outline.ready'));
      } else {
        setError(t('cw.err.generic'));
        toast.error(t('cw.err.generic'));
      }
    } catch (e) {
      console.error(e);
      setError(t('cw.err.generic'));
      toast.error(t('cw.err.generic'));
    } finally {
      setLoading({ outline: false });
    }
  };

  useEffect(() => {
    if (!outline && !loading.outline && !autoTried && topic.trim()) {
      setAutoTried(true);
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSlide = (idx: number, patch: Partial<Slide>) => {
    if (!outline) return;
    const slides = outline.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setOutline({ ...outline, slides });
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    if (!outline) return;
    const j = idx + dir;
    if (j < 0 || j >= outline.slides.length) return;
    const slides = [...outline.slides];
    [slides[idx], slides[j]] = [slides[j], slides[idx]];
    setOutline({ ...outline, slides });
  };

  const removeSlide = (idx: number) => {
    if (!outline) return;
    setOutline({ ...outline, slides: outline.slides.filter((_, i) => i !== idx) });
  };

  const addSlide = () => {
    if (!outline) return;
    const newSlide: Slide = {
      id: `s_${Date.now()}`,
      type: 'content',
      title: t('cw.outline.newSlide'),
      bullets: [''],
    };
    setOutline({ ...outline, slides: [...outline.slides, newSlide] });
  };

  if (loading.outline && !outline) {
    return (
      <div className="rounded-2xl border bg-card/70 backdrop-blur p-12 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">{t('cw.outline.generating')}</p>
      </div>
    );
  }

  if (!outline && error) {
    return (
      <div className="rounded-2xl border bg-card/70 backdrop-blur p-8 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> {t('cw.back')}
          </Button>
          <Button onClick={generate} className="gap-2">
            <RefreshCw className="h-4 w-4" /> {t('cw.outline.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (!outline) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card/70 backdrop-blur p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-[240px]">
            <Label className="text-xs text-muted-foreground">{t('cw.outline.deckTitle')}</Label>
            <Input
              value={outline.title}
              onChange={(e) => setOutline({ ...outline, title: e.target.value })}
              className="text-lg font-semibold"
            />
            <Input
              value={outline.subtitle || ''}
              placeholder={t('cw.outline.subtitle.ph')}
              onChange={(e) => setOutline({ ...outline, subtitle: e.target.value })}
              className="text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={generate} disabled={loading.outline} className="gap-2">
            {loading.outline ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('cw.outline.regen')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('cw.outline.count').replace('{n}', String(outline.slides.length))}
        </p>
      </div>

      <div className="space-y-3">
        {outline.slides.map((slide, idx) => (
          <div key={slide.id} className="rounded-xl border bg-card/70 backdrop-blur p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono rounded bg-muted px-2 py-0.5">#{idx + 1}</span>
              <Select value={slide.type} onValueChange={(v) => updateSlide(idx, { type: v as SlideType })}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLIDE_TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp} className="text-xs">
                      {t(`cw.slideType.${tp}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => moveSlide(idx, -1)} disabled={idx === 0}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => moveSlide(idx, 1)} disabled={idx === outline.slides.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                  onClick={() => removeSlide(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Input
              value={slide.title}
              onChange={(e) => updateSlide(idx, { title: e.target.value })}
              placeholder={t('cw.outline.slideTitle.ph')}
              className="font-medium"
            />

            {(slide.type === 'two-column' || slide.type === 'comparison') ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Input
                    value={slide.leftTitle || ''}
                    onChange={(e) => updateSlide(idx, { leftTitle: e.target.value })}
                    placeholder={t('cw.outline.leftTitle.ph')}
                    className="text-sm"
                  />
                  <Textarea
                    value={(slide.leftBullets || []).join('\n')}
                    onChange={(e) => updateSlide(idx, { leftBullets: e.target.value.split('\n') })}
                    placeholder={t('cw.outline.bullets.ph')}
                    rows={4}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    value={slide.rightTitle || ''}
                    onChange={(e) => updateSlide(idx, { rightTitle: e.target.value })}
                    placeholder={t('cw.outline.rightTitle.ph')}
                    className="text-sm"
                  />
                  <Textarea
                    value={(slide.rightBullets || []).join('\n')}
                    onChange={(e) => updateSlide(idx, { rightBullets: e.target.value.split('\n') })}
                    placeholder={t('cw.outline.bullets.ph')}
                    rows={4}
                    className="text-sm"
                  />
                </div>
              </div>
            ) : slide.type === 'quote' ? (
              <div className="space-y-2">
                <Textarea
                  value={slide.quoteText || ''}
                  onChange={(e) => updateSlide(idx, { quoteText: e.target.value })}
                  placeholder={t('cw.outline.quote.ph')}
                  rows={3}
                  className="text-sm"
                />
                <Input
                  value={slide.quoteAuthor || ''}
                  onChange={(e) => updateSlide(idx, { quoteAuthor: e.target.value })}
                  placeholder={t('cw.outline.quoteAuthor.ph')}
                  className="text-sm"
                />
              </div>
            ) : slide.type === 'timeline' ? (
              <Textarea
                value={(slide.timelineItems || []).map((it) => `${it.year} | ${it.text}`).join('\n')}
                onChange={(e) =>
                  updateSlide(idx, {
                    timelineItems: e.target.value.split('\n').filter(Boolean).map((line) => {
                      const [year, ...rest] = line.split('|');
                      return { year: (year || '').trim(), text: rest.join('|').trim() };
                    }),
                  })
                }
                placeholder={t('cw.outline.timeline.ph')}
                rows={4}
                className="text-sm font-mono"
              />
            ) : (
              <Textarea
                value={(slide.bullets || []).join('\n')}
                onChange={(e) => updateSlide(idx, { bullets: e.target.value.split('\n') })}
                placeholder={t('cw.outline.bullets.ph')}
                rows={4}
                className="text-sm"
              />
            )}

            <Textarea
              value={slide.speakerNotes || ''}
              onChange={(e) => updateSlide(idx, { speakerNotes: e.target.value })}
              placeholder={t('cw.outline.notes.ph')}
              rows={2}
              className="text-xs text-muted-foreground"
            />
          </div>
        ))}
      </div>

      <Button variant="outline" onClick={addSlide} className="w-full gap-2">
        <Plus className="h-4 w-4" /> {t('cw.outline.addSlide')}
      </Button>

      {/* Live preview pane */}
      <div className="rounded-2xl border bg-card/70 backdrop-blur overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 border-b bg-muted/30">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{t('cw.preview.title')}</span>
          <span className="text-xs text-muted-foreground">
            {config.ratio} · {t(`cw.style.${config.style === 'hand-drawn' ? 'handDrawn' : config.style === 'dark-neon' ? 'darkNeon' : config.style}`)}
          </span>
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="ghost" className="h-8 gap-1.5"
              onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPreview ? t('cw.preview.hide') : t('cw.preview.show')}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5"
              disabled={!previewHtml} onClick={openInNewTab}>
              <ExternalLink className="h-3.5 w-3.5" />
              {t('cw.preview.openNewTab')}
            </Button>
          </div>
        </div>
        {showPreview && (
          previewHtml ? (
            <iframe
              key={configKey /* force reload when design changes */}
              srcDoc={previewHtml}
              title="courseware-preview"
              sandbox="allow-same-origin allow-scripts"
              className="w-full bg-white"
              style={{
                aspectRatio: config.ratio === '16:9' ? '16 / 9' : '4 / 3',
                border: 0,
                display: 'block',
              }}
            />
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {t('cw.preview.empty')}
            </div>
          )
        )}
      </div>

      <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {t('cw.back')}
        </Button>
        <Button className="gap-2" disabled={!previewHtml} onClick={downloadHtml}>
          <Download className="h-4 w-4" /> {t('cw.outline.generateHtml')}
        </Button>
      </div>
    </div>
  );
}
