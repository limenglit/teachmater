import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, CheckCircle2, Clock, XCircle, Loader2, Receipt } from 'lucide-react';
import RechargeDialog from '@/components/RechargeDialog';

interface MyOrder {
  id: string;
  package_key: string;
  amount_cny: number;
  credits: number;
  pay_method: string;
  status: string;
  reject_reason: string | null;
  screenshot_url: string | null;
  payer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const statusChip = (s: string) => {
  if (s === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-success/10 text-success">
        <CheckCircle2 className="w-3.5 h-3.5" />已到账
      </span>
    );
  }
  if (s === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
        <XCircle className="w-3.5 h-3.5" />失败
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-warning/10 text-warning">
      <Clock className="w-3.5 h-3.5" />待审核
    </span>
  );
};

export default function MyRechargeOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).rpc('get_my_ai_credit_orders');
    setOrders((data as MyOrder[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    void load();
  }, [user, authLoading]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-1" />返回
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />刷新
            </Button>
            <Button size="sm" onClick={() => setRechargeOpen(true)}>
              <Receipt className="w-4 h-4 mr-1" />新充值
            </Button>
          </div>
        </div>

        <h1 className="text-xl font-semibold mb-1">我的充值订单</h1>
        <p className="text-sm text-muted-foreground mb-5">
          查看每笔 AI 算力充值的支付状态与到账情况。已到账的算力当月有效。
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />加载中...
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg text-muted-foreground">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无充值订单</p>
            <Button variant="link" size="sm" onClick={() => setRechargeOpen(true)}>
              立即充值
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-semibold">￥{o.amount_cny}</span>
                      <span className="text-sm text-muted-foreground">· {o.credits} 次算力</span>
                      {statusChip(o.status)}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div>套餐：<span className="text-foreground">{o.package_key}</span></div>
                      <div>支付方式：<span className="text-foreground">{o.pay_method === 'wechat' ? '微信' : '支付宝'}</span></div>
                      <div>提交时间：<span className="text-foreground">{new Date(o.created_at).toLocaleString()}</span></div>
                      <div>
                        更新时间：
                        <span className="text-foreground">
                          {o.reviewed_at ? new Date(o.reviewed_at).toLocaleString() : '—'}
                        </span>
                      </div>
                      {o.payer_note && <div className="sm:col-span-2">备注：<span className="text-foreground">{o.payer_note}</span></div>}
                    </div>
                    {o.status === 'rejected' && o.reject_reason && (
                      <div className="mt-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
                        拒绝原因：{o.reject_reason}
                      </div>
                    )}
                    {o.status === 'approved' && (
                      <div className="mt-2 text-xs text-success">
                        ✓ 已发放 {o.credits} 次 AI 算力，当月有效。
                      </div>
                    )}
                    {o.status === 'pending' && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        管理员审核通过后算力将自动到账，请耐心等待。
                      </div>
                    )}
                  </div>
                  {o.screenshot_url && (
                    <a
                      href={o.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                      title="查看付款截图"
                    >
                      <img
                        src={o.screenshot_url}
                        alt="付款截图"
                        className="w-16 h-16 object-cover rounded border border-border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RechargeDialog
        open={rechargeOpen}
        onOpenChange={setRechargeOpen}
        onOrderSubmitted={() => { void load(); }}
      />
    </div>
  );
}
