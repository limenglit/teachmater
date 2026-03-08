import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExternalLink, Copy, Check, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

function isWeChat(): boolean {
  return /micromessenger/i.test(navigator.userAgent.toLowerCase());
}

export default function GoRedirect() {
  const [params] = useSearchParams();
  const { t } = useLanguage();
  const url = params.get('url') || '';
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (url && !isWeChat()) {
      window.location.href = url;
    }
  }, [url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!url) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        {t('go.invalidLink')}
      </div>
    );
  }

  if (!isWeChat()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        {t('go.redirecting')}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
          <Smartphone className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">{t('go.openInBrowser')}</h1>
          <p className="text-sm text-muted-foreground">{t('go.wechatWarning')}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 text-left space-y-3">
          <div className="flex items-center gap-2 font-medium text-foreground text-sm">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            {t('go.recommended')}
          </div>
          <p className="text-sm text-muted-foreground pl-8">{t('go.recommendedDesc')}</p>
          <div className="flex justify-end pr-2">
            <div className="text-2xl animate-bounce">↗️</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 text-left space-y-3">
          <div className="flex items-center gap-2 font-medium text-foreground text-sm">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">2</span>
            {t('go.copyLink')}
          </div>
          <div className="bg-muted rounded-xl p-3 break-all text-xs text-muted-foreground font-mono">{url}</div>
          <Button onClick={handleCopy} variant="outline" className="w-full gap-2">
            {copied ? (
              <><Check className="w-4 h-4" />{t('go.copied')}</>
            ) : (
              <><Copy className="w-4 h-4" />{t('go.copyLink')}</>
            )}
          </Button>
        </div>

        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ExternalLink className="w-3.5 h-3.5" />
          {t('go.tryDirect')}
        </a>
      </div>
    </div>
  );
}
