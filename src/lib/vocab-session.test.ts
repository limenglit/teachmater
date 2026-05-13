import { describe, expect, it } from 'vitest';

import {
  normalizeStudentNames,
  resolveRosterStudentName,
} from '@/lib/vocab-session';

describe('vocab-session helpers', () => {
  it('normalizes and deduplicates roster names', () => {
    expect(normalizeStudentNames([' 张三 ', '张三', '李四', '李　四', '']))
      .toEqual(['张三', '李四']);
  });

  it('matches student names against roster with whitespace normalization', () => {
    expect(resolveRosterStudentName(' 张三　', ['张三', '李四'])).toBe('张三');
    expect(resolveRosterStudentName('王五', ['张三', '李四'])).toBeNull();
    expect(resolveRosterStudentName(' 王五 ', [])).toBe('王五');
  });
});