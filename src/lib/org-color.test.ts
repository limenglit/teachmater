import { describe, expect, it } from 'vitest';
import { buildOrganizationColorResolver, getOrganizationUnitKey } from './org-color';

describe('org-color', () => {
  it('normalizes multi-department names to the same unit key', () => {
    const keyA = getOrganizationUnitKey('教育局/教务处');
    const keyB = getOrganizationUnitKey('教育局-信息中心');
    const keyC = getOrganizationUnitKey('教育局（办公室）');

    expect(keyA).toBe('教育局');
    expect(keyB).toBe('教育局');
    expect(keyC).toBe('教育局');
  });

  it('returns 10 distinct colors for 10 distinct units', () => {
    const orgs = [
      '单位A',
      '单位B',
      '单位C',
      '单位D',
      '单位E',
      '单位F',
      '单位G',
      '单位H',
      '单位I',
      '单位J',
    ];

    const resolve = buildOrganizationColorResolver(orgs);
    const colors = orgs.map(org => resolve(org));
    const uniqueColors = new Set(colors.filter(Boolean));

    expect(uniqueColors.size).toBe(10);
  });

  it('keeps same color for same unit with different departments', () => {
    const resolve = buildOrganizationColorResolver([
      '教育局/教务处',
      '教育局/信息中心',
      '财政局/预算处',
    ]);

    const a = resolve('教育局/教务处');
    const b = resolve('教育局/信息中心');
    const c = resolve('财政局/预算处');

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
