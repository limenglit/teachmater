import { describe, it, expect } from 'vitest';
import {
  syncBucketMembers, findUnassigned, fillSmallestBuckets,
  diffRoster, applyRosterDiffToNames, findUnseated, fillEmptySeats,
} from './roster-sync';

type M = { id: string; name: string; isLeader: boolean };
const ops = { isLeader: (m: M) => m.isLeader, makeLeader: (m: M) => ({ ...m, isLeader: true }) };
const mem = (id: string, name: string, isLeader = false): M => ({ id, name, isLeader });

describe('roster sync for groups/teams', () => {
  const groups = [
    { id: 'g1', members: [mem('a', '张三', true), mem('b', '李四')] },
    { id: 'g2', members: [mem('c', '王五', true), mem('d', '赵六')] },
  ];

  it('renaming a student keeps the group and leader role', () => {
    const res = syncBucketMembers(groups, [
      { id: 'a', name: '张三丰' }, { id: 'b', name: '李四' }, { id: 'c', name: '王五' }, { id: 'd', name: '赵六' },
    ], ops);
    expect(res.buckets[0].members[0]).toEqual(mem('a', '张三丰', true));
    expect(res.renamed).toEqual([{ from: '张三', to: '张三丰' }]);
  });

  it('removing a leader promotes the first remaining member', () => {
    const res = syncBucketMembers(groups, [
      { id: 'b', name: '李四' }, { id: 'c', name: '王五' }, { id: 'd', name: '赵六' },
    ], ops);
    expect(res.buckets[0].members).toEqual([mem('b', '李四', true)]);
    expect(res.removed).toEqual(['张三']);
    expect(res.promoted).toEqual(['李四']);
  });

  it('a different class roster leaves groups untouched', () => {
    const res = syncBucketMembers(groups, [{ id: 'x', name: '甲' }, { id: 'y', name: '乙' }, { id: 'a', name: '张三' }], ops);
    expect(res.mismatched).toBe(true);
    expect(res.buckets).toBe(groups);
  });

  it('new students are listed as pending, never auto-placed', () => {
    const roster = [
      { id: 'a', name: '张三' }, { id: 'b', name: '李四' }, { id: 'c', name: '王五' }, { id: 'd', name: '赵六' },
      { id: 'e', name: '新同学' },
    ];
    const res = syncBucketMembers(groups, roster, ops);
    expect(res.changed).toBe(false);
    expect(findUnassigned(res.buckets, roster).map(s => s.name)).toEqual(['新同学']);
  });

  it('one-click fill adds new members to the smallest groups', () => {
    const uneven = [
      { id: 'g1', members: [mem('a', 'A'), mem('b', 'B'), mem('c', 'C')] },
      { id: 'g2', members: [mem('d', 'D')] },
      { id: 'g3', members: [mem('e', 'E'), mem('f', 'F')] },
    ];
    const next = fillSmallestBuckets(uneven, [mem('x', 'X'), mem('y', 'Y')]);
    expect(next.map(g => g.members.length)).toEqual([3, 3, 2]);
    expect(next[1].members.map(m => m.name)).toEqual(['D', 'X', 'Y']);
  });
});

describe('roster sync for seat charts', () => {
  const prev = [{ id: 'a', name: '张三' }, { id: 'b', name: '李四' }, { id: 'c', name: '王五' }];

  it('rename replaces the seated name in place; removal frees the seat', () => {
    const next = [{ id: 'a', name: '张三丰' }, { id: 'b', name: '李四' }];
    const diff = diffRoster(prev, next);
    const res = applyRosterDiffToNames(['张三', null, '李四', '王五'], diff, next);
    expect(res.cells).toEqual(['张三丰', null, '李四', null]);
    expect(res.cleared).toEqual(['王五']);
  });

  it('students without a seat are listed as unseated', () => {
    const roster = [...prev, { id: 'd', name: '新同学' }];
    expect(findUnseated(roster, ['张三', null, '李四', '王五']).map(s => s.name)).toEqual(['新同学']);
  });

  it('one-click seat fill uses front rows first and skips closed seats', () => {
    const grid = [['A', null, null], [null, null, 'B']];
    const res = fillEmptySeats(grid, ['X', 'Y', 'Z'], (r, c) => !(r === 0 && c === 1), [0, 1, 2]);
    expect(res.grid).toEqual([['A', null, 'X'], ['Y', 'Z', 'B']]);
    expect(res.placed).toBe(3);
  });
});
