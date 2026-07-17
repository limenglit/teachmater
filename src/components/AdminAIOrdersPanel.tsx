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
  const [matchResults, setMatchResults] = useState<Record<string, { approved: boolean; reason: string; hint?: string; ocr_amount?: number | null }>>({});
  const [qr, setQr] = useState<PaymentQR>({});
  const [savingQR, setSavingQR] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

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
                    {matchResults[o.id] && !matchResults[o.id].approved && (
                      <div className="mt-1 p-1.5 rounded bg-warning/10 border border-warning/30 text-[11px] text-warning-foreground/90 space-y-0.5">
                        <div className="font-medium text-warning">识别未通过：{matchResults[o.id].reason}</div>
                        {matchResults[o.id].hint && <div className="text-muted-foreground">补充建议：{matchResults[o.id].hint}</div>}
                      </div>
                    )}
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
                          onClick={() => autoMatch(o.id)} disabled={autoMatching !== null}>
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
    </div>
  );
}
