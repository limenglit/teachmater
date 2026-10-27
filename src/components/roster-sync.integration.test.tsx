import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import GroupManager from './GroupManager';
import TeamBuilder from './TeamBuilder';
import { StudentProvider, useStudents } from '@/contexts/StudentContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

let api: ReturnType<typeof useStudents>;
function Grab() { api = useStudents(); return null; }

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LanguageProvider><StudentProvider><Grab />{children}</StudentProvider></LanguageProvider>
);

describe('roster edits after grouping', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('teachmate_students', JSON.stringify(
      Array.from({ length: 8 }, (_, i) => ({ id: `s_${i}`, name: `学生${i + 1}` })),
    ));
  });

  it('groups: rename passes through, new student waits for one-click fill, removed leader is replaced', () => {
    render(<GroupManager />, { wrapper });
    fireEvent.click(screen.getByText('自动分组'));
    expect(screen.getAllByLabelText('组长')).toHaveLength(4);

    act(() => api.updateStudent('s_0', '改名同学'));
    expect(screen.getByText('改名同学')).toBeInTheDocument();
    expect(screen.queryByText('学生1')).toBeNull();

    act(() => api.addStudent('新来的'));
    expect(screen.getByText('有 1 位新同学待分配')).toBeInTheDocument();
    fireEvent.click(screen.getByText('一键补员'));
    expect(screen.queryByText(/位新同学待分配/)).toBeNull();
    expect(screen.getAllByText('新来的')).toHaveLength(1);

    const leaders = screen.getAllByLabelText('组长');
    const leaderName = leaders[0].closest('div')!.querySelector('span.flex-1')!.textContent!;
    const leaderId = api.students.find(s => s.name === leaderName)!.id;
    act(() => api.removeStudent(leaderId));
    expect(screen.queryByText(leaderName)).toBeNull();
    expect(screen.getAllByLabelText('组长')).toHaveLength(4);
  });

  it('teams: new student is pending until filled', () => {
    render(<TeamBuilder />, { wrapper });
    fireEvent.click(screen.getByText('自动建队'));
    act(() => api.addStudent('新队员'));
    expect(screen.getByText('有 1 位新同学待分配')).toBeInTheDocument();
    fireEvent.click(screen.getByText('一键补员'));
    expect(screen.getAllByText('新队员')).toHaveLength(1);
  });
});

describe('roster edits after seating', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('teachmate_students', JSON.stringify(
      Array.from({ length: 6 }, (_, i) => ({ id: `s_${i}`, name: `学生${i + 1}` })),
    ));
  });

  it('seat chart: rename in place, removal frees the seat, new student waits for one-click seat fill', async () => {
    const { default: SeatChart } = await import('./SeatChart');
    render(<SeatChart />, { wrapper });
    fireEvent.click(screen.getByText('自动排座'));
    expect(screen.getAllByText('学生1').length).toBeGreaterThan(0);

    act(() => api.updateStudent('s_0', '改名同学'));
    expect(screen.queryAllByText('学生1')).toHaveLength(0);
    expect(screen.getAllByText('改名同学').length).toBeGreaterThan(0);

    act(() => api.removeStudent('s_1'));
    expect(screen.queryAllByText('学生2')).toHaveLength(0);

    act(() => api.addStudent('新来的'));
    expect(screen.getByText('有 1 位同学未就座')).toBeInTheDocument();
    fireEvent.click(screen.getByText('一键补座'));
    expect(screen.queryByText(/位同学未就座/)).toBeNull();
    expect(screen.getAllByText('新来的').length).toBeGreaterThan(0);
  }, 20000);
});
