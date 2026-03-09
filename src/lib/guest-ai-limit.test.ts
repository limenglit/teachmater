import { describe, it, expect, beforeEach } from 'vitest';
import { getGuestAIRemaining, recordGuestAIUsage, GUEST_AI_DAILY_MAX } from './guest-ai-limit';

beforeEach(() => localStorage.clear());

describe('getGuestAIRemaining', () => {
  it('returns -1 for logged-in users (unlimited)', () => {
    expect(getGuestAIRemaining(true)).toBe(-1);
  });

  it('returns full daily limit for new guests', () => {
    expect(getGuestAIRemaining(false)).toBe(GUEST_AI_DAILY_MAX);
  });

  it('decreases after usage', () => {
    recordGuestAIUsage(false);
    expect(getGuestAIRemaining(false)).toBe(GUEST_AI_DAILY_MAX - 1);
  });

  it('returns 0 when limit exhausted', () => {
    for (let i = 0; i < GUEST_AI_DAILY_MAX; i++) recordGuestAIUsage(false);
    expect(getGuestAIRemaining(false)).toBe(0);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('guest-ai-usage', '{bad');
    expect(getGuestAIRemaining(false)).toBe(GUEST_AI_DAILY_MAX);
  });
});

describe('recordGuestAIUsage', () => {
  it('returns true for logged-in users always', () => {
    expect(recordGuestAIUsage(true)).toBe(true);
  });

  it('returns true when under limit', () => {
    expect(recordGuestAIUsage(false)).toBe(true);
  });

  it('returns false when limit reached', () => {
    for (let i = 0; i < GUEST_AI_DAILY_MAX; i++) recordGuestAIUsage(false);
    expect(recordGuestAIUsage(false)).toBe(false);
  });

  it('increments count in localStorage', () => {
    recordGuestAIUsage(false);
    recordGuestAIUsage(false);
    const stored = JSON.parse(localStorage.getItem('guest-ai-usage')!);
    expect(stored.count).toBe(2);
  });

  it('does not increment for logged-in users', () => {
    recordGuestAIUsage(true);
    expect(localStorage.getItem('guest-ai-usage')).toBeNull();
  });

  it('resets count for new day', () => {
    // Simulate stale data from yesterday
    localStorage.setItem('guest-ai-usage', JSON.stringify({ date: '2020-01-01', count: 99 }));
    expect(recordGuestAIUsage(false)).toBe(true);
    const stored = JSON.parse(localStorage.getItem('guest-ai-usage')!);
    expect(stored.count).toBe(1);
  });
});

describe('GUEST_AI_DAILY_MAX', () => {
  it('is a positive number', () => {
    expect(GUEST_AI_DAILY_MAX).toBeGreaterThan(0);
  });

  it('equals 5', () => {
    expect(GUEST_AI_DAILY_MAX).toBe(5);
  });
});
