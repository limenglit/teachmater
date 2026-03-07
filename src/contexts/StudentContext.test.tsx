import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStudents } from './StudentContext';

describe('StudentContext', () => {
  // Case 7: 在未包裹 Provider 时抛出约束错误
  it('throws when useStudents is used outside StudentProvider', () => {
    expect(() => {
      renderHook(() => useStudents());
    }).toThrow('useStudents must be used within StudentProvider');
  });
});
