import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { normalizeHtmlFileToUtf8 } from '@/lib/html-normalize';
import { Upload, Trash2, ExternalLink, Copy, Check, ArrowLeft, Globe, Lock, Eye } from 'lucide-react';

interface UserPage {
  id: string;
  username: string;
  slug: string;
  title: string;
  is_public: boolean;
  updated_at: string;
  html_content?: string;
}

// 支持中文/Unicode 字母、数字、- 和 _；首尾不能是 - 或 _
const SLUG_RE = /^[\p{L}\p{N}](?:[\p{L}\p{N}_-]*[\p{L}\p{N}])?$/u;

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .replace(/\.(html?|HTM L?)$/i, '')
    .replace(/\s+/g, '-')
    // 仅对 ASCII 字母转小写，保留中文等 Unicode 原样
    .replace(/[A-Z]/g, (c) => c.toLowerCase());
}

export default function PagesManager() {
  const { user, loading: authLoading, approvalStatus } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [pages, setPages] = useState<UserPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [slugInput, setSlugInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    (async () => {
      const { data: uname } = await supabase.rpc('get_my_username');
      setUsername((uname as string) || null);
      const { data: rows } = await supabase
        .from('user_pages')
        .select('id, username, slug, title, is_public, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      setPages((rows as UserPage[]) || []);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const saveUsername = async () => {
    const v = usernameInput.trim().toLowerCase();
    if (!v) return;
    const { error } = await supabase.rpc('set_my_username', { p_username: v });
    if (error) {
      toast({ title: '用户名设置失败', description: error.message, variant: 'destructive' });
      return;
    }
    setUsername(v);
    toast({ title: '用户名已设置', description: `你的发布前缀：/${v}` });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !username) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'html' && ext !== 'htm') {
      toast({ title: '只支持 .html / .htm 文件', variant: 'destructive' });
      return;
    }
    const slug = normalizeSlug(slugInput || file.name);
    if (!SLUG_RE.test(slug) || [...slug].length < 2 || [...slug].length > 64) {
      toast({ title: '页面名不合法', description: '支持中文、英文字母、数字、- 和 _，长度 2-64', variant: 'destructive' });
      return;
    }
    // 重名检查：提示用户修改后再上传，不再静默覆盖
    const duplicate = pages.find((p) => p.slug === slug);
    if (duplicate) {
      toast({
        title: '文件名重复',
        description: `已存在同名页面 /${duplicate.username}/${duplicate.slug}，请修改"页面名 (slug)"后重新上传，或先在下方列表中删除原页面。`,
        variant: 'destructive',
      });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const html = await normalizeHtmlFileToUtf8(file);
      // 存储路径对中文等非 ASCII 字符做 URL 编码，避免 Supabase Storage key 限制
      const safeKey = encodeURIComponent(slug);
      const storagePath = `${user.id}/${safeKey}.html`;
      const htmlBlob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const { error: upErr } = await supabase.storage
        .from('user-pages')
        .upload(storagePath, htmlBlob, {
          upsert: true,
          contentType: 'text/html; charset=utf-8',
          cacheControl: '60',
        });
      if (upErr) throw upErr;

      const payload = {
        user_id: user.id,
        username,
        slug,
        title: titleInput.trim() || slug,
        storage_path: storagePath,
        html_content: null as string | null,
        is_public: true,
      };
      const { data: existing } = await supabase
        .from('user_pages')
        .select('id')
        .eq('user_id', user.id)
        .eq('slug', slug)
        .maybeSingle();
      let saved: UserPage | null = null;
      if (existing?.id) {
        const { data: updated, error: e2 } = await supabase
          .from('user_pages')
          .update(payload)
          .eq('id', existing.id)
          .select('id, username, slug, title, is_public, updated_at')
          .single();
        if (e2) throw e2;
        saved = updated as UserPage;
      } else {
        const { data: inserted, error: e3 } = await supabase
          .from('user_pages')
          .insert(payload)
          .select('id, username, slug, title, is_public, updated_at')
          .single();
        if (e3) throw e3;
        saved = inserted as UserPage;
      }
      if (saved) {
        setPages((prev) => [saved!, ...prev.filter((p) => p.id !== saved!.id)]);
      }
      setSlugInput('');
      setTitleInput('');
      toast({ title: '发布成功', description: `/${username}/${slug}` });
    } catch (err: any) {
      toast({ title: '发布失败', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const togglePublic = async (page: UserPage) => {
    const { error } = await supabase
      .from('user_pages')
      .update({ is_public: !page.is_public })
      .eq('id', page.id);
    if (error) { toast({ title: '更新失败', description: error.message, variant: 'destructive' }); return; }
    setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, is_public: !p.is_public } : p)));
  };

  const deletePage = async (page: UserPage) => {
    if (!confirm(`删除页面 /${page.username}/${page.slug} ？`)) return;
    const { error } = await supabase.from('user_pages').delete().eq('id', page.id);
    if (error) { toast({ title: '删除失败', description: error.message, variant: 'destructive' }); return; }
    setPages((prev) => prev.filter((p) => p.id !== page.id));
  };

  const pageUrl = (p: UserPage) => `${window.location.origin}/${p.username}/${p.slug}`;
  const copyUrl = async (p: UserPage) => {
    await navigator.clipboard.writeText(pageUrl(p));
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const notApproved = approvalStatus && approvalStatus !== 'approved';

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/')} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 返回主页
        </button>
        <h1 className="text-2xl font-semibold mb-1">Page 发布</h1>
        <p className="text-sm text-muted-foreground mb-6">上传 HTML 文件，以 <code className="px-1 py-0.5 bg-muted rounded">/{username || '用户名'}/页面名</code> 形式公开访问，类似 GitHub Pages。</p>

        {notApproved && (
          <div className="mb-6 p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-sm">
            你的账户尚未通过审核，请等待管理员审核后再发布。
          </div>
        )}

        {/* 用户名设置 */}
        <section className="mb-8 p-4 rounded-lg border border-border bg-card">
          <h2 className="text-sm font-medium mb-2">发布用户名</h2>
          {username ? (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-primary" />
              <span className="font-mono">{window.location.origin}/<b>{username}</b>/…</span>
              <span className="text-xs text-muted-foreground">（已锁定，如需修改请联系管理员）</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="3-32 位小写字母、数字、- 或 _"
                className="max-w-xs h-9"
              />
              <Button size="sm" onClick={saveUsername} disabled={!usernameInput.trim()}>设置用户名</Button>
            </div>
          )}
        </section>

        {/* 上传新页面 */}
        {username && !notApproved && (
          <section className="mb-8 p-4 rounded-lg border border-border bg-card">
            <h2 className="text-sm font-medium mb-3">上传 / 更新页面</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-muted-foreground">页面名 (slug)</label>
                <Input value={slugInput} onChange={(e) => setSlugInput(e.target.value.toLowerCase())} placeholder="例如：about、portfolio" className="h-9" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">标题（可选）</label>
                <Input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} placeholder="浏览器标签显示的标题" className="h-9" />
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" onChange={handleUpload} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
              <Upload className="w-4 h-4" /> {uploading ? '上传中…' : '选择 HTML 文件并发布'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">上传后会自动识别 GBK/GB2312/UTF-8 编码并转换为 UTF-8，确保中文正常显示。同名 slug 会被覆盖更新。</p>
          </section>
        )}

        {/* 页面列表 */}
        <section>
          <h2 className="text-sm font-medium mb-3">我的页面（{pages.length}）</h2>
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有发布任何页面。</p>
          ) : (
            <div className="space-y-2">
              {pages.map((p) => (
                <div key={p.id} className="p-3 rounded-lg border border-border bg-card flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium text-sm truncate">{p.title || p.slug}</div>
                    <div className="text-xs font-mono text-muted-foreground truncate">/{p.username}/{p.slug}</div>
                  </div>
                  <button onClick={() => togglePublic(p)} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted">
                    {p.is_public ? <><Globe className="w-3 h-3 text-green-600" />公开</> : <><Lock className="w-3 h-3" />私密</>}
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => copyUrl(p)} title="复制链接">
                    {copiedId === p.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <a href={pageUrl(p)} target="_blank" rel="noreferrer" className="inline-flex">
                    <Button variant="ghost" size="sm" title="新标签打开"><ExternalLink className="w-4 h-4" /></Button>
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => deletePage(p)} title="删除">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
