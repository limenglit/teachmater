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
    // Default membersPerTeam=4, 9 students => ceil(9/4) = 3 teams
    fireEvent.click(screen.getByText('自动建队'));
    // Count team name inputs or person count labels
    const personLabels = screen.getAllByText(/人$/);
    expect(personLabels.length).toBe(3);
  });

  it('membersPerTeam input keeps minimum but has no upper cap', () => {
    render(<TeamBuilder />, { wrapper });
    const input = screen.getByDisplayValue('4');
    fireEvent.change(input, { target: { value: '0' } });
    expect((input as HTMLInputElement).value).toBe('2');
    fireEvent.change(input, { target: { value: '20' } });
    expect((input as HTMLInputElement).value).toBe('20');
  });

  it('all students present with no duplicates after auto-team', () => {
    render(<TeamBuilder />, { wrapper });
    fireEvent.click(screen.getByText('自动建队'));
    for (let i = 1; i <= 9; i++) {
      const matches = screen.getAllByText(`成员${i}`);
      expect(matches).toHaveLength(1);
    }
  });

  it('shows empty state before auto-team is clicked', () => {
    render(<TeamBuilder />, { wrapper });
    // Before clicking auto-team, should show empty prompt
    expect(screen.getByText(/点击.*自动建队/)).toBeInTheDocument();
  });
});
