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
  
  );
}
