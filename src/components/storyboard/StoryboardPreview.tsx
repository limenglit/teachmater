import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Download, Copy, RefreshCw, Maximize2, X, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  imageUrl: string | null;
  prompt: string | null;
  isLoading: boolean;
  onRegenerate: () => void;
}

export default function StoryboardPreview({ imageUrl, prompt, isLoading, onRegenerate }: Props) {
  const { t } = useLanguage();
  const [fullscreen, setFullscreen] = useState(false);

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `storyboard-${Date.now()}.png`;
    link.click();
    toast.success(t('storyboard.downloaded'));
  };

  const handleCopyPrompt = () => {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    toast.success(t('storyboard.promptCopied'));
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-xl">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">{t('storyboard.generatingImage')}</p>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-xl border-2 border-dashed border-border">
        <div className="text-center space-y-2 p-8">
          <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">{t('storyboard.previewEmpty')}</p>
          <p className="text-sm text-muted-foreground/70">{t('storyboard.previewHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col bg-muted/30 rounded-xl overflow-hidden">
        {/* Image */}
        <div className="flex-1 relative p-4 flex items-center justify-center min-h-0">
          <img
            src={imageUrl}
            alt="Generated storyboard"
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => setFullscreen(true)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-2 p-4 border-t border-border bg-card">
          <Button variant="outline" size="sm" onClick={() => setFullscreen(true)}>
            <Maximize2 className="w-4 h-4 mr-1" />
            {t('storyboard.fullscreen')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />
            {t('storyboard.download')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyPrompt} disabled={!prompt}>
            <Copy className="w-4 h-4 mr-1" />
            {t('storyboard.copyPrompt')}
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {t('storyboard.regenerate')}
          </Button>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            onClick={() => setFullscreen(false)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={imageUrl}
            alt="Generated storyboard"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
