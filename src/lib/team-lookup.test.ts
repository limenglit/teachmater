import { describe, it, expect } from 'vitest';
import { buildNamePool, suggestNames, findTeamByName, buildTeamShareTitle } from './team-lookup';

const teams = [
  { name: '第1组', members: [{ name: '李明' }, { name: '张伟' }] },
  { name: '第2组', members: [{ name: '李华' }, { name: '王李' }, { name: ' 李明 ' }] },
];

describe('team lookup name pool', () => {
  it('collects every member name once across all groups', () => {
    const pool = buildNamePool(teams);
    expect(pool).toHaveLength(4);
    expect(new Set(pool)).toEqual(new Set(['李明', '张伟', '李华', '王李']));
  });

  it('typing 李 suggests names starting with 李 before names containing it', () => {
    const s = suggestNames(buildNamePool(teams), '李');
    expect(s.slice(0, 2).sort()).toEqual(['李华', '李明'].sort());
    expect(s[2]).toBe('王李');
    expect(s).not.toContain('张伟');
  });

  it('empty input shows the whole class list', () => {
    expect(suggestNames(buildNamePool(teams), '')).toHaveLength(4);
  });

  it('finds the group even with stray spaces in the typed name', () => {
    expect(findTeamByName(teams, ' 张 伟')?.name).toBe('第1组');
    expect(findTeamByName(teams, '赵六')).toBeNull();
  });
});

describe('team share title', () => {
  it('starts with the class name when one is loaded', () => {
    expect(buildTeamShareTitle('智能科学与技术1班', 6, 'groups', '2026/11/2')).toBe('智能科学与技术1班 · 6个组 · 2026/11/2');
    expect(buildTeamShareTitle('', 4, 'teams', '2026/11/2')).toBe('4个队 · 2026/11/2');
  });
});
