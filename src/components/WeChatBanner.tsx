import { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

function isWeChat(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /micromessenger/i.test(ua);
}

export default function WeChatBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isWeChat()) {
      const dismissed = sessionStorage.getItem('wechat_banner_dismissed');
      if (!dismissed) setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem('wechat_banner_dismissed', '1');
  };

  if (!visible) return null;

  return (
    <div className="bg-warning text-warning-foreground px-4 py-2.5 flex items-center justify-center gap-2 text-sm relative">
      <ExternalLink className="w-4 h-4 shrink-0" />
      
      <button onClick={dismiss} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-warning-foreground/10">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
