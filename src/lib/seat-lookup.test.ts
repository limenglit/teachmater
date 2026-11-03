import { describe, it, expect } from 'vitest';
import { buildSeatLookupPayload, findSeatByName, buildSeatShareTitle } from './seat-lookup';

describe('seat lookup', () => {
  const payload = buildSeatLookupPayload({
    seats: [['张伟', null, '李明'], ['王 芳', '赵六', null]],
    disabledSeats: ['1-1'],
    doorOnRight: false,
    labels: [{ name: '张伟', label: '第1行第1列' }, { name: '李明', label: '第1行第3列' }],
  });

  it('keeps only seated students outside closed seats', () => {
    expect(payload.entries.map(e => e.name)).toEqual(['张伟', '李明', '王 芳']);
    expect(payload.cells[1][1]).toBe('');
  });

  it('finds a student seat ignoring spaces', () => {
    expect(findSeatByName(payload, '李明')?.label).toBe('第1行第3列');
    expect(findSeatByName(payload, '王芳')).toMatchObject({ r: 1, c: 0 });
    expect(findSeatByName(payload, '赵六')).toBeNull();
  });

  it('puts the class name in the title', () => {
    expect(buildSeatShareTitle('智能科学与技术1班', '2026/11/2')).toBe('智能科学与技术1班 · 座位表 · 2026/11/2');
  });
});

import { buildSeatLookupGroups, findGroupByName } from './seat-lookup';
describe('seat lookup groups', () => {
  it('finds a seated student group with its leader', () => {
    const g = buildSeatLookupGroups([{ name: '第一组', members: [{ name: '张三', leader: true }, { name: '李四' }] }], ['张三', '李四']);
    expect(findGroupByName(g, ' 李四 ')).toEqual({ name: '第一组', leader: '张三', members: ['张三', '李四'] });
  });
  it('drops groups from another class', () => {
    expect(buildSeatLookupGroups([{ name: '甲', members: [{ name: '王五' }, { name: '赵六' }] }], ['张三'])).toEqual([]);
  });
});
