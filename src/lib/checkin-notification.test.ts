import { describe, expect, it } from 'vitest';
import { buildCheckinNotification, formatCheckinTime } from './checkin-notification';

describe('buildCheckinNotification', () => {
  const createdAt = new Date(2026, 7, 31, 9, 0, 0);

  it('includes time window, link and hints', () => {
    const text = buildCheckinNotification({
      title: '计算机一班',
      checkinUrl: 'https://example.com/seat-checkin/abc',
      createdAt,
      durationMinutes: 30,
      otpEnabled: true,
      findFriendEnabled: true,
    });
    expect(text).toContain('计算机一班');
    expect(text).toContain(formatCheckinTime(createdAt));
    expect(text).toContain('2026-08-31 09:30');
    expect(text).toContain('https://example.com/seat-checkin/abc');
    expect(text).toContain('动态口令');
    expect(text).toContain('找朋友');
  });

  it('marks unlimited sessions', () => {
    const text = buildCheckinNotification({
      title: '',
      checkinUrl: 'u',
      createdAt,
      durationMinutes: 99999,
    });
    expect(text).toContain('不限时');
    expect(text).not.toContain('截止时间');
  });
});
