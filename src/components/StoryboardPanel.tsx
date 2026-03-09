import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import StoryboardForm from './storyboard/StoryboardForm';
import StoryboardPreview from './storyboard/StoryboardPreview';
import StoryboardTemplates from './storyboard/StoryboardTemplates';
import StoryboardHistory from './storyboard/StoryboardHistory';
import { StoryboardParams, StoryboardResult, DEFAULT_PARAMS, TextOverlay, TEMPLATES } from './storyboard/types';
import { getGuestAIRemaining, recordGuestAIUsage } from '@/lib/guest-ai-limit';
import { supabase } from '@/integrations/supabase/client';
import { Pencil } from 'lucide-react';

const HISTORY_KEY = 'storyboard-history';
const MAX_HISTORY = 20;

export default function StoryboardPanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useState<StoryboardParams>(DEFAULT_PARAMS);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<StoryboardResult[]>([]);
  const [currentKeywords, setCurrentKeywords] = useState<TextOverlay[]>([]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }, []);

  // Save history to localStorage
  const saveHistory = (newHistory: StoryboardResult[]) => {
    setHistory(newHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  };

  const handleGenerate = async () => {
    if (!params.theme.trim()) {
      toast.error(t('storyboard.themeRequired'));
      return;
    }

    // Check guest limit
    const remaining = getGuestAIRemaining(!!user);
    if (remaining === 0) {
      toast.error(t('storyboard.guestLimitReached'));
      return;
    }

    setIsLoading(true);
    setImageUrl(null);
    setPrompt(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-storyboard', {
        body: { params },
      });

      if (error) {
        console.error('Edge function error:', error);
        if (error.message?.includes('429')) {
          toast.error(t('storyboard.rateLimited'));
        } else if (error.message?.includes('402')) {
          toast.error(t('storyboard.paymentRequired'));
        } else {
          toast.error(t('storyboard.generateError'));
        }
        return;
      }

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
        setPrompt(data.prompt || '');

        // Record guest usage
        recordGuestAIUsage(!!user);

        // Add to history
        const newResult: StoryboardResult = {
          id: crypto.randomUUID(),
          params: { ...params },
          imageUrl: data.imageUrl,
          prompt: data.prompt || '',
          createdAt: new Date().toISOString(),
        };
        const newHistory = [newResult, ...history].slice(0, MAX_HISTORY);
        saveHistory(newHistory);

        toast.success(t('storyboard.generateSuccess'));
      } else {
        toast.error(t('storyboard.noImageReturned'));
      }
    } catch (e) {
      console.error('Generate error:', e);
      toast.error(t('storyboard.generateError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (result: StoryboardResult) => {
    setParams(result.params);
    setImageUrl(result.imageUrl);
    setPrompt(result.prompt);
    setCurrentKeywords(result.keywords || []);
  };

  const handleClearHistory = () => {
    saveHistory([]);
    toast.success(t('storyboard.historyCleared'));
  };

  const handleSelectTemplate = (templateParams: StoryboardParams) => {
    setParams(templateParams);
    // Find matching template to get keywords
    const template = TEMPLATES.find(t => t.params.theme === templateParams.theme);
    if (template) {
      setCurrentKeywords(template.keywords);
    }
  };

  const guestRemaining = getGuestAIRemaining(!!user);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
      {/* Left Panel - Form */}
      <Card className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pencil className="w-5 h-5" />
            {t('storyboard.title')}
          </CardTitle>
          {guestRemaining >= 0 && (
            <p className="text-xs text-muted-foreground">
              {t('storyboard.guestRemaining')}: {guestRemaining}
            </p>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6">
              <StoryboardTemplates onSelect={handleSelectTemplate} />
              <Separator />
              <StoryboardForm
                params={params}
                onChange={setParams}
                onGenerate={handleGenerate}
                isLoading={isLoading}
                disabled={guestRemaining === 0}
              />
              <Separator />
              <StoryboardHistory
                history={history}
                onSelect={handleSelectHistory}
                onClear={handleClearHistory}
              />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right Panel - Preview */}
      <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0">
        <StoryboardPreview
          imageUrl={imageUrl}
          prompt={prompt}
          isLoading={isLoading}
          onRegenerate={handleGenerate}
          keywords={currentKeywords}
        />
      </div>
    </div>
  );
}
