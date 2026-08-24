import { describe, expect, it } from 'vitest';
import { getSeatNeighbors, describeNeighbor, pickCheckedInNeighbor } from './seat-neighbors';

const grid = [
  ['A1', 'A2', 'A3'],
  ['B1', '我', 'B3'],
  ['C1', 'C2', 'C3'],
];

describe('getSeatNeighbors', () => {
  it('returns classroom neighbours in front/back/left/right priority', () => {
    expect(getSeatNeighbors('classroom', grid, '我')).toEqual([
      { name: 'A2', relation: 'front' },
      { name: 'C2', relation: 'back' },
      { name: 'B1', relation: 'left' },
      { name: 'B3', relation: 'right' },
    ]);
  });

  it('ignores empty seats and unknown students', () => {
    const sparse = [[null, null], ['我', null]];
    expect(getSeatNeighbors('classroom', sparse, '我')).toEqual([]);
    expect(getSeatNeighbors('classroom', grid, '不存在')).toEqual([]);
  });

  it('handles table scenes as side neighbours', () => {
    const tables = [{ seats: ['甲', '我', '乙'] }];
    expect(getSeatNeighbors('smartClassroom', tables, '我')).toEqual([
      { name: '甲', relation: 'side' },
      { name: '乙', relation: 'side' },
    ]);
  });
});

describe('pickCheckedInNeighbor', () => {
  it('picks the highest priority checked-in neighbour', () => {
    const neighbors = getSeatNeighbors('classroom', grid, '我');
    expect(pickCheckedInNeighbor(neighbors, ['B3', 'C2'])?.name).toBe('C2');
    expect(pickCheckedInNeighbor(neighbors, [' A2 ', 'C2'])?.relation).toBe('front');
    expect(pickCheckedInNeighbor(neighbors, ['无人'])).toBeNull();
  });

  it('describes the relative position', () => {
    expect(describeNeighbor({ name: '张三', relation: 'front' })).toBe('您在 张三 的后面');
    expect(describeNeighbor({ name: '张三', relation: 'back' })).toBe('您在 张三 的前面');
    expect(describeNeighbor({ name: '张三', relation: 'left' })).toBe('您在 张三 的右边');
    expect(describeNeighbor({ name: '张三', relation: 'right' })).toBe('您在 张三 的左边');
  });
});
