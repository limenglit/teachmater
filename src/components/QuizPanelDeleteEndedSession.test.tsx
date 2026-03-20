import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuizPanel from './QuizPanel';

const rpcMock = vi.fn();
const toastMock = vi.fn();

const endedSession = {
  id: 'session-ended-1',
  user_id: 'teacher-1',
  creator_token: 'token-ended-1',
  title: '已结束测验A',
  questions: [
    {
      id: 'q1',
      type: 'single',
      content: '题目1',
      options: ['A', 'B'],
      correct_answer: 'A',
    },
  ],
  status: 'ended',
  reveal_answers: true,
  student_names: ['张三'],
  created_at: '2026-03-20T10:00:00.000Z',
  ended_at: '2026-03-20T10:10:00.000Z',
};

const buildQueryResult = (rows: any[]) => ({
  eq: () => ({ order: async () => ({ data: rows }) }),
  in: () => ({ order: async () => ({ data: rows }) }),
  select: () => ({
    eq: () => ({ order: async () => ({ data: rows }) }),
    in: () => ({ order: async () => ({ data: rows }) }),
    order: async () => ({ data: rows }),
  }),
  order: async () => ({ data: rows }),
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
  tFormat: (tpl: string, value: number | string) => `${tpl}:${value}`,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'teacher-1' } }),
}));

vi.mock('@/contexts/StudentContext', () => ({
  useStudents: () => ({ students: [] }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: any[]) => toastMock(...args),
}));

vi.mock('@/components/quiz/QuizStatsView', () => ({
  default: () => <div data-testid="quiz-stats-view" />,
}));

vi.mock('@/components/quiz/QuizQuestionBank', () => ({
  default: () => <div data-testid="quiz-bank" />,
}));

vi.mock('@/components/quiz/QuizPaperBank', () => ({
  default: () => <div data-testid="quiz-paper-bank" />,
}));

vi.mock('@/components/quiz/QuizAIGenerator', () => ({
  default: () => <div data-testid="quiz-ai-generator" />,
}));

vi.mock('@/components/ClassRosterPicker', () => ({
  default: () => null,
}));

vi.mock('@/components/qr/QRActionPanel', () => ({
  default: () => <div data-testid="qr-panel" />,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'quiz_sessions') return buildQueryResult([endedSession]);
      if (table === 'quiz_questions') return buildQueryResult([]);
      if (table === 'quiz_categories') return buildQueryResult([]);
      if (table === 'quiz_papers') return buildQueryResult([]);
      if (table === 'quiz_answers') return buildQueryResult([]);
      return buildQueryResult([]);
    },
    rpc: (...args: any[]) => rpcMock(...args),
  },
}));

describe('QuizPanel delete ended session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('quiz-session-tokens', JSON.stringify({ 'session-ended-1': 'token-ended-1' }));
    rpcMock.mockResolvedValue({ error: null });
  });

  it('removes ended session from session list after delete confirmation', async () => {
    render(<QuizPanel />);

    fireEvent.click(screen.getByText('quiz.recentSessions'));

    await waitFor(() => {
      expect(screen.getByText('已结束测验A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('已结束测验A'));

    const detailDeleteButton = await screen.findByTestId('quiz-session-detail-delete-trigger');
    fireEvent.click(detailDeleteButton);

    const confirmDeleteButton = await screen.findByTestId('quiz-session-delete-confirm');
    fireEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('delete_quiz_session', {
        p_session_id: 'session-ended-1',
        p_token: 'token-ended-1',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('已结束测验A')).not.toBeInTheDocument();
    });
  });
});
