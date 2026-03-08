/**
 * Pure logic extracted from BoardPanel for testability.
 */
import type { Board, BoardCard } from '@/components/BoardPanel';

/** Sort cards: pinned first, then newest first */
export function sortCards(cards: BoardCard[]): BoardCard[] {
  return [...cards].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** Check if card content contains any banned words */
export function containsBannedWord(content: string, bannedWords: string): boolean {
  if (!bannedWords.trim()) return false;
  const words = bannedWords.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  const lower = content.toLowerCase();
  return words.some(w => lower.includes(w));
}

/** Filter approved cards */
export function getApprovedCards(cards: BoardCard[]): BoardCard[] {
  return cards.filter(c => c.is_approved);
}

/** Count pending (unapproved) cards */
export function getPendingCount(cards: BoardCard[]): number {
  return cards.filter(c => !c.is_approved).length;
}

/** Apply a manage action to cards locally */
export function applyCardAction(
  cards: BoardCard[],
  cardId: string,
  action: 'approve' | 'reject' | 'pin' | 'unpin' | 'delete'
): BoardCard[] {
  if (action === 'delete' || action === 'reject') {
    return cards.filter(c => c.id !== cardId);
  }
  if (action === 'approve') {
    return cards.map(c => c.id === cardId ? { ...c, is_approved: true } : c);
  }
  if (action === 'pin') {
    return cards.map(c => c.id === cardId ? { ...c, is_pinned: true } : c);
  }
  if (action === 'unpin') {
    return cards.map(c => c.id === cardId ? { ...c, is_pinned: false } : c);
  }
  return cards;
}

/** Increment like count for a card */
export function likeCardLocal(cards: BoardCard[], cardId: string): BoardCard[] {
  return cards.map(c => c.id === cardId ? { ...c, likes_count: c.likes_count + 1 } : c);
}

/** Generate CSV export string from approved cards */
export function generateBoardCSV(cards: BoardCard[]): string {
  const approved = cards.filter(c => c.is_approved);
  const header = 'Nickname,Content,Type,URL,Color,Pinned,Likes,Created\n';
  const rows = approved.map(c =>
    `"${c.author_nickname}","${c.content.replace(/"/g, '""')}","${c.card_type}","${c.url}","${c.color}",${c.is_pinned},${c.likes_count},"${c.created_at}"`
  ).join('\n');
  return header + rows;
}

/** Group cards by column for kanban view */
export function groupByColumn(cards: BoardCard[], columns: string[]): Record<string, BoardCard[]> {
  const groups: Record<string, BoardCard[]> = {};
  for (const col of columns) {
    groups[col] = cards.filter(c => c.column_id === col);
  }
  // Uncategorized
  const uncategorized = cards.filter(c => !columns.includes(c.column_id));
  if (uncategorized.length > 0) {
    groups['__uncategorized__'] = uncategorized;
  }
  return groups;
}

/** Build a new local card object */
export function buildLocalCard(
  boardId: string,
  partial: Partial<BoardCard>,
  sortOrder: number,
  defaultNickname: string
): BoardCard {
  return {
    id: crypto.randomUUID(),
    board_id: boardId,
    content: partial.content || '',
    card_type: partial.card_type || 'text',
    media_url: partial.media_url || '',
    url: partial.url || '',
    color: partial.color || '#ffffff',
    author_nickname: partial.author_nickname || defaultNickname,
    is_pinned: false,
    is_approved: partial.is_approved !== false,
    likes_count: 0,
    column_id: partial.column_id || '',
    position_x: partial.position_x || Math.random() * 600,
    position_y: partial.position_y || Math.random() * 400,
    sort_order: sortOrder,
    created_at: new Date().toISOString(),
  };
}
