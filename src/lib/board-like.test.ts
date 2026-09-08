import { describe, it, expect, beforeEach } from 'vitest';
import { getLikerToken, getLikedCardIds, hasLiked, markLiked, resetLikes } from './board-like';
import { likeCardLocal } from './board-utils';
import type { BoardCard } from '@/components/BoardPanel';

const card = (id: string, likes = 0): BoardCard => ({
  id, board_id: 'b1', content: id, card_type: 'text', media_url: '', url: '',
  color: '#fff', author_nickname: 'a', is_pinned: false, is_approved: true,
  likes_count: likes, column_id: '', position_x: 0, position_y: 0, sort_order: 0,
  created_at: new Date().toISOString(),
});

describe('board like idempotency', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and reuses a stable liker token', () => {
    const first = getLikerToken();
    expect(first).toBeTruthy();
    expect(getLikerToken()).toBe(first);
  });

  it('marks a card as liked only once', () => {
    expect(markLiked('c1')).toBe(true);
    expect(markLiked('c1')).toBe(false);
    expect(hasLiked('c1')).toBe(true);
    expect(getLikedCardIds()).toEqual(['c1']);
  });

  it('tracks different cards independently', () => {
    markLiked('c1');
    expect(hasLiked('c2')).toBe(false);
    expect(markLiked('c2')).toBe(true);
    expect(getLikedCardIds()).toEqual(['c1', 'c2']);
  });

  it('never double-counts likes when combined with likeCardLocal', () => {
    let cards = [card('c1'), card('c2')];
    for (let i = 0; i < 5; i++) {
      if (markLiked('c1')) cards = likeCardLocal(cards, 'c1');
    }
    expect(cards.find(c => c.id === 'c1')!.likes_count).toBe(1);
    expect(cards.find(c => c.id === 'c2')!.likes_count).toBe(0);
  });

  it('recovers from corrupted storage', () => {
    localStorage.setItem('board-liked-cards', 'not-json');
    expect(getLikedCardIds()).toEqual([]);
    expect(markLiked('c1')).toBe(true);
  });

  it('resets likes', () => {
    markLiked('c1');
    resetLikes();
    expect(hasLiked('c1')).toBe(false);
  });
});
