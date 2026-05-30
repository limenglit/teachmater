import { describe, expect, it } from 'vitest';
import { decodePageRouteParam, getPageStoragePath, getPublicPageUrl, normalizePageSlug, validatePageSlug } from './page-slug';

describe('page slug helpers', () => {
  it('normalizes Chinese HTML filenames into valid slugs', () => {
    expect(normalizePageSlug('  课堂导入.html  ')).toBe('课堂导入');
    expect(normalizePageSlug('我的 页面（最终版）.HTM')).toBe('我的-页面-最终版');
    expect(validatePageSlug('课堂导入')).toBeNull();
  });

  it('keeps useful filename separators and lowercases ASCII only', () => {
    expect(normalizePageSlug('AI_课堂.V2.HTML')).toBe('ai_课堂.v2');
    expect(validatePageSlug('ai_课堂.v2')).toBeNull();
  });

  it('uses ASCII-only storage keys and encoded public URLs', () => {
    expect(getPageStoragePath('u-1', '课堂导入')).toBe('u-1/e8afbee5a082e5af bce585a5.html'.replace(' ', ''));
    expect(getPageStoragePath('363a1143-c1a8-49ff-9e4a-1dcb1d04b331', '概率统计-随机模拟交互式实验课件'))
      .toBe('363a1143-c1a8-49ff-9e4a-1dcb1d04b331/e6a682e78e87e7bb9fe8aea12de99a8fe69cbae6a8a1e68b9fe4baa4e5bc8fe5ae9ee9aa8ce8afbee4bbb6.html');
    expect(getPublicPageUrl('https://example.com', 'teacher', '课堂导入')).toBe('https://example.com/teacher/%E8%AF%BE%E5%A0%82%E5%AF%BC%E5%85%A5');
  });

  it('decodes route params before querying the backend', () => {
    expect(decodePageRouteParam('%E8%AF%BE%E5%A0%82%E5%AF%BC%E5%85%A5')).toBe('课堂导入');
  });
});