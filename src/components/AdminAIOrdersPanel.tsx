import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw, Upload, Sparkles, ImagePlus } from 'lucide-react';

interface Order {
  id: string;
  user_id: string;
  email: string;
  nickname: string | null;
  package_key: string;
  amount_cny: number;
  credits: number;
  pay_method: string;
  screenshot_url: string | null;
  payer_note: string | null;
  status: string;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface PaymentQR { wechat_url?: string; alipay_url?: string; note?: string; }

export default function AdminAIOrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [acting, setActing] = useState<string | null>(null);
  const [autoMatching, setAutoMatching] = useState<string | 'all' | null>(null);
  const [matchResults, setMatchResults] = useState<Record<string, { approved: boolean; reason: string; hint?: string; ocr_amount?: number | null; ocr_email?: string | null }>>({});
  const [qr, setQr] = useState<PaymentQR>({});
  const [savingQR, setSavingQR] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [retryOrder, setRetryOrder] = useState<Order | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const [retryNote, setRetryNote] = useState('');
  const [retryAmount, setRetryAmount] = useState<string>('');
  const [retryEmail, setRetryEmail] = useState<string>('');
  const [retrySubmitting, setRetrySubmitting] = useState(false);
  const retryPreviewUrl = useRef<string | null>(null);

  const openRetryDialog = (o: Order) => {
    setRetryOrder(o);
    setRetryFile(null);
    setRetryNote(o.payer_note || '');
    const prev = matchResults[o.id];
    setRetryAmount(prev?.ocr_amount != null ? String(prev.ocr_amount) : '');
    setRetryEmail(prev?.ocr_email || '');
    if (retryPreviewUrl.current) { URL.revokeObjectURL(retryPreviewUrl.current); retryPreviewUrl.current = null; }
  };

  const closeRetryDialog = () => {
    if (retryPreviewUrl.current) { URL.revokeObjectURL(retryPreviewUrl.current); retryPreviewUrl.current = null; }
    setRetryOrder(null);
    setRetryFile(null);
    setRetryNote('');
    setRetryAmount('');
    setRetryEmail('');
  };

  const submitRetry = async () => {
    if (!retryOrder) return;
    setRetrySubmitting(true);
    try {
      let newUrl: string | null = null;
      if (retryFile) {
        const ext = retryFile.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `retry/${retryOrder.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('payment-screenshots')
          .upload(path, retryFile, { upsert: true, contentType: retryFile.type });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from('payment-screenshots')
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        if (!signed?.signedUrl) throw new Error('生成签名链接失败');
        newUrl = signed.signedUrl;
      }
      const noteChanged = retryNote !== (retryOrder.payer_note || '');
      if (newUrl || noteChanged) {
        const { error } = await (supabase as any).rpc('admin_update_ai_credit_order_screenshot', {
          p_order_id: retryOrder.id,
          p_screenshot_url: newUrl,
          p_payer_note: noteChanged ? retryNote : null,
        });
        if (error) throw error;
      } else if (!retryFile) {
        // nothing changed, still allow re-run
      }
      const orderId = retryOrder.id;
      closeRetryDialog();
      await load();
      await autoMatch(orderId);
    } catch (e: any) {
      toast({ title: '提交失败', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setRetrySubmitting(false);
    }
  };

  const computeMissingNoteParts = (o: Order): { email: boolean; amount: boolean } => {
    const note = (o.payer_note || '').toLowerCase();
    return {
      email: !note.includes(o.email.toLowerCase()),
      amount: !new RegExp(`(^|[^0-9])${o.amount_cny}(\\.0+)?([^0-9]|$)`).test(note),
    };
  };

  const [quickFilling, setQuickFilling] = useState<string | null>(null);
  const quickFillNote = async (o: Order) => {
    const missing = computeMissingNoteParts(o);
    if (!missing.email && !missing.amount) {
      toast({ title: '备注已完整', description: '邮箱和金额都已存在，正在重新识别…' });
      await autoMatch(o.id);
      return;
    }
    const parts: string[] = [];
    if (o.payer_note && o.payer_note.trim()) parts.push(o.payer_note.trim());
    if (missing.email) parts.push(o.email);
    if (missing.amount) parts.push(`￥${o.amount_cny}`);
    const nextNote = parts.join(' · ').slice(0, 500);
    setQuickFilling(o.id);
    try {
      const { error } = await (supabase as any).rpc('admin_update_ai_credit_order_screenshot', {
        p_order_id: o.id,
        p_screenshot_url: null,
        p_payer_note: nextNote,
      });
      if (error) throw error;
      toast({ title: '备注已补充', description: nextNote });
      await load();
      await autoMatch(o.id);
    } catch (e: any) {
      toast({ title: '补充失败', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setQuickFilling(null);
    }
  };




  const autoMatch = async (orderId?: string) => {
    setAutoMatching(orderId || 'all');
    try {
      const { data, error } = await supabase.functions.invoke('auto-match-ai-orders', {
        body: orderId ? { order_id: orderId } : {},
      });
      if (error) throw error;
      const d = data as {
        scanned: number; approved: number;
        results: Array<{ id: string; email: string; approved: boolean; reason: string; hint?: string; ocr_amount?: number | null }>;
      };
      setMatchResults(prev => {
        const next = { ...prev };
        for (const r of d.results) next[r.id] = { approved: r.approved, reason: r.reason, hint: r.hint, ocr_amount: r.ocr_amount };
        return next;
      });
      const failed = d.results.filter(r => !r.approved);
      toast({
        title: `扫描 ${d.scanned} 单，自动通过 ${d.approved} 单`,
        description: failed.length
          ? `未通过 ${failed.length} 单，已在订单下方显示原因与补充建议`
          : '全部匹配成功',
      });
      void load();
    } catch (e: any) {
      toast({ title: '自动匹配失败', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setAutoMatching(null);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('admin_list_ai_credit_orders', {
      p_status: filter === 'all' ? null : filter,
    });
    if (error) toast({ title: '加载失败', description: error.message, variant: 'destructive' });
    else setOrders((data as Order[]) || []);
    setLoading(false);
  };

  const loadQR = async () => {
    const { data } = await (supabase as any).from('system_config').select('config').limit(1).single();
    setQr((data as any)?.config?.paymentQR || {});
  };

  useEffect(() => { void load(); }, [filter]);
  useEffect(() => { void loadQR(); }, []);

  const uploadQR = async (method: 'wechat' | 'alipay', file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `admin-qr/${method}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('payment-screenshots')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast({ title: '上传失败', description: upErr.message, variant: 'destructive' }); return; }
    const { data: signed } = await supabase.storage.from('payment-screenshots')
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (!signed?.signedUrl) { toast({ title: '生成链接失败', variant: 'destructive' }); return; }
    setQr(prev => ({ ...prev, [method === 'wechat' ? 'wechat_url' : 'alipay_url']: signed.signedUrl }));
  };

  const saveQR = async () => {
    setSavingQR(true);
    // Fetch current config, merge paymentQR, upsert.
    const { data } = await (supabase as any).from('system_config').select('id, config').limit(1).single();
    const current = (data as any)?.config || {};
    const nextConfig = { ...current, paymentQR: qr };
    const { error } = await (supabase as any).from('system_config')
      .update({ config: nextConfig }).eq('id', (data as any).id);
    setSavingQR(false);
    if (error) toast({ title: '保存失败', description: error.message, variant: 'destructive' });
    else toast({ title: '收款码已保存' });
  };

  const approve = async (id: string) => {
    setActing(id);
    const { error } = await (supabase as any).rpc('admin_approve_ai_credit_order', { p_order_id: id });
    setActing(null);
    if (error) toast({ title: '操作失败', description: error.message, variant: 'destructive' });
    else { toast({ title: '已通过，算力已发放' }); void load(); }
  };

  const reject = async (id: string) => {
    const reason = window.prompt('拒绝原因？', '付款截图不匹配') || '';
    setActing(id);
    const { error } = await (supabase as any).rpc('admin_reject_ai_credit_order', {
      p_order_id: id, p_reason: reason,
    });
    setActing(null);
    if (error) toast({ title: '操作失败', description: error.message, variant: 'destructive' });
    else { toast({ title: '已拒绝' }); void load(); }
  };

  return (
    <div className="space-y-4">
      {/* QR configuration */}
      <section className="p-3 border border-border rounded-lg bg-card space-y-3">
        <h3 className="text-sm font-semibold">收款二维码配置</h3>
        <div className="grid grid-cols-2 gap-3">
          {(['wechat', 'alipay'] as const).map(m => {
            const url = m === 'wechat' ? qr.wechat_url : qr.alipay_url;
            return (
              <div key={m} className="space-y-2">
                <div className="text-xs text-muted-foreground">{m === 'wechat' ? '微信' : '支付宝'}收款码</div>
                {url ? (
                  <img src={url} alt="" className="w-32 h-32 object-contain border border-border rounded bg-white p-1" />
                ) : (
                  <div className="w-32 h-32 border border-dashed border-border rounded flex items-center justify-center text-xs text-muted-foreground">未上传</div>
                )}
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer text-primary">
                  <Upload className="w-3 h-3" /> 上传
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) void uploadQR(m, f); }} />
                </label>
              </div>
            );
          })}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">支付备注（展示给用户）</label>
          <Textarea rows={2} value={qr.note || ''} onChange={e => setQr(prev => ({ ...prev, note: e.target.value }))} className="text-xs mt-1" />
        </div>
        <Button size="sm" onClick={saveQR} disabled={savingQR}>
          {savingQR && <Loader2 className="w-3 h-3 animate-spin mr-1" />}保存收款码
        </Button>
      </section>

      {/* Orders */}
      <section className="p-3 border border-border rounded-lg bg-card">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold flex-1">充值订单</h3>
          <Button size="sm" variant="default" onClick={() => autoMatch()} disabled={autoMatching !== null} className="h-7 text-xs gap-1">
            {autoMatching === 'all' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI 自动匹配
          </Button>
          <Button size="sm" variant="ghost" onClick={() => load()} className="h-7 text-xs gap-1">
            <RefreshCw className="w-3 h-3" /> 刷新
          </Button>
        </div>
        <div className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
          自动匹配：OCR 识别付款截图金额，与套餐价格（￥10=100次 / ￥20=300次）比对，匹配成功自动到账。
        </div>
        <div className="flex gap-1 mb-3">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(k => (
            <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} className="h-7 text-xs"
              onClick={() => setFilter(k)}>
              {k === 'pending' ? '待审' : k === 'approved' ? '已通过' : k === 'rejected' ? '已拒绝' : '全部'}
            </Button>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6">暂无订单</div>
        ) : (
          <div className="space-y-2">
            {orders.map(o => (
              <div key={o.id} className="p-2 border border-border rounded bg-muted/20 text-xs">
                <div className="flex items-start gap-2">
                  {o.screenshot_url && (
                    <img src={o.screenshot_url} alt="付款截图"
                      onClick={() => setPreview(o.screenshot_url)}
                      className="w-14 h-14 object-cover rounded border border-border cursor-pointer" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{o.nickname || o.email}</span>
                      <span className="text-muted-foreground">{o.email}</span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      ￥{o.amount_cny} · {o.credits}次 · {o.pay_method === 'wechat' ? '微信' : '支付宝'} · {new Date(o.created_at).toLocaleString()}
                    </div>
                    {o.payer_note && <div className="mt-0.5">备注：{o.payer_note}</div>}
                    {o.reject_reason && <div className="mt-0.5 text-destructive">拒绝原因：{o.reject_reason}</div>}
                    {matchResults[o.id] && !matchResults[o.id].approved && (() => {
                      const missing = computeMissingNoteParts(o);
                      const canQuickFill = missing.email || missing.amount;
                      const missingLabels = [
                        missing.email ? `邮箱 ${o.email}` : null,
                        missing.amount ? `金额 ￥${o.amount_cny}` : null,
                      ].filter(Boolean).join('、');
                      return (
                        <div className="mt-1 p-1.5 rounded bg-warning/10 border border-warning/30 text-[11px] text-warning-foreground/90 space-y-1">
                          <div className="font-medium text-warning">识别未通过：{matchResults[o.id].reason}</div>
                          {matchResults[o.id].hint && <div className="text-muted-foreground">补充建议：{matchResults[o.id].hint}</div>}
                          {canQuickFill && (
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              <span className="text-muted-foreground">缺失：{missingLabels}</span>
                              <Button size="sm" variant="secondary" className="h-6 text-[11px] px-2 gap-1"
                                onClick={() => quickFillNote(o)}
                                disabled={quickFilling === o.id || autoMatching !== null}>
                                {quickFilling === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                一键补充并重试
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {matchResults[o.id]?.approved && (
                      <div className="mt-1 text-[11px] text-success">✓ AI 已自动通过：{matchResults[o.id].reason}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {o.status === 'pending' ? (
                      <>
                        <Button size="sm" className="h-6 text-[11px] px-2 gap-1" onClick={() => approve(o.id)} disabled={acting === o.id}>
                          <CheckCircle2 className="w-3 h-3" />通过
                        </Button>
                        <Button size="sm" variant="secondary" className="h-6 text-[11px] px-2 gap-1"
                          onClick={() => (matchResults[o.id] && !matchResults[o.id].approved) ? openRetryDialog(o) : autoMatch(o.id)}
                          disabled={autoMatching !== null}>
                          {autoMatching === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {matchResults[o.id] && !matchResults[o.id].approved ? '重试识别' : '智能'}
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 gap-1 text-destructive border-destructive/30"
                          onClick={() => reject(o.id)} disabled={acting === o.id}>
                          <XCircle className="w-3 h-3" />拒绝
                        </Button>
                      </>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        o.status === 'approved' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                      }`}>
                        {o.status === 'approved' ? <><CheckCircle2 className="w-3 h-3" />已通过</> : <><XCircle className="w-3 h-3" />已拒绝</>}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="付款截图" className="max-w-full max-h-full rounded" />
        </div>
      )}

      <Dialog open={!!retryOrder} onOpenChange={(v) => { if (!v) closeRetryDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重试识别 · 补充付款信息</DialogTitle>
            <DialogDescription className="text-xs">
              上传更清晰的付款截图，或补充邮箱/金额备注，保存后自动重新执行 OCR 匹配。
            </DialogDescription>
          </DialogHeader>
          {retryOrder && (
            <div className="space-y-3 text-xs">
              <div className="p-2 rounded bg-muted/40 space-y-0.5">
                <div><span className="text-muted-foreground">用户：</span>{retryOrder.nickname || retryOrder.email}（{retryOrder.email}）</div>
                <div><span className="text-muted-foreground">应付：</span>￥{retryOrder.amount_cny} · {retryOrder.credits}次 · {retryOrder.pay_method === 'wechat' ? '微信' : '支付宝'}</div>
                {matchResults[retryOrder.id] && !matchResults[retryOrder.id].approved && (
                  <>
                    <div className="text-warning">上次失败：{matchResults[retryOrder.id].reason}</div>
                    {matchResults[retryOrder.id].hint && (
                      <div className="text-muted-foreground">建议：{matchResults[retryOrder.id].hint}</div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">付款截图（可选，覆盖原截图）</label>
                <div className="flex items-start gap-2">
                  {(retryFile || retryOrder.screenshot_url) && (
                    <img
                      src={retryFile ? (retryPreviewUrl.current || '') : (retryOrder.screenshot_url as string)}
                      alt=""
                      className="w-20 h-20 object-cover rounded border border-border"
                    />
                  )}
                  <label className="inline-flex items-center gap-1 text-primary cursor-pointer border border-dashed border-primary/40 rounded px-2 py-1.5">
                    <ImagePlus className="w-3 h-3" /> 选择新截图
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (retryPreviewUrl.current) URL.revokeObjectURL(retryPreviewUrl.current);
                        retryPreviewUrl.current = URL.createObjectURL(f);
                        setRetryFile(f);
                      }} />
                  </label>
                </div>
                <div className="text-[10px] text-muted-foreground">要点：￥金额清晰可见、包含付款时间、避免遮挡。</div>
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">付款备注（含邮箱与金额可提升识别成功率）</label>
                <Textarea rows={3} value={retryNote} onChange={e => setRetryNote(e.target.value)}
                  placeholder={`例如：${retryOrder.email} 充值 ￥${retryOrder.amount_cny}`} className="text-xs" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={closeRetryDialog} disabled={retrySubmitting}>取消</Button>
            <Button size="sm" onClick={submitRetry} disabled={retrySubmitting}>
              {retrySubmitting && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              保存并重新识别
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
