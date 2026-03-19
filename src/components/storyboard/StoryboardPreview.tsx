import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Download, Copy, RefreshCw, Maximize2, X, ImageIcon, Type } from 'lucide-react';
import { useState, lazy, Suspense } from 'react';
import { toast } from 'sonner';
import { TextOverlay } from './types';

/** Retry dynamic import once then force-reload to pick up new chunks */
function lazyRetry<T extends { default: React.ComponentType<any> }>(factory: () => Promise<T>) {
  return lazy(() =>
    factory().catch(() => {
      const key = 'chunk_reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
      return factory();
    }),
  );
}

const TextOverlayEditor = lazyRetry(() => import('./TextOverlayEditor'));

/** Copy text to clipboard with fallback for older browsers */
async function safeClipboardWrite(text: string): Promise<void> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

interface Props {
  imageUrl: string | null;
  prompt: string | null;
  isLoading: boolean;
  onRegenerate: () => void;
  keywords?: TextOverlay[];
}

export default function StoryboardPreview({ imageUrl, prompt, isLoading, onRegenerate, keywords }: Props) {
  const { t } = useLanguage();
  const [fullscreen, setFullscreen] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `storyboard-${Date.now()}.png`;
    link.click();
    toast.success(t('storyboard.downloaded'));
  };

  const handleCopyPrompt = async () => {
    if (!prompt) return;
    try {
      await safeClipboardWrite(prompt);
      toast.success(t('storyboard.promptCopied'));
    } catch {
      toast.error('Copy failed');
    }
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
      <div className="flex-1 flex flex-col bg-muted/30 rounded-xl overflow-hidden pb-20 sm:pb-0">
        {/* Image */}
        <div className="flex-1 relative p-4 flex items-center justify-center min-h-0">
          <img
            src={imageUrl}
            alt="Generated storyboard"
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => setFullscreen(true)}
          />
        </div>

        {/* Actions - Desktop */}
        <div className="hidden sm:flex items-center justify-center gap-2 p-4 border-t border-border bg-card flex-wrap">
          <Button variant="default" size="sm" onClick={() => setShowEditor(true)}>
            <Type className="w-4 h-4 mr-1" />
            {t('storyboard.editText')}
          </Button>
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

      {/* Mobile bottom bar */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 compat-backdrop-blur p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />
            {t('storyboard.download')}
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={onRegenerate}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {t('storyboard.regenerate')}
          </Button>
          <Button variant="default" size="sm" className="h-9" onClick={() => setShowEditor(true)}>
            <Type className="w-4 h-4 mr-1" />
            {t('storyboard.editText')}
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
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] p-2 text-white/80 hover:text-white transition-colors"
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

      {/* Text Overlay Editor */}
      {showEditor && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <TextOverlayEditor imageUrl={imageUrl} onClose={() => setShowEditor(false)} initialKeywords={keywords} />
        </Suspense>
      )}
    </>
  );
}
