import { useState, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Sparkles, Download, History, RefreshCw, ChevronLeft, ChevronRight, Upload, FileText, X, FileDown, Image, Trash2, Maximize2 } from 'lucide-react';
import { 
  PPTOutline, PPTProject, 
  PPT_TEMPLATES, PPT_STYLES, PPT_COLOR_SCHEMES, PPT_AUDIENCES,
  PPT_FONTS, PPT_FONT_SIZES, PPT_LAYOUTS,
} from './ppt/pptTypes';
import PPTSlidePreview from './ppt/PPTSlidePreview';
import PPTHistoryPanel, { savePPTProject, getPPTHistory } from './ppt/PPTHistoryPanel';
import { exportPPTX } from './ppt/pptExport';
import { exportPDF } from './ppt/pptPdfExport';
import PPTImageManager from './ppt/PPTImageManager';
import PPTDraggableImage from './ppt/PPTDraggableImage';
import PPTEditableText from './ppt/PPTEditableText';
import PPTPresenter from './ppt/PPTPresenter';
import { useAIQuota } from '@/hooks/useAIQuota';

type Step = 'input' | 'design' | 'preview';

export default function PPTPanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const [step, setStep] = useState<Step>('input');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<'report' | 'teaching' | 'marketing'>('teaching');
  const [template, setTemplate] = useState('education');
  const [style, setStyle] = useState('minimal');
  const [colorScheme, setColorScheme] = useState('calm-blue');
  const [fontFamily, setFontFamily] = useState('yahei');
  const [fontSize, setFontSize] = useState('standard');
  const [customColor, setCustomColor] = useState('#2563EB');
  const [outline, setOutline] = useState<PPTOutline | null>(null);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [showImageManager, setShowImageManager] = useState(false);
  const [showPresenter, setShowPresenter] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slidePreviewRef = useRef<HTMLDivElement>(null);

  const aiQuota = useAIQuota();
  const guestRemaining = aiQuota.remaining;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'md', 'docx'].includes(ext || '')) {
      toast.error(t('ppt.fileUnsupported'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('ppt.fileTooLarge'));
      return;
    }

    setFileLoading(true);
    try {
      let text = '';
      if (ext === 'txt' || ext === 'md') {
        text = await file.text();
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      }

      if (!text.trim()) {
        toast.error(t('ppt.fileEmpty'));
        return;
      }

      setContent(text);
      setUploadedFileName(file.name);
      toast.success(t('ppt.fileLoaded'));
    } catch (error) {
      console.error('File read error:', error);
      toast.error(t('ppt.fileReadError'));
    } finally {
      setFileLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!content.trim()) {
      toast.error(t('ppt.contentRequired'));
      return;
    }
    if (!aiQuota.consume()) {
      toast.error(t('ppt.guestLimitReached'));
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ppt-outline`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ content, audience }),
        }
      );

      if (response.status === 429) {
        toast.error(t('ppt.rateLimited'));
        return;
      }
      if (response.status === 402) {
        toast.error(t('ppt.paymentRequired'));
        return;
      }
      if (!response.ok) throw new Error('Failed to generate');

      const data = await response.json();
      if (data.outline) {
        setOutline(data.outline);
        setStep('design');
        toast.success(t('ppt.outlineGenerated'));
      } else {
        throw new Error('No outline returned');
      }
    } catch (error) {
      console.error(error);
      toast.error(t('ppt.generateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pptx' | 'pdf' | 'both') => {
    if (!outline) return;
    try {
      const effectiveColorId = colorScheme === 'custom' ? 'custom' : colorScheme;
      
      const fontConfig = PPT_FONTS.find(f => f.id === fontFamily) || PPT_FONTS[0];
      const fontSizeConfig = PPT_FONT_SIZES.find(f => f.id === fontSize) || PPT_FONT_SIZES[1];
      
      if (format === 'pptx' || format === 'both') {
        await exportPPTX(outline, effectiveColorId, template, fontConfig.fontFace, fontSizeConfig);
      }
      if (format === 'pdf' || format === 'both') {
        await exportPDF(outline, effectiveColorId, fontSizeConfig);
      }
      
      // Save to history
      const project: PPTProject = {
        id: crypto.randomUUID(),
        title: outline.title,
        outline,
        template,
        style,
        colorScheme,
        fontFamily,
        fontSize,
        createdAt: new Date().toISOString(),
      };
      savePPTProject(project);
      toast.success(format === 'both' ? t('ppt.exportBothSuccess') : t('ppt.exportSuccess'));
    } catch (error) {
      console.error(error);
      toast.error(t('ppt.exportError'));
    }
  };

  const handleLoadProject = (project: PPTProject) => {
    setOutline(project.outline);
    setTemplate(project.template);
    setStyle(project.style);
    setColorScheme(project.colorScheme);
    setFontFamily(project.fontFamily || 'yahei');
    setFontSize(project.fontSize || 'standard');
    setStep('preview');
    setShowHistory(false);
  };

  const handleRegenerateSlide = async (index: number) => {
    if (!outline) return;
    toast.info(t('ppt.regenerating'));
    // For MVP, just show a placeholder - full regeneration would call AI again
    const newSlides = [...outline.slides];
    newSlides[index] = { ...newSlides[index], bullets: newSlides[index].bullets?.map(b => b + ' (已更新)') };
    setOutline({ ...outline, slides: newSlides });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h2 className="text-lg font-semibold">{t('ppt.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('ppt.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isLoggedIn && (
            <span className="text-xs text-muted-foreground">
              {t('ppt.guestRemaining')}: {guestRemaining}/{GUEST_AI_DAILY_MAX}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 mr-1" />
            {t('ppt.history')}
          </Button>
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 p-4 overflow-auto">
          <PPTHistoryPanel onLoad={handleLoadProject} />
        </div>
      ) : (
        <>
          {/* Steps indicator */}
          <div className="flex items-center gap-2 py-3 border-b border-border bg-muted/30 overflow-x-auto px-3 sm:px-4">
            {(['input', 'design', 'preview'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => (s === 'input' || outline) && setStep(s)}
                  disabled={s !== 'input' && !outline}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    step === s 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  } ${s !== 'input' && !outline ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {i + 1}. {t(`ppt.step.${s}`)}
                </button>
                {i < 2 && <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />}
              </div>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {step === 'input' && (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* File Upload */}
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileLoading}
                    className="mb-2"
                  >
                    {fileLoading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {fileLoading ? t('ppt.fileLoading') : t('ppt.uploadFile')}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t('ppt.uploadHint')}</p>
                  {uploadedFileName && (
                    <div className="flex items-center justify-center gap-2 mt-2 text-sm text-primary">
                      <FileText className="w-4 h-4" />
                      <span>{uploadedFileName}</span>
                      <button
                        onClick={() => { setUploadedFileName(''); setContent(''); }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-base font-medium">{t('ppt.inputContent')}</Label>
                  <p className="text-sm text-muted-foreground mb-2">{t('ppt.inputHint')}</p>
                  <Textarea
                    value={content}
                    onChange={(e) => { setContent(e.target.value); setUploadedFileName(''); }}
                    placeholder={t('ppt.inputPlaceholder')}
                    className="min-h-[200px] text-sm"
                  />
                </div>

                <div>
                  <Label className="text-base font-medium mb-2 block">{t('ppt.audienceLabel')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {PPT_AUDIENCES.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setAudience(a.id as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          audience === a.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {t(a.nameKey)}
                      </button>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={loading || !content.trim()}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  {loading ? t('ppt.generating') : t('ppt.generateOutline')}
                </Button>
              </div>
            )}

            {step === 'design' && outline && (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Keywords */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <Label className="text-sm font-medium mb-2 block">{t('ppt.keywords')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {outline.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Template */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t('ppt.templateLabel')}</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PPT_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => setTemplate(tpl.id)}
                        className={`p-3 rounded-lg border-2 text-center transition-colors ${
                          template === tpl.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="text-2xl mb-1">
                          {tpl.id === 'business' ? '💼' : tpl.id === 'education' ? '📚' : tpl.id === 'academic' ? '🎓' : '🎨'}
                        </div>
                        <div className="text-sm font-medium">{t(tpl.nameKey)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t('ppt.styleLabel')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {PPT_STYLES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setStyle(s.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          style === s.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {t(s.nameKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Scheme */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t('ppt.colorLabel')}</Label>
                  <div className="flex flex-wrap gap-3">
                    {PPT_COLOR_SCHEMES.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setColorScheme(c.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                          colorScheme === c.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div 
                          className="w-5 h-5 rounded-full" 
                          style={{ backgroundColor: c.primary }}
                        />
                        <span className="text-sm">{t(c.nameKey)}</span>
                      </button>
                    ))}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-border">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => {
                          setCustomColor(e.target.value);
                          setColorScheme('custom');
                        }}
                        className="w-5 h-5 rounded cursor-pointer"
                      />
                      <span className="text-sm">{t('ppt.color.custom')}</span>
                    </div>
                  </div>
                </div>

                {/* Font Family */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t('ppt.fontLabel')}</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PPT_FONTS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFontFamily(f.id)}
                        className={`px-3 py-2 rounded-lg border-2 text-center transition-colors ${
                          fontFamily === f.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="text-sm font-medium" style={{ fontFamily: f.fontFace }}>
                          {f.sample}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{t(f.nameKey)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t('ppt.fontSizeLabel')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {PPT_FONT_SIZES.map(fs => (
                      <button
                        key={fs.id}
                        onClick={() => setFontSize(fs.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          fontSize === fs.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {t(fs.nameKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Layout - apply to selected slide */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t('ppt.layoutLabel')}</Label>
                  <p className="text-xs text-muted-foreground mb-2">{t('ppt.layoutHint')}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PPT_LAYOUTS.map(l => {
                      const currentSlide = outline.slides[selectedSlide];
                      const isActive = currentSlide?.type === l.id;
                      return (
                        <button
                          key={l.id}
                          onClick={() => {
                            if (!outline) return;
                            const newSlides = [...outline.slides];
                            newSlides[selectedSlide] = { ...newSlides[selectedSlide], type: l.id };
                            setOutline({ ...outline, slides: newSlides });
                          }}
                          className={`p-2 rounded-lg border-2 text-center transition-colors cursor-pointer ${
                            isActive
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="text-lg">{l.icon}</div>
                          <div className="text-xs text-muted-foreground">{t(l.nameKey)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('input')}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {t('ppt.back')}
                  </Button>
                  <Button onClick={() => setStep('preview')} className="flex-1">
                    {t('ppt.toPreview')}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {step === 'preview' && outline && (
              <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Slide list */}
                  <div className="lg:col-span-1 space-y-3">
                    <Label className="text-base font-medium">{t('ppt.slideList')}</Label>
                    <ScrollArea className="h-[500px] pr-2">
                      <div className="space-y-3">
                        {outline.slides.map((slide, i) => (
                          <PPTSlidePreview
                            key={i}
                            slide={slide}
                            index={i}
                            colorSchemeId={colorScheme}
                            isSelected={selectedSlide === i}
                            onClick={() => setSelectedSlide(i)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Selected slide detail */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">{t('ppt.slideDetail')}</Label>
                      <div className="flex items-center gap-2">
                        {outline.slides[selectedSlide]?.imageUrl ? (
                          <Button variant="outline" size="sm" onClick={() => {
                            const newSlides = [...outline.slides];
                            newSlides[selectedSlide] = { ...newSlides[selectedSlide], imageUrl: undefined };
                            setOutline({ ...outline, slides: newSlides });
                          }}>
                            <Trash2 className="w-4 h-4 mr-1" />
                            {t('ppt.image.removeImage')}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setShowImageManager(true)}>
                            <Image className="w-4 h-4 mr-1" />
                            {t('ppt.image.addImage')}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleRegenerateSlide(selectedSlide)}>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          {t('ppt.regenerateSlide')}
                        </Button>
                      </div>
                    </div>
                    
                    <div 
                      ref={slidePreviewRef}
                      className="aspect-video rounded-lg border border-border overflow-hidden relative"
                      style={{ backgroundColor: PPT_COLOR_SCHEMES.find(c => c.id === colorScheme)?.background || '#FFF' }}
                    >
                      {outline.slides[selectedSlide] && (() => {
                        const slide = outline.slides[selectedSlide];
                        const colors = PPT_COLOR_SCHEMES.find(c => c.id === colorScheme) || PPT_COLOR_SCHEMES[0];
                        const bulletsText = slide.bullets?.join('\n') || '';

                        const updateSlide = (patch: Partial<typeof slide>) => {
                          const newSlides = [...outline.slides];
                          newSlides[selectedSlide] = { ...newSlides[selectedSlide], ...patch };
                          setOutline({ ...outline, slides: newSlides });
                        };

                        return (
                          <>
                            {slide.imageUrl && (
                              <PPTDraggableImage
                                src={slide.imageUrl}
                                containerRef={slidePreviewRef}
                                position={slide.imagePosition || { x: 0, y: 10, width: 33, height: 80 }}
                                onChange={(pos) => updateSlide({ imagePosition: pos })}
                              />
                            )}

                            {/* Editable title */}
                            <PPTEditableText
                              text={slide.title}
                              textStyle={slide.titleStyle}
                              position={slide.titlePosition}
                              containerRef={slidePreviewRef}
                              defaultColor={colors.primary}
                              isTitle
                              onChange={(val) => updateSlide({ title: val })}
                              onStyleChange={(s) => updateSlide({ titleStyle: s })}
                              onPositionChange={(p) => updateSlide({ titlePosition: p })}
                            />

                            {/* Editable body (bullets joined by newline) */}
                            <PPTEditableText
                              text={bulletsText}
                              textStyle={slide.bodyStyle}
                              position={slide.bodyPosition || { x: 5, y: 30, width: 90 }}
                              containerRef={slidePreviewRef}
                              defaultColor={colors.text}
                              isTitle={false}
                              onChange={(val) => updateSlide({ bullets: val.split('\n').filter(Boolean) })}
                              onStyleChange={(s) => updateSlide({ bodyStyle: s })}
                              onPositionChange={(p) => updateSlide({ bodyPosition: p })}
                            />
                          </>
                        );
                      })()}
                    </div>

                    <PPTImageManager
                      open={showImageManager}
                      onClose={() => setShowImageManager(false)}
                      onSelectImage={(url) => {
                        if (!outline) return;
                        const newSlides = [...outline.slides];
                        newSlides[selectedSlide] = { ...newSlides[selectedSlide], imageUrl: url };
                        setOutline({ ...outline, slides: newSlides });
                      }}
                    />

                    <div className="flex gap-3 flex-wrap">
                      <Button variant="outline" onClick={() => setStep('design')}>
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        {t('ppt.back')}
                      </Button>
                      <Button variant="default" onClick={() => setShowPresenter(true)}>
                        <Maximize2 className="w-4 h-4 mr-2" />
                        {t('ppt.present')}
                      </Button>
                      <Button variant="outline" onClick={() => handleExport('pdf')}>
                        <FileDown className="w-4 h-4 mr-2" />
                        {t('ppt.exportPDF')}
                      </Button>
                      <Button onClick={() => handleExport('pptx')} className="flex-1">
                        <Download className="w-4 h-4 mr-2" />
                        {t('ppt.exportPPTX')}
                      </Button>
                      <Button onClick={() => handleExport('both')} variant="secondary">
                        <Download className="w-4 h-4 mr-2" />
                        {t('ppt.exportBoth')}
                      </Button>
                    </div>

                    {showPresenter && (
                      <PPTPresenter
                        outline={outline}
                        colorSchemeId={colorScheme}
                        startIndex={selectedSlide}
                        onExit={() => setShowPresenter(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
