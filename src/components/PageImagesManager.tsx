import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  MAX_PAGE_IMAGE_BYTES,
  getPageImageStoragePath,
  getPageImagesFolder,
  isSupportedPageImage,
  normalizePageImageName,
} from '@/lib/page-slug';
import { ImagePlus, Trash2, Copy, Check, Link2 } from 'lucide-react';

interface PageImage {
  name: string;
  size: number;
  url: string;
}

export default function PageImagesManager({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const [images, setImages] = useState<PageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const publicUrl = useCallback(
    (name: string) =>
      supabase.storage.from('user-pages').getPublicUrl(getPageImageStoragePath(userId, name)).data.publicUrl,
    [userId],
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase.storage
      .from('user-pages')
      .list(getPageImagesFolder(userId), { limit: 200, sortBy: { column: 'name', order: 'asc' } });
    if (error) {
      setLoading(false);
      return;
    }
    setImages(
      (data || [])
        .filter((f) => f.name && f.name !== '.emptyFolderPlaceholder')
        .map((f) => ({ name: f.name, size: (f as any).metadata?.size || 0, url: publicUrl(f.name) })),
    );
    setLoading(false);
  }, [userId, publicUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });

    let ok = 0;
    try {
      for (const file of files) {
        if (!isSupportedPageImage(file.name)) {
          toast({ title: `不支持的图片格式：${file.name}`, description: '支持 png/jpg/gif/webp/svg/avif/bmp/ico', variant: 'destructive' });
          continue;
        }
        if (file.size > MAX_PAGE_IMAGE_BYTES) {
          toast({ title: `图片过大：${file.name}`, description: '单张图片不超过 5MB', variant: 'destructive' });
          continue;
        }
        const name = normalizePageImageName(file.name);
        const { error } = await supabase.storage
          .from('user-pages')
          .upload(getPageImageStoragePath(userId, name), file, {
            upsert: true,
            contentType: file.type || undefined,
            cacheControl: '3600',
          });
        if (error) {
          toast({ title: `上传失败：${file.name}`, description: error.message, variant: 'destructive' });
          continue;
        }
        ok += 1;
        setProgress({ done: ok, total: files.length });
      }
      if (ok > 0) {
        toast({ title: `已上传 ${ok} 张图片`, description: '在 HTML 中用 images/文件名 引用即可' });
        await load();
      }
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    void uploadFiles(Array.from(e.target.files || []));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/') || isSupportedPageImage(f.name));
    if (files.length === 0) {
      toast({ title: '没有可上传的图片', description: '请拖入 png/jpg/gif/webp/svg 等图片文件', variant: 'destructive' });
      return;
    }
    void uploadFiles(files);
  };


  const remove = async (img: PageImage) => {
    if (!confirm(`删除图片 images/${img.name} ？引用它的页面将无法显示该图片。`)) return;
    const { error } = await supabase.storage.from('user-pages').remove([getPageImageStoragePath(userId, img.name)]);
    if (error) {
      toast({ title: '删除失败', description: error.message, variant: 'destructive' });
      return;
    }
    setImages((prev) => prev.filter((p) => p.name !== img.name));
  };

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="mb-8 p-4 rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium">图片资源 images/（{images.length}）</h2>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <Button size="sm" variant="outline" className="gap-2" disabled={disabled || uploading} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="w-4 h-4" />
          {uploading ? (progress ? `上传中 ${progress.done}/${progress.total}…` : '上传中…') : '上传图片'}
        </Button>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !uploading) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !uploading && fileRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`mb-3 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        } ${disabled || uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <ImagePlus className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
        <p className="text-sm">{dragging ? '松开即可上传' : '把图片拖到这里，或点击选择（支持一次多张）'}</p>
        {uploading && progress && (
          <p className="text-xs text-muted-foreground mt-1">正在上传 {progress.done}/{progress.total}</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        上传后在 HTML 里直接写相对路径，例如 <code className="px-1 py-0.5 bg-muted rounded">&lt;img src="images/logo.png"&gt;</code>，页面发布后会自动指向你的图片目录。图片为所有页面共用。
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有上传图片。</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img) => (
            <div key={img.name} className="rounded-lg border border-border overflow-hidden bg-background">
              <img src={img.url} alt={img.name} loading="lazy" className="w-full h-24 object-cover bg-muted" />
              <div className="p-2">
                <div className="text-xs font-mono truncate" title={img.name}>images/{img.name}</div>
                <div className="flex items-center gap-1 mt-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => copy(`rel-${img.name}`, `images/${img.name}`)} title="复制相对路径">
                    {copied === `rel-${img.name}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}路径
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => copy(`abs-${img.name}`, img.url)} title="复制完整链接">
                    {copied === `abs-${img.name}` ? <Check className="w-3 h-3 text-green-600" /> : <Link2 className="w-3 h-3" />}链接
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 ml-auto" onClick={() => remove(img)} title="删除">
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
