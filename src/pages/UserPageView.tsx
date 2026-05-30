import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function UserPageView() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username || !slug) return;
    let revoke: string | null = null;
    (async () => {
      const { data, error } = await supabase.rpc('get_public_page', {
        p_username: username,
        p_slug: slug,
      });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setNotFound(true);
        return;
      }
      const row: any = Array.isArray(data) ? data[0] : data;
      setTitle(row.title || `${username}/${slug}`);

      let htmlText = '';
      if (row.storage_path) {
        // Supabase Storage 对 HTML 返回 text/plain + CSP sandbox，浏览器会拒绝渲染。
        // 通过 SDK 下载内容后，自己构造 text/html 的 Blob URL，绕开 Storage 的响应头限制。
        const { data: file, error: dlErr } = await supabase.storage
          .from('user-pages')
          .download(row.storage_path);
        if (dlErr || !file) { setNotFound(true); return; }
        htmlText = await file.text();
      } else {
        htmlText = row.html_content || '';
      }

      const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      revoke = url;
      setBlobUrl(url);
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [username, slug]);

  useEffect(() => { if (title) document.title = title; }, [title]);

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-2">
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="text-sm text-muted-foreground">页面不存在：/{username}/{slug}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const style = { position: 'fixed' as const, inset: 0, width: '100vw', height: '100vh', border: 'none' };
  return <iframe title={title} src={blobUrl} style={style} />;
}
