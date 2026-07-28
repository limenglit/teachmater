import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Download, Loader2, Search, Trash2, X } from 'lucide-react';
import {
  AIImageHistoryRecord,
  deleteAIImageHistory,
  downloadAIImage,
  getAIImageUrl,
  listAIImageHistory,
} from '@/lib/ai-image-history';

interface Props {
  refreshKey?: number;
  onClose?: () => void;
  onReuse?: (record: AIImageHistoryRecord, url: string) => void;
}

export default function AIImageHistoryPanel({ refreshKey = 0, onClose, onReuse }: Props) {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AIImageHistoryRecord[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const load = useCallback(async (kw: string) => {
    setLoading(true);
    try {
      const rows = await listAIImageHistory(kw);
      setItems(rows);
      const entries = await Promise.all(
        rows.map(async r => {
          try {
            return [r.id, await getAIImageUrl(r.storage_path)] as const;
          } catch {
            return [r.id, ''] as const;
          }
        }),
      );
      setUrls(Object.fromEntries(entries));
    } catch {
      toast({ title: '加载历史记录失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(keyword); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);

  const handleDelete = async (record: AIImageHistoryRecord) => {
    try {
      await deleteAIImageHistory(record);
      setItems(prev => prev.filter(i => i.id !== record.id));
      toast({ title: '已删除' });
    } catch {
      toast({ title: '删除失败', variant: 'destructive' });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load(keyword); }}
            placeholder="按标题 / 提示词 / 样式搜索"
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => load(keyword)} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '查询'}
        </Button>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} className="px-2">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {items.length === 0 && !loading ? (
        <p className="text-xs text-muted-foreground py-6 text-center">暂无生图记录</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[60vh] overflow-auto">
          {items.map(item => (
            <div key={item.id} className="border border-border rounded-lg overflow-hidden bg-background">
              <button
                type="button"
                className="block w-full aspect-square bg-muted/40"
                onClick={() => urls[item.id] && onReuse?.(item, urls[item.id])}
              >
                {urls[item.id] ? (
                  <img src={urls[item.id]} alt={item.title || 'AI 生成图'} className="w-full h-full object-contain" loading="lazy" />
                ) : (
                  <span className="text-[11px] text-muted-foreground">图片不可用</span>
                )}
              </button>
              <div className="p-2 space-y-1">
                <p className="text-[11px] font-medium truncate" title={item.prompt}>
                  {item.title || item.sub_style || 'AI 生成图'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(item.created_at).toLocaleString()} · {item.size}
                </p>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 flex-1"
                    onClick={() => downloadAIImage(item).catch(() => toast({ title: '下载失败', variant: 'destructive' }))}>
                    <Download className="w-3 h-3" /> 下载
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => handleDelete(item)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
