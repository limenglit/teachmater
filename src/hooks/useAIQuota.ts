/**
 * Unified AI quota hook – connects admin-configured limits
 * (system_config + user_ai_limits) to every Edge Function call site.
 *
 * Priority chain:
 *   1. Admin users → unlimited (-1)
 *   2. Registered user with individual limit in `user_ai_limits` → that limit
 *   3. Registered user without individual limit → system_config.registered.ai_daily_limit
 *   4. Guest → system_config.guest.ai_daily_limit  (localStorage tracking)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureConfig } from '@/contexts/FeatureConfigContext';
import { supabase } from '@/integrations/supabase/client';

/* ── localStorage helpers ─────────────────────────────────────── */

interface DailyUsage {
  date: string; // YYYY-MM-DD
  count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(userId?: string): string {
  return userId ? `ai-usage-${userId}` : 'guest-ai-usage';
}

function readUsage(key: string): DailyUsage {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { date: today(), count: 0 };
    const p = JSON.parse(raw) as DailyUsage;
    return p.date === today() ? p : { date: today(), count: 0 };
  } catch {
    return { date: today(), count: 0 };
  }
}

function writeUsage(key: string, usage: DailyUsage) {
  localStorage.setItem(key, JSON.stringify(usage));
}

/* ── hook ──────────────────────────────────────────────────────── */

export interface AIQuota {
  /** Remaining calls today. -1 = unlimited */
  remaining: number;
  /** Total daily limit. -1 = unlimited */
  limit: number;
  /** Try to consume 1 call. Returns false if over limit. */
  consume: () => boolean;
  /** True while the individual limit is loading from DB */
  loading: boolean;
}

export function useAIQuota(): AIQuota {
  const { user, isAdmin } = useAuth();
  const { getAIDailyLimit } = useFeatureConfig();

  // Individual limit fetched from user_ai_limits (null = not fetched / no row)
  const [individualLimit, setIndividualLimit] = useState<number | null>(null);
  const [loadingIndividual, setLoadingIndividual] = useState(false);

  // Force re-render after consume
  const [tick, setTick] = useState(0);

  // Fetch individual limit for registered users
  useEffect(() => {
    if (!user) {
      setIndividualLimit(null);
      return;
    }
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

  const effectiveLimit = useMemo<number>(() => {
    if (isAdmin) return -1;
    // If an individual limit was set by admin, use it
    if (user && individualLimit !== null) return individualLimit;
    // Fall back to system-config level limit (guest or registered)
    return getAIDailyLimit();
  }, [isAdmin, user, individualLimit, getAIDailyLimit]);

  const key = storageKey(user?.id);

  const remaining = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick; // dependency for reactivity
    if (effectiveLimit === -1) return -1;
    const usage = readUsage(key);
    return Math.max(0, effectiveLimit - usage.count);
  }, [effectiveLimit, key, tick]);

  const consume = useCallback((): boolean => {
    if (effectiveLimit === -1) return true;
    const usage = readUsage(key);
    if (usage.count >= effectiveLimit) return false;
    usage.count += 1;
    writeUsage(key, usage);
    setTick(t => t + 1);
    return true;
  }, [effectiveLimit, key]);

  return { remaining, limit: effectiveLimit, consume, loading: loadingIndividual };
}
