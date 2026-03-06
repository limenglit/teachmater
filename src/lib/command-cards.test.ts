import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_COMMAND_EMOJI,
  buildCustomCommand,
  ICON_CANDIDATE_MAX,
  ICON_CANDIDATE_MIN,
  searchTopicBadgeCandidates,
  shouldFallbackToDefault,
  toIconUrl,
} from './command-cards';

describe('command-cards utils', () => {
  it('converts iconify icon names to svg urls', () => {
    expect(toIconUrl('mdi:account')).toBe('https://api.iconify.design/mdi/account.svg');
    expect(toIconUrl('invalid')).toBe('');
    expect(toIconUrl('mdi:')).toBe('');
  });

  it('builds custom command with fallback emoji when icon missing', () => {
    expect(buildCustomCommand('  讨论  ')).toEqual({ text: '讨论', emoji: DEFAULT_COMMAND_EMOJI });
    expect(buildCustomCommand('讨论', 'https://api.iconify.design/mdi/account.svg')).toEqual({
      text: '讨论',
      iconUrl: 'https://api.iconify.design/mdi/account.svg',
    });
  });

  it('decides fallback threshold correctly', () => {
    expect(shouldFallbackToDefault([])).toBe(true);
    expect(shouldFallbackToDefault(Array.from({ length: ICON_CANDIDATE_MIN - 1 }, () => 'x'))).toBe(true);
    expect(shouldFallbackToDefault(Array.from({ length: ICON_CANDIDATE_MIN }, () => 'x'))).toBe(false);
  });

  it('collects unique candidates and caps at max size', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        icons: [
          'mdi:account',
          'mdi:account',
          'lucide:alarm-clock',
          'tabler:book',
          'ph:chalkboard',
          'material-symbols:menu-book',
          'mdi:teach',
        ],
      }),
    }));

    const candidates = await searchTopicBadgeCandidates('课堂', fetcher);
    expect(candidates.length).toBe(ICON_CANDIDATE_MAX);
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates[0]).toBe('https://api.iconify.design/mdi/account.svg');
  });

  it('keeps searching through terms when one request fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ icons: ['mdi:account'] }) })
      .mockResolvedValue({ ok: true, json: async () => ({ icons: [] }) });

    const candidates = await searchTopicBadgeCandidates('发言', fetcher);
    expect(candidates).toEqual(['https://api.iconify.design/mdi/account.svg']);
    expect(fetcher).toHaveBeenCalled();
  });

  it('returns empty list on invalid payloads', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ icons: null }) }));
    const candidates = await searchTopicBadgeCandidates('测试', fetcher);
    expect(candidates).toEqual([]);
  });
});
