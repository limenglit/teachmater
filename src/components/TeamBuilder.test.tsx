import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TeamBuilder from './TeamBuilder';
import { StudentProvider } from '@/contexts/StudentContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

const STORAGE_KEY = 'teachmate_students';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LanguageProvider><StudentProvider>{children}</StudentProvider></LanguageProvider>
);

describe('TeamBuilder', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      Array.from({ length: 9 }, (_, i) => ({ id: `s_${i}`, name: `成员${i + 1}` }))
    ));
  });

  it('team count = ceil(total / membersPerTeam)', () => {
    render(<TeamBuilder />, { wrapper });
    // Default membersPerTeam=4, 9 students => 3 teams
    fireEvent.click(screen.getByText('自动建队'));
    // Should have 3 teams
    const teamHeaders = screen.getAllByText(/队$/);
    expect(teamHeaders.length).toBe(3);
  });

  it('membersPerTeam input is clamped 2-10', () => {
    render(<TeamBuilder />, { wrapper });
    const input = screen.getByDisplayValue('4');
    fireEvent.change(input, { target: { value: '0' } });
    expect((input as HTMLInputElement).value).toBe('2');
    fireEvent.change(input, { target: { value: '20' } });
    expect((input as HTMLInputElement).value).toBe('10');
  });

  it('all students present with no duplicates after auto-team', () => {
    render(<TeamBuilder />, { wrapper });
    fireEvent.click(screen.getByText('自动建队'));
    for (let i = 1; i <= 9; i++) {
      const matches = screen.getAllByText(`成员${i}`);
      expect(matches).toHaveLength(1);
    }
  });

  it('does not generate teams when list is empty', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    render(<TeamBuilder />, { wrapper });
    fireEvent.click(screen.getByText('自动建队'));
    expect(screen.queryByText(/队$/)).not.toBeInTheDocument();
  });
});
