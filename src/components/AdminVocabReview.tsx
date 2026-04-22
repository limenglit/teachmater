import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, XCircle, Eye, Clock, BookOpen } from 'lucide-react';
import {
  listPendingSets, approveSet, rejectSet, loadCards, audienceLabel,
  type PendingSetRow, type VocabCard,
} from '@/lib/vocab-cloud';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export default function AdminVocabReview() {
  const [list, setList] = useState<PendingSetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [previewSet, setPreviewSet] = useState<PendingSetRow | null>(null);
  const [previewCards, setPreviewCards] = useState<VocabCard[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rejectingSet, setRejectingSet] = useState<PendingSetRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listPendingSets();
      setList(rows);
    } catch (e: any) {
      toast.error('加载失败：' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPreview = async (s: PendingSetRow) => {
    setPreviewSet(s);
    setPreviewLoading(true);
    try {
      const cards = await loadCards(s.id);
      setPreviewCards(cards);
    } catch (e: any) {
      toast.error('加载知识点失败：' + (e.message || ''));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApprove = async (s: PendingSetRow) => {
    setActing(s.id);
    try {
      await approveSet(s.id);
      toast.success(`已通过：${s.title}`);
      setList(prev => prev.filter(r => r.id !== s.id));
      if (previewSet?.id === s.id) setPreviewSet(null);
    } catch (e: any) {
      toast.error('操作失败：' + (e.message || ''));
    } finally {
      setActing(null);
    }
  };

  const submitReject = async () => {
    if (!rejectingSet) return;
    setActing(rejectingSet.id);
    try {
      await rejectSet(rejectingSet.id, rejectReason.trim() || '内容不符合要求');
      toast.success(`已拒绝：${rejectingSet.title}`);
      setList(prev => prev.filter(r => r.id !== rejectingSet.id));
      if (previewSet?.id === rejectingSet.id) setPreviewSet(null);
      setRejectingSet(null);
      setRejectReason('');
    } catch (e: any) {
      toast.error('操作失败：' + (e.message || ''));
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-warning" /> 待审核词库 ({list.length})
        </h2>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-xs">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '刷新'}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin inline-block" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">暂无待审核词库</div>
      ) : (
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className="border border-border rounded-lg p-3 bg-card">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-sm text-foreground">{s.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {audienceLabel(s.audience)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{s.card_count} 项</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    创建者：{s.author_name || s.author_email || '未知'}
                    {' · '}
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openPreview(s)} className="h-7 text-xs gap-1">
                    <Eye className="w-3 h-3" /> 预览
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(s)}
                    disabled={acting === s.id}
                    className="h-7 text-xs gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> 通过
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setRejectingSet(s); setRejectReason(''); }}
                    disabled={acting === s.id}
                    className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                  >
                    <XCircle className="w-3 h-3" /> 拒绝
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewSet} onOpenChange={v => !v && setPreviewSet(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewSet?.title}</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-5 h-5 animate-spin inline-block" />
            </div>
          ) : (
            <div className="space-y-2">
              {previewCards.map((c, i) => (
                <div key={c.id} className="text-sm border border-border rounded p-2 bg-muted/40">
                  <div className="text-xs text-muted-foreground">#{i + 1}</div>
                  <div className="font-medium text-foreground">{c.word}</div>
                  <div className="text-muted-foreground">{c.definition}</div>
                  {c.example && <div className="text-xs italic text-muted-foreground mt-1">"{c.example}"</div>}
                </div>
              ))}
            </div>
          )}
          {previewSet && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectingSet(previewSet); setRejectReason(''); }}>
                <XCircle className="w-4 h-4 mr-1" /> 拒绝
              </Button>
              <Button onClick={() => handleApprove(previewSet)}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> 通过
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectingSet} onOpenChange={v => !v && setRejectingSet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝原因</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="请填写拒绝原因，作者将看到该原因并可修改后重新提交"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectingSet(null)}>取消</Button>
            <Button onClick={submitReject} disabled={acting === rejectingSet?.id} className="bg-destructive hover:bg-destructive/90">
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
