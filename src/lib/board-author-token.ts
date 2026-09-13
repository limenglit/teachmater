/**
 * Per-participant board ownership token.
 *
 * A random secret is generated once per board and kept only in the
 * submitter's own browser. Only its SHA-256 hash is stored with the card,
 * so knowing someone's public nickname is no longer enough to delete
 * their submissions.
 */

const KEY_PREFIX = 'board-author-token-';

function randomToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function getBoardAuthorToken(boardId: string): string {
  const key = `${KEY_PREFIX}${boardId}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing && existing.length >= 16) return existing;
    const token = randomToken();
    localStorage.setItem(key, token);
    return token;
  } catch {
    return randomToken();
  }
}

function fallbackHash(input: string): string {
  // Non-crypto fallback for very old browsers / insecure contexts.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + input.charCodeAt(i) + i, 0x85ebca6b) >>> 0;
  }
  return `fb${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export async function hashToken(token: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fall through
  }
  return fallbackHash(token);
}

export async function getBoardAuthorTokenHash(boardId: string): Promise<string> {
  return hashToken(getBoardAuthorToken(boardId));
}
