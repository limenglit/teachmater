// Guest AI usage limiter - daily quota for non-registered users

const GUEST_AI_KEY = 'guest-ai-usage';
let GUEST_AI_DAILY_LIMIT = 5; // default, can be overridden by system config

interface GuestAIUsage {
  date: string; // YYYY-MM-DD
  count: number;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUsage(): GuestAIUsage {
  try {
    const raw = localStorage.getItem(GUEST_AI_KEY);
    if (!raw) return { date: getToday(), count: 0 };
    const parsed = JSON.parse(raw) as GuestAIUsage;
    if (parsed.date !== getToday()) return { date: getToday(), count: 0 };
    return parsed;
  } catch {
    return { date: getToday(), count: 0 };
  }
}

function saveUsage(usage: GuestAIUsage) {
  localStorage.setItem(GUEST_AI_KEY, JSON.stringify(usage));
}

/**
 * Set the dynamic daily limit from system config
 */
export function setGuestAIDailyLimit(limit: number) {
  GUEST_AI_DAILY_LIMIT = limit;
}

/**
 * Check if guest can use AI. Returns remaining count.
 * Returns -1 if unlimited.
 */
export function getGuestAIRemaining(isLoggedIn: boolean, dynamicLimit?: number): number {
  const limit = dynamicLimit ?? GUEST_AI_DAILY_LIMIT;
  if (limit === -1) return -1; // unlimited
  if (isLoggedIn && dynamicLimit === undefined) return -1;
  const usage = getUsage();
  return Math.max(0, limit - usage.count);
}

/**
 * Record one AI usage for guest. Returns false if over limit.
 */
export function recordGuestAIUsage(isLoggedIn: boolean, dynamicLimit?: number): boolean {
  const limit = dynamicLimit ?? GUEST_AI_DAILY_LIMIT;
  if (limit === -1) return true; // unlimited
  if (isLoggedIn && dynamicLimit === undefined) return true;
  const usage = getUsage();
  if (usage.count >= limit) return false;
  usage.count += 1;
  saveUsage(usage);
  return true;
}

export const GUEST_AI_DAILY_MAX = GUEST_AI_DAILY_LIMIT;
