import { describe, it, expect } from 'vitest';
import {
  sortCards,
  containsBannedWord,
  getApprovedCards,
  getPendingCount,
  applyCardAction,
  likeCardLocal,
  generateBoardCSV,
  groupByColumn,
  buildLocalCard,
} from './board-utils';
import type { BoardCard } from '@/components/BoardPanel';

function makeCard(overrides: Partial<BoardCard> = {}): BoardCard {
  return {
    id: crypto.randomUUID(),
    board_id: 'board-1',
    content: 'test content',
    card_type: 'text',
    media_url: '',
    url: '',
    color: '#ffffff',
    author_nickname: 'Alice',
    is_pinned: false,
    is_approved: true,
    likes_count: 0,
    column_id: '',
    position_x: 100,
    position_y: 100,
    sort_order: 0,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── sortCards ─────────────────────────────────────────────

describe('sortCards', () => {
  it('puts pinned cards first', () => {
    const cards = [
      makeCard({ id: '1', is_pinned: false }),
      makeCard({ id: '2', is_pinned: true }),
    ];
    const sorted = sortCards(cards);
    expect(sorted[0].id).toBe('2');
  });

  it('sorts by created_at descending within same pin status', () => {
    const cards = [
      makeCard({ id: '1', created_at: '2025-01-01T00:00:00Z' }),
      makeCard({ id: '2', created_at: '2025-06-01T00:00:00Z' }),
    ];
    const sorted = sortCards(cards);
    expect(sorted[0].id).toBe('2');
  });

  it('does not mutate original array', () => {
    const cards = [makeCard({ id: '1' }), makeCard({ id: '2' })];
    const sorted = sortCards(cards);
    expect(sorted).not.toBe(cards);
  });

  it('handles empty array', () => {
    expect(sortCards([])).toEqual([]);
  });
});

// ── containsBannedWord ───────────────────────────────────

describe('containsBannedWord', () => {
  it('returns true if content contains a banned word', () => {
    expect(containsBannedWord('this is spam content', 'spam,ads')).toBe(true);
  });

  it('returns false if no match', () => {
    expect(containsBannedWord('hello world', 'spam,ads')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(containsBannedWord('SPAM here', 'spam')).toBe(true);
  });

  it('returns false for empty banned words', () => {
    expect(containsBannedWord('anything', '')).toBe(false);
    expect(containsBannedWord('anything', '   ')).toBe(false);
  });

  it('trims whitespace around banned words', () => {
    expect(containsBannedWord('bad word', ' bad , evil ')).toBe(true);
  });
});

// ── getApprovedCards / getPendingCount ────────────────────

describe('getApprovedCards', () => {
  it('filters to approved cards only', () => {
    const cards = [
      makeCard({ is_approved: true }),
      makeCard({ is_approved: false }),
      makeCard({ is_approved: true }),
    ];
    expect(getApprovedCards(cards)).toHaveLength(2);
  });
});

describe('getPendingCount', () => {
  it('counts unapproved cards', () => {
    const cards = [
      makeCard({ is_approved: true }),
      makeCard({ is_approved: false }),
      makeCard({ is_approved: false }),
    ];
    expect(getPendingCount(cards)).toBe(2);
  });

  it('returns 0 when all approved', () => {
    expect(getPendingCount([makeCard()])).toBe(0);
  });
});

// ── applyCardAction ──────────────────────────────────────

describe('applyCardAction', () => {
  const cards = [
    makeCard({ id: 'a', is_approved: false, is_pinned: false }),
    makeCard({ id: 'b' }),
  ];

  it('deletes a card', () => {
    const result = applyCardAction(cards, 'a', 'delete');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('rejects (removes) a card', () => {
    const result = applyCardAction(cards, 'a', 'reject');
    expect(result).toHaveLength(1);
  });

  it('approves a card', () => {
    const result = applyCardAction(cards, 'a', 'approve');
    expect(result.find(c => c.id === 'a')!.is_approved).toBe(true);
  });

  it('pins a card', () => {
    const result = applyCardAction(cards, 'a', 'pin');
    expect(result.find(c => c.id === 'a')!.is_pinned).toBe(true);
  });

  it('unpins a card', () => {
    const pinned = [makeCard({ id: 'x', is_pinned: true })];
    const result = applyCardAction(pinned, 'x', 'unpin');
    expect(result[0].is_pinned).toBe(false);
  });

  it('returns cards unchanged for unknown action', () => {
    const result = applyCardAction(cards, 'a', 'unknown' as any);
    expect(result).toHaveLength(2);
  });
});

// ── likeCardLocal ────────────────────────────────────────

describe('likeCardLocal', () => {
  it('increments likes_count for the target card', () => {
    const cards = [makeCard({ id: 'a', likes_count: 3 })];
    const result = likeCardLocal(cards, 'a');
    expect(result[0].likes_count).toBe(4);
  });

  it('does not affect other cards', () => {
    const cards = [
      makeCard({ id: 'a', likes_count: 0 }),
      makeCard({ id: 'b', likes_count: 5 }),
    ];
    const result = likeCardLocal(cards, 'a');
    expect(result[1].likes_count).toBe(5);
  });
});

// ── generateBoardCSV ─────────────────────────────────────

describe('generateBoardCSV', () => {
  it('generates CSV with header and approved cards only', () => {
    const cards = [
      makeCard({ author_nickname: 'Bob', content: 'hello', is_approved: true }),
      makeCard({ is_approved: false }),
    ];
    const csv = generateBoardCSV(cards);
    expect(csv).toContain('Nickname,Content,Type');
    expect(csv).toContain('"Bob"');
    expect(csv.split('\n')).toHaveLength(2); // header + 1 row
  });

  it('escapes double quotes in content', () => {
    const cards = [makeCard({ content: 'say "hi"', is_approved: true })];
    const csv = generateBoardCSV(cards);
    expect(csv).toContain('say ""hi""');
  });

  it('returns header only for empty cards', () => {
    const csv = generateBoardCSV([]);
    expect(csv.trim()).toBe('Nickname,Content,Type,URL,Color,Pinned,Likes,Created');
  });
});

// ── groupByColumn ────────────────────────────────────────

describe('groupByColumn', () => {
  const columns = ['Todo', 'Done'];

  it('groups cards by column_id', () => {
    const cards = [
      makeCard({ id: '1', column_id: 'Todo' }),
      makeCard({ id: '2', column_id: 'Done' }),
      makeCard({ id: '3', column_id: 'Todo' }),
    ];
    const groups = groupByColumn(cards, columns);
    expect(groups['Todo']).toHaveLength(2);
    expect(groups['Done']).toHaveLength(1);
  });

  it('puts uncategorized cards in __uncategorized__', () => {
    const cards = [makeCard({ column_id: 'Other' })];
    const groups = groupByColumn(cards, columns);
    expect(groups['__uncategorized__']).toHaveLength(1);
  });

  it('returns empty arrays for columns with no cards', () => {
    const groups = groupByColumn([], columns);
    expect(groups['Todo']).toEqual([]);
    expect(groups['Done']).toEqual([]);
  });
});

// ── buildLocalCard ───────────────────────────────────────

describe('buildLocalCard', () => {
  it('creates a card with correct defaults', () => {
    const card = buildLocalCard('board-1', { content: 'hi' }, 5, 'Anonymous');
    expect(card.board_id).toBe('board-1');
    expect(card.content).toBe('hi');
    expect(card.sort_order).toBe(5);
    expect(card.author_nickname).toBe('Anonymous');
    expect(card.is_pinned).toBe(false);
    expect(card.is_approved).toBe(true);
    expect(card.likes_count).toBe(0);
    expect(card.id).toBeTruthy();
  });

  it('uses partial overrides', () => {
    const card = buildLocalCard('b', { color: '#fef3c7', card_type: 'image' }, 0, 'X');
    expect(card.color).toBe('#fef3c7');
    expect(card.card_type).toBe('image');
  });

  it('respects is_approved = false', () => {
    const card = buildLocalCard('b', { is_approved: false }, 0, 'X');
    expect(card.is_approved).toBe(false);
  });
});
