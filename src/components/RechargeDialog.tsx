import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AI_CREDIT_PACKAGES, type AICreditPackageKey } from '@/lib/ai-credit-packages';
import { Loader2, Upload, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOrderSubmitted?: () => void;
}

interface PaymentQR {
  wechat_url?: string;
  alipay_url?: string;
  note?: string;
}

interface MyOrder {
  id: string;
  package_key: string;
  amount_cny: number;
  credits: number;
  pay_method: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
}

export default function RechargeDialog({ open, onOpenChange, onOrderSubmitted }: Props) {
  const { user, nickname } = useAuth();
  const [qr, setQr] = useState<PaymentQR>({});
  const [method, setMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [selectedPack, setSelectedPack] = useState<AICreditPackageKey>('p20_300');
  const [file, setFile] = useState<File | null>(null);
  const [payerNote, setPayerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MyOrder[]>([]);

  useEffect(() => {
    if (!open) return;
    // Load QR codes
    (async () => {
      const { data } = await (supabase as any)
        .from('system_config').select('config').limit(1).single();
      const paymentQR = (data as any)?.config?.paymentQR || {};
      setQr(paymentQR);
    })();
    // Load my orders
    loadOrders();
    setPayerNote(nickname || user?.email || '');
  }, [open]);

  const loadOrders = async () => {
    const { data } = await (supabase as any).rpc('get_my_ai_credit_orders');
    setOrders((data as MyOrder[]) || []);
  };

  const activeQR = method === 'wechat' ? qr.wechat_url : qr.alipay_url;
  const pack = useMemo(() => AI_CREDIT_PACKAGES.find(p => p.key === selectedPack)!, [selectedPack]);

  const handleSubmit = async () => {
    if (!user) { toast({ title: '请先登录', variant: 'destructive' }); return; }
    if (!file) { toast({ title: '请上传付款截图', variant: 'destructive' }); return; }
    if (!activeQR) { toast({ title: '收款码尚未配置，请联系管理员', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('payment-screenshots').upload(path, file, { upsert: false, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: signedData } = await supabase.storage
        .from('payment-screenshots').createSignedUrl(path, 60 * 60 * 24 * 30);
      const screenshotUrl = signedData?.signedUrl || path;

      const { error } = await (supabase as any).rpc('create_ai_credit_order', {
        p_package_key: selectedPack,
        p_pay_method: method,
        p_screenshot_url: screenshotUrl,
        p_payer_note: payerNote,
      });
      if (error) throw error;
      toast({ title: '订单已提交', description: '管理员审核通过后算力将自动到账' });
      setFile(null);
      await loadOrders();
      onOrderSubmitted?.();
    } catch (e: any) {
      toast({ title: '提交失败', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusChip = (s: string) => {
    if (s === 'approved') return <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-success/10 text-success"><CheckCircle2 className="w-3 h-3" />已到账</span>;
    if (s === 'rejected') return <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive"><XCircle className="w-3 h-3" />已拒绝</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning"><Clock className="w-3 h-3" />审核中</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI 算力充值</DialogTitle>
          <DialogDescription>选择套餐 → 扫码付款 → 上传截图 → 管理员审核后自动到账（当月有效）。</DialogDescription>
        </DialogHeader>

        {/* Package selection */}
        <div className="grid grid-cols-2 gap-2">
          {AI_CREDIT_PACKAGES.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelectedPack(p.key)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedPack === p.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{p.label}</span>
                {p.highlight && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">推荐</span>}
              </div>
              <div className="mt-1 text-2xl font-bold text-foreground">￥{p.price}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{p.credits} 次 AI 调用</div>
            </button>
          ))}
        </div>

        {/* Payment method */}
        <div className="flex gap-1 mt-2">
          <Button size="sm" variant={method === 'wechat' ? 'default' : 'outline'} className="flex-1 h-8 text-xs" onClick={() => setMethod('wechat')}>微信支付</Button>
          <Button size="sm" variant={method === 'alipay' ? 'default' : 'outline'} className="flex-1 h-8 text-xs" onClick={() => setMethod('alipay')}>支付宝</Button>
        </div>

        <div className="flex flex-col items-center gap-2 py-2">
          {activeQR ? (
            <img src={activeQR} alt="收款二维码" className="w-48 h-48 object-contain border border-border rounded-lg bg-white p-2" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center border border-dashed border-border rounded-lg text-xs text-muted-foreground">
              收款码尚未配置
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            请扫码支付 <span className="text-foreground font-medium">￥{pack.price}</span> 并在下方上传截图
          </p>
          {qr.note && <p className="text-[11px] text-muted-foreground text-center whitespace-pre-wrap">{qr.note}</p>}
        </div>

        {/* Upload */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">付款截图</label>
          <div className="flex items-center gap-2">
            <Input
              type="file" accept="image/*"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="text-xs"
            />
            {file && <Upload className="w-4 h-4 text-success" />}
          </div>
          <label className="text-xs text-muted-foreground">备注（昵称/手机尾号，方便核对）</label>
          <Textarea rows={2} value={payerNote} onChange={e => setPayerNote(e.target.value)} className="text-xs" />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>关闭</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !file}>
            {submitting && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            提交订单
          </Button>
        </DialogFooter>

        {/* My orders */}
        {orders.length > 0 && (
          <div className="mt-2 border-t border-border pt-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">我的订单</h4>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">￥{o.amount_cny} · {o.credits}次</span>
                      {statusChip(o.status)}
                    </div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">
                      {new Date(o.created_at).toLocaleString()}
                      {o.reject_reason && <span className="text-destructive ml-1">· {o.reject_reason}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
