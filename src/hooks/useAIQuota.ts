/**
 * Unified AI quota hook – connects admin-configured limits + purchased packs.
 *
 * Priority chain when consuming:
 *   1. Admin users → unlimited (-1)
 *   2. Purchased credits (user_ai_credits, current month) → deduct one via RPC
 *   3. Registered user with individual daily limit → local counter
 *   4. Otherwise → system_config daily limit → local counter
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureConfig } from '@/contexts/FeatureConfigContext';
import { supabase } from '@/integrations/supabase/client';

interface DailyUsage { date: string; count: number; }
function today(): string { return new Date().toISOString().slice(0, 10); }
function storageKey(userId?: string): string { return userId ? `ai-usage-${userId}` : 'guest-ai-usage'; }
function readUsage(key: string): DailyUsage {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { date: today(), count: 0 };
    const p = JSON.parse(raw) as DailyUsage;
    return p.date === today() ? p : { date: today(), count: 0 };
  } catch { return { date: today(), count: 0 }; }
}
function writeUsage(key: string, usage: DailyUsage) {
  localStorage.setItem(key, JSON.stringify(usage));
}

export interface AIQuota {
  remaining: number;
  limit: number;
  purchasedRemaining: number;
  purchasedExpiresAt: string | null;
  /** Try to consume 1 call. Purchased pack is deducted first (optimistically);
   *  falls back to daily free counter. Returns false if fully depleted. */
  consume: () => boolean;
  loading: boolean;
  refreshPurchased: () => Promise<void>;
}

export function useAIQuota(): AIQuota {
  const { user, isAdmin } = useAuth();
  const { getAIDailyLimit } = useFeatureConfig();

  const [individualLimit, setIndividualLimit] = useState<number | null>(null);
  const [loadingIndividual, setLoadingIndividual] = useState(false);
  const [purchasedRemaining, setPurchasedRemaining] = useState(0);
  const [purchasedExpiresAt, setPurchasedExpiresAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // fetch individual limit
  useEffect(() => {
    if (!user) { setIndividualLimit(null); return; }
    let cancelled = false;
    setLoadingIndividual(true);
    supabase
      .from('user_ai_limits')
      .select('daily_limit')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIndividualLimit(data ? (data as any).daily_limit : null);
        setLoadingIndividual(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const refreshPurchased = useCallback(async () => {
    if (!user) { setPurchasedRemaining(0); setPurchasedExpiresAt(null); return; }
    const { data } = await (supabase as any).rpc('get_my_ai_credits');
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    setPurchasedRemaining(row?.balance ?? 0);
    setPurchasedExpiresAt(row?.expires_at ?? null);
  }, [user?.id]);

  useEffect(() => { void refreshPurchased(); }, [refreshPurchased, tick]);

  const effectiveLimit = useMemo<number>(() => {
    if (isAdmin) return -1;
    if (user && individualLimit !== null) return individualLimit;
    return getAIDailyLimit();
  }, [isAdmin, user, individualLimit, getAIDailyLimit]);

  const key = storageKey(user?.id);

  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined;
      if (!detail?.key || detail.key === key) bump();
    };
    const onStorage = (e: StorageEvent) => { if (e.key === key) bump(); };
    const onFocus = () => bump();
    window.addEventListener('ai-quota-changed', onCustom as EventListener);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('ai-quota-changed', onCustom as EventListener);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [key]);

  const remaining = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick;
    if (effectiveLimit === -1) return -1;
    const usage = readUsage(key);
    return Math.max(0, effectiveLimit - usage.count);
  }, [effectiveLimit, key, tick]);

  const consume = useCallback((): boolean => {
    if (isAdmin) return true;
    // Prefer purchased pack: optimistic local decrement + async server deduction.
    if (user && purchasedRemaining > 0) {
      setPurchasedRemaining(n => Math.max(0, n - 1));
      void (async () => {
        const { error } = await (supabase as any).rpc('consume_purchased_ai_credit');
        if (error) {
          // Roll back on failure; refresh from server to reconcile.
          void refreshPurchased();
        }
        try { window.dispatchEvent(new CustomEvent('ai-quota-changed', { detail: { key } })); } catch { /* noop */ }
      })();
      return true;
    }
    // Fallback: daily free counter
    if (effectiveLimit === -1) return true;
    const usage = readUsage(key);
    if (usage.count >= effectiveLimit) return false;
    usage.count += 1;
    writeUsage(key, usage);
    setTick(t => t + 1);
    try { window.dispatchEvent(new CustomEvent('ai-quota-changed', { detail: { key } })); } catch { /* noop */ }
    return true;
  }, [effectiveLimit, key, isAdmin, user, purchasedRemaining, refreshPurchased]);

  return {
    remaining,
    limit: effectiveLimit,
    purchasedRemaining,
    purchasedExpiresAt,
    consume,
    loading: loadingIndividual,
    refreshPurchased,
  };
}
