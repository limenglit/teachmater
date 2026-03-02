import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Copy, Check, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

function isWeChat(): boolean {
  return /micromessenger/i.test(navigator.userAgent.toLowerCase());
}

export default function GoRedirect() {
  const [params] = useSearchParams();
  const url = params.get('url') || '';
  const [copied, setCopied] = useState(false);

  // Non-WeChat: redirect immediately
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
      // Fallback for older browsers
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
        无效链接
      </div>
    );
  }

  // Non-WeChat: show a brief loading while redirecting
  if (!isWeChat()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        正在跳转...
      </div>
    );
  }

  // WeChat: show guide page
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
          <Smartphone className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">在浏览器中打开</h1>
          <p className="text-sm text-muted-foreground">
            当前为微信内置浏览器，请选择以下方式打开链接以获得最佳体验
          </p>
        </div>

        {/* Method 1: Top-right menu */}
        <div className="bg-card border border-border rounded-2xl p-4 text-left space-y-3">
          <div className="flex items-center gap-2 font-medium text-foreground text-sm">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            推荐方式
          </div>
          <p className="text-sm text-muted-foreground pl-8">
            点击右上角 <span className="inline-block px-1.5 py-0.5 bg-muted rounded text-foreground font-medium">⋯</span> 菜单，选择 <span className="font-medium text-foreground">「在默认浏览器中打开」</span>
          </p>

          {/* Visual arrow hint pointing to top-right */}
          <div className="flex justify-end pr-2">
            <div className="text-2xl animate-bounce">↗️</div>
          </div>
        </div>

        {/* Method 2: Copy link */}
        <div className="bg-card border border-border rounded-2xl p-4 text-left space-y-3">
          <div className="flex items-center gap-2 font-medium text-foreground text-sm">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">2</span>
            复制链接
          </div>

          <div className="bg-muted rounded-xl p-3 break-all text-xs text-muted-foreground font-mono">
            {url}
          </div>

          <Button onClick={handleCopy} variant="outline" className="w-full gap-2">
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                已复制，请粘贴到浏览器打开
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制链接
              </>
            )}
          </Button>
        </div>

        {/* Direct try (sometimes works) */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          直接尝试打开
        </a>
      </div>
    </div>
  );
}
