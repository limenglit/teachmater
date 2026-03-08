// Guest AI usage limiter - daily quota for non-registered users

const GUEST_AI_KEY = 'guest-ai-usage';
const GUEST_AI_DAILY_LIMIT = 5; // max AI calls per day for guests

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
    // Reset if different day
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
 * Check if guest can use AI. Returns remaining count.
 * Returns -1 if user is logged in (unlimited).
 */
export function getGuestAIRemaining(isLoggedIn: boolean): number {
  if (isLoggedIn) return -1; // unlimited
  const usage = getUsage();
  return Math.max(0, GUEST_AI_DAILY_LIMIT - usage.count);
}

/**
 * Record one AI usage for guest. Returns false if over limit.
 */
export function recordGuestAIUsage(isLoggedIn: boolean): boolean {
  if (isLoggedIn) return true; // always allowed
  const usage = getUsage();
  if (usage.count >= GUEST_AI_DAILY_LIMIT) return false;
  usage.count += 1;
  saveUsage(usage);
  return true;
}

export const GUEST_AI_DAILY_MAX = GUEST_AI_DAILY_LIMIT;
