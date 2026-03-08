import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GroupManager from './GroupManager';
import { StudentProvider } from '@/contexts/StudentContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

const STORAGE_KEY = 'teachmate_students';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LanguageProvider><StudentProvider>{children}</StudentProvider></LanguageProvider>
);

describe('GroupManager', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      Array.from({ length: 10 }, (_, i) => ({ id: `s_${i}`, name: `学生${i + 1}` }))
    ));
  });

  it('does not generate groups when student list is empty', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    render(<GroupManager />, { wrapper });
    fireEvent.click(screen.getByText('自动分组'));
    // Should not show any person count labels
    expect(screen.queryByText(/人$/)).not.toBeInTheDocument();
  });

  it('auto-groups with person count conservation', () => {
    render(<GroupManager />, { wrapper });
    fireEvent.click(screen.getByText('自动分组'));
    // All 10 students should appear
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`学生${i}`)).toBeInTheDocument();
    }
  });

  it('group count input is clamped between 2 and 10', () => {
    render(<GroupManager />, { wrapper });
    const input = screen.getByDisplayValue('4');
    fireEvent.change(input, { target: { value: '1' } });
    expect((input as HTMLInputElement).value).toBe('2');
    fireEvent.change(input, { target: { value: '15' } });
    expect((input as HTMLInputElement).value).toBe('10');
  });

  it('groups are balanced (difference <= 1)', () => {
    render(<GroupManager />, { wrapper });
    fireEvent.click(screen.getByText('自动分组'));
    // 10 students / 4 groups => counts should differ by at most 1
    const personCounts = screen.getAllByText(/人$/).map(el => parseInt(el.textContent || '0'));
    const min = Math.min(...personCounts);
    const max = Math.max(...personCounts);
    expect(max - min).toBeLessThanOrEqual(1);
    expect(personCounts.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('no duplicate students across groups', () => {
    render(<GroupManager />, { wrapper });
    fireEvent.click(screen.getByText('自动分组'));
    for (let i = 1; i <= 10; i++) {
      expect(screen.getAllByText(`学生${i}`)).toHaveLength(1);
    }
  });
});
