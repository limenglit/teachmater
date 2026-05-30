import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function UserPageView() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const [html, setHtml] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username || !slug) return;
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
      if (row.storage_path) {
        const { data: pub } = supabase.storage.from('user-pages').getPublicUrl(row.storage_path);
        setSrc(pub.publicUrl);
      } else {
        setHtml(row.html_content || '');
      }
    })();
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

  if (html === null && src === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const sandbox = 'allow-scripts allow-forms allow-popups allow-same-origin allow-modals allow-downloads';
  const style = { position: 'fixed' as const, inset: 0, width: '100vw', height: '100vh', border: 'none' };
  return src
    ? <iframe title={title} src={src} sandbox={sandbox} style={style} />
    : <iframe title={title} srcDoc={html!} sandbox={sandbox} style={style} />;
}
