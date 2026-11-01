import { describe, it, expect } from 'vitest';
import { buildDiceBuckets, diceCountFor, facesForNumber, formatBucketLabel, pickBucket, speechLabel } from './dice-pick';

describe('dice-pick', () => {
  it('keeps the original group number when an earlier group has no current students', () => {
    const buckets = buildDiceBuckets(
      [
        { id: 'a', name: '第一组', members: [{ id: 'gone' }] },
        { id: 'b', name: '第二组', members: [{ id: 's1' }] },
      ],
      new Set(['s1']),
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0].number).toBe(2);
  });

  it('shows default names as-is and prefixes custom names with the number', () => {
    expect(formatBucketLabel({ key: 'a', number: 1, name: '第一组', memberCount: 3 }, '第{0}组')).toBe('第一组');
    expect(formatBucketLabel({ key: 'a', number: 1, name: '飞鹰组', memberCount: 3 }, '第{0}组')).toBe('第1组（飞鹰组）');
    expect(speechLabel('第1组（飞鹰组）')).toBe('第1组，飞鹰组');
  });

  it('uses 1 die up to 6 groups and 2 dice above 6', () => {
    expect(diceCountFor(6)).toBe(1);
    expect(diceCountFor(7)).toBe(2);
    expect(facesForNumber(4, 1)).toEqual([4]);
    expect(facesForNumber(8, 2)).toEqual([2, 2]);
    expect(facesForNumber(12, 2)).toEqual([2, 6]);
  });

  it('skips already-picked groups when no-repeat is on', () => {
    const buckets = [
      { key: 'a', number: 1, name: '第一组', memberCount: 1 },
      { key: 'b', number: 2, name: '第二组', memberCount: 1 },
    ];
    expect(pickBucket(buckets, new Set(['a']), true, () => 0)?.key).toBe('b');
    expect(pickBucket(buckets, new Set(['a', 'b']), true, () => 0)).toBeNull();
    expect(pickBucket(buckets, new Set(['a', 'b']), false, () => 0)?.key).toBe('a');
  });
});
