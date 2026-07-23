/**
 * Watches the current user's AI credit orders and pops a toast whenever
 * an order transitions from pending → approved / rejected. Also refreshes
 * the purchased quota so the homepage badge updates immediately.
 *
 * Uses Supabase Realtime (postgres_changes) as the primary channel and a
 * focus / interval poll as a resilient fallback in case realtime is not
 * enabled for the table.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const NOTIFIED_KEY = 'ai-credit-orders-notified-v1';

function readNotified(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); }
  catch { return {}; }
}
function writeNotified(map: Record<string, string>) {
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map)); } catch { /* noop */ }
}

interface Order {
  id: string;
  status: string;
  credits: number;
  amount_cny: number;
  reject_reason: string | null;
}

export function useAIOrderNotifier(onApproved?: () => void) {
  const { user } = useAuth();
  const onApprovedRef = useRef(onApproved);
  onApprovedRef.current = onApproved;

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const handleOrder = (o: Order) => {
      if (o.status !== 'approved' && o.status !== 'rejected') return;
      const seen = readNotified();
      if (seen[o.id] === o.status) return; // already notified for this state
      seen[o.id] = o.status;
      writeNotified(seen);

      if (o.status === 'approved') {
        toast({
          title: '充值已到账 🎉',
          description: `已为你发放 ${o.credits} 次 AI 算力（￥${o.amount_cny}），当月有效。`,
        });
        onApprovedRef.current?.();
      } else {
        toast({
          title: '充值订单被拒绝',
          description: o.reject_reason || '请核对付款信息后重新提交。',
          variant: 'destructive',
        });
      }
    };

    let firstPoll = true;
    const poll = async () => {
      const { data, error } = await (supabase as any).rpc('get_my_ai_credit_orders');
      if (cancelled || error) return;
      const orders = (data as Order[]) || [];
      if (firstPoll) {
        // Seed every existing order state so we don't spam toasts for
        // historical orders on a fresh browser/localStorage.
        const seen = readNotified();
        for (const o of orders) {
          if (!seen[o.id]) seen[o.id] = o.status;
        }
        writeNotified(seen);
        firstPoll = false;
        return;
      }
      for (const o of orders) {
        handleOrder(o);
      }
    };

    void poll();
    const interval = window.setInterval(poll, 30_000);
    const onFocus = () => { void poll(); };
    window.addEventListener('focus', onFocus);

    const channel = supabase
      .channel(`ai-credit-orders-${user.id}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_credit_orders',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const o = payload?.new as Order | undefined;
          if (o) handleOrder(o);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    };
  }, [user?.id]);
}
