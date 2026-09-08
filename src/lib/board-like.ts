/**
 * Like idempotency helpers for board cards.
 *
 * A liker is identified by a stable local token. The set of cards the token has
 * already liked is remembered locally so repeated clicks never double-count in
 * the UI (the database also has a unique constraint on card_id + liker_token).
 */

const TOKEN_KEY = 'board-liker-token';
const LIKED_KEY = 'board-liked-cards';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

export function getLikerToken(): string {
  const existing = safeGet(TOKEN_KEY);
  if (existing) return existing;
  const token = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `liker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  safeSet(TOKEN_KEY, token);
  return token;
}

export function getLikedCardIds(): string[] {
  try {
    const raw = safeGet(LIKED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function hasLiked(cardId: string): boolean {
  return getLikedCardIds().includes(cardId);
}

/** Marks the card as liked. Returns false when it was already liked. */
export function markLiked(cardId: string): boolean {
  const liked = getLikedCardIds();
  if (liked.includes(cardId)) return false;
  liked.push(cardId);
  // Keep the list bounded so long-running classroom sessions never grow forever.
  const bounded = liked.slice(-500);
  safeSet(LIKED_KEY, JSON.stringify(bounded));
  return true;
}

export function resetLikes() {
  safeSet(LIKED_KEY, '[]');
}
