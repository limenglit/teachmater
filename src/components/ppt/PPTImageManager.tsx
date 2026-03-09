import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Upload, Sparkles, Image, Palette, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
}

const ICON_CATEGORIES = [
  { key: 'business', emoji: '💼', icons: ['📊', '📈', '💰', '🏢', '🤝', '📋', '💡', '🎯', '📌', '🔑', '⚙️', '🔧'] },
  { key: 'education', emoji: '📚', icons: ['🎓', '✏️', '📖', '🧪', '🔬', '🌐', '💻', '🧠', '📝', '🏫', '👨‍🏫', '👩‍🎓'] },
  { key: 'nature', emoji: '🌿', icons: ['🌍', '🌊', '🏔️', '🌅', '🌈', '☀️', '🌙', '⭐', '🌸', '🍀', '🌳', '🦋'] },
  { key: 'tech', emoji: '💻', icons: ['🤖', '📱', '🔒', '☁️', '📡', '🛰️', '🔋', '💾', '🖥️', '⌨️', '🌐', '🔗'] },
  { key: 'people', emoji: '👥', icons: ['👤', '👥', '🙋', '💪', '🤔', '😊', '🎉', '🏆', '🥇', '👨‍💻', '👩‍🔬', '🧑‍🤝‍🧑'] },
  { key: 'arrows', emoji: '➡️', icons: ['➡️', '⬆️', '⬇️', '↗️', '↘️', '🔄', '↩️', '⏩', '▶️', '⏺️', '✅', '❌'] },
];

export default function PPTImageManager({ open, onClose, onSelectImage }: Props) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [storyboardImages, setStoryboardImages] = useState<string[]>([]);
  const [iconSearch, setIconSearch] = useState('');

  // Load storyboard history images
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem('storyboard-history');
      if (raw) {
        const history = JSON.parse(raw) as { imageUrl?: string }[];
        const urls = history
          .filter((h) => h.imageUrl)
          .map((h) => h.imageUrl!)
          .slice(0, 20);
        setStoryboardImages(urls);
      }
    } catch { /* ignore */ }
  }, [open]);

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('ppt.image.invalidFormat'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('ppt.image.tooLarge'));
      return;
    }

    setUploadLoading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `upload-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('ppt-images')
        .upload(fileName, file, { contentType: file.type });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('ppt-images')
        .getPublicUrl(fileName);

      onSelectImage(urlData.publicUrl);
      onClose();
      toast.success(t('ppt.image.uploaded'));
    } catch (err) {
      console.error(err);
      toast.error(t('ppt.image.uploadError'));
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error(t('ppt.image.promptRequired'));
      return;
    }

    setAiLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ppt-image`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: aiPrompt }),
        }
      );

      if (resp.status === 429) { toast.error(t('ppt.rateLimited')); return; }
      if (resp.status === 402) { toast.error(t('ppt.paymentRequired')); return; }
      if (!resp.ok) throw new Error('Generation failed');

      const data = await resp.json();
      if (data.imageUrl) {
        onSelectImage(data.imageUrl);
        onClose();
        toast.success(t('ppt.image.aiGenerated'));
      } else {
        throw new Error('No image URL');
      }
    } catch (err) {
      console.error(err);
      toast.error(t('ppt.image.aiError'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleIconSelect = (icon: string) => {
    // Convert emoji to a data URL via canvas for embedding
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, 256, 256);
    ctx.font = '180px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 128, 140);
    const dataUrl = canvas.toDataURL('image/png');
    onSelectImage(dataUrl);
    onClose();
  };

  const filteredCategories = iconSearch
    ? ICON_CATEGORIES.map(cat => ({
        ...cat,
        icons: cat.icons.filter(() => cat.key.includes(iconSearch.toLowerCase())),
      })).filter(cat => cat.icons.length > 0 || cat.key.includes(iconSearch.toLowerCase()))
    : ICON_CATEGORIES;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            {t('ppt.image.title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload" className="text-xs">
              <Upload className="w-3 h-3 mr-1" />
              {t('ppt.image.tabUpload')}
            </TabsTrigger>
            <TabsTrigger value="icon" className="text-xs">
              <Palette className="w-3 h-3 mr-1" />
              {t('ppt.image.tabIcon')}
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              {t('ppt.image.tabAI')}
            </TabsTrigger>
            <TabsTrigger value="storyboard" className="text-xs">
              🎨
              {t('ppt.image.tabStoryboard')}
            </TabsTrigger>
          </TabsList>

          {/* Local Upload */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLocalUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {uploadLoading ? (
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              )}
              <p className="text-sm font-medium">{t('ppt.image.clickUpload')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('ppt.image.uploadHint')}</p>
            </div>
          </TabsContent>

          {/* Icon Picker */}
          <TabsContent value="icon" className="space-y-3 mt-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder={t('ppt.image.searchIcon')}
                className="pl-8 h-9"
              />
            </div>
            <ScrollArea className="h-[240px]">
              {(iconSearch ? filteredCategories : ICON_CATEGORIES).map((cat) => (
                <div key={cat.key} className="mb-3">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {cat.emoji} {t(`ppt.image.iconCat.${cat.key}`)}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {cat.icons.map((icon, i) => (
                      <button
                        key={i}
                        onClick={() => handleIconSelect(icon)}
                        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-accent text-lg transition-colors"
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          {/* AI Text-to-Image */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm mb-1 block">{t('ppt.image.aiPromptLabel')}</Label>
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t('ppt.image.aiPromptPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
              />
            </div>
            <Button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()} className="w-full">
              {aiLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {aiLoading ? t('ppt.image.aiGenerating') : t('ppt.image.aiGenerate')}
            </Button>
          </TabsContent>

          {/* Storyboard Import */}
          <TabsContent value="storyboard" className="space-y-3 mt-4">
            {storyboardImages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {t('ppt.image.noStoryboard')}
              </div>
            ) : (
              <ScrollArea className="h-[240px]">
                <div className="grid grid-cols-3 gap-2">
                  {storyboardImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => { onSelectImage(url); onClose(); }}
                      className="aspect-video rounded-md border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
