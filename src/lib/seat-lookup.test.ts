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
