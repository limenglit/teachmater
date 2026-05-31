import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentHead } from '@/hooks/useDocumentHead';
import { decodePageRouteParam, getPublicPageUrl } from '@/lib/page-slug';

export default function UserPageView() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const decodedUsername = username ? decodePageRouteParam(username) : '';
  const decodedSlug = slug ? decodePageRouteParam(slug) : '';
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!decodedUsername || !decodedSlug) return;
    (async () => {
      const { data, error } = await supabase.rpc('get_public_page', {
        p_username: decodedUsername,
        p_slug: decodedSlug,
      });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setNotFound(true);
        return;
      }
      const row: any = Array.isArray(data) ? data[0] : data;
      setTitle(row.title || `${decodedUsername}/${decodedSlug}`);

      let htmlText = '';
      if (row.storage_path) {
        // 通过 SDK 下载，避免 Storage 直链返回 text/plain + CSP sandbox。
        const { data: file, error: dlErr } = await supabase.storage
          .from('user-pages')
          .download(row.storage_path);
        if (dlErr || !file) { setNotFound(true); return; }
        htmlText = await file.text();
      } else {
        htmlText = row.html_content || '';
      }

      // 移动端浏览器（特别是 iOS Safari / 微信内置）对 blob: URL 在 iframe 中渲染支持不稳定，
      // 经常只解析 <title> 而不渲染 body。改用 srcDoc 在所有平台上都能稳定渲染独立 HTML。
      setHtml(htmlText);
    })();
  }, [decodedUsername, decodedSlug]);


  useEffect(() => { if (title) document.title = title; }, [title]);

  const pageUrl = decodedUsername && decodedSlug ? getPublicPageUrl('https://teachermate.org.cn', decodedUsername, decodedSlug) : undefined;
  useDocumentHead({
    title: title ? `${title} — ${decodedUsername}` : undefined,
    description: title ? `${decodedUsername} 在教创搭子上发布的页面：${title}` : undefined,
    canonical: pageUrl,
    ogTitle: title || undefined,
    ogDescription: title ? `${decodedUsername} 在教创搭子上发布的页面：${title}` : undefined,
    ogUrl: pageUrl,
    ogType: 'article',
    jsonLd: title && pageUrl
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          author: { '@type': 'Person', name: decodedUsername },
          url: pageUrl,
          mainEntityOfPage: pageUrl,
        }
      : undefined,
  });

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-2">
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="text-sm text-muted-foreground">页面不存在：/{decodedUsername}/{decodedSlug}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const style = { position: 'fixed' as const, inset: 0, width: '100vw', height: '100vh', border: 'none' };
  return <iframe title={title} src={blobUrl} style={style} />;
}
