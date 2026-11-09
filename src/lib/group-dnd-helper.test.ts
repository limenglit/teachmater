import { describe, it, expect } from 'vitest';
import { applyStudentToGroups, resolveRosterStudent } from './group-dnd-helper';
const mk = (s: any) => ({ ...s, isLeader: false });
const g = () => [
  { id: 'a', members: [{ id: '1', name: '张', isLeader: true }, { id: '2', name: '李', isLeader: false }] },
  { id: 'b', members: [{ id: '3', name: '王', isLeader: false }] },
];
describe('applyStudentToGroups', () => {
  it('adds an ungrouped student at index', () => {
    const r = applyStudentToGroups(g(), { id: '9', name: '赵' }, 'b', 0, mk);
    expect(r[1].members.map(m => m.id)).toEqual(['9', '3']);
  });
  it('moves across groups and clears leader title', () => {
    const r = applyStudentToGroups(g(), { id: '1', name: '张' }, 'b', 1, mk);
    expect(r[0].members.map(m => m.id)).toEqual(['2']);
    expect(r[1].members[1]).toEqual({ id: '1', name: '张', isLeader: false });
  });
  it('reorders within same group keeping title', () => {
    const r = applyStudentToGroups(g(), { id: '1', name: '张' }, 'a', 2, mk);
    expect(r[0].members.map(m => m.id)).toEqual(['2', '1']);
    expect(r[0].members[1].isLeader).toBe(true);
  });
  it('prefers id over name for duplicates', () => {
    expect(resolveRosterStudent('b', '张', [{ id: 'a', name: '张' }, { id: 'b', name: '张' }])?.id).toBe('b');
  });
});
