import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuizPanel from './QuizPanel';
import QuizSubmitPage from '@/pages/QuizSubmitPage';

const rpcMock = vi.fn();
const toastMock = vi.fn();

let quizEnded = false;

const buildSession = () => ({
  id: 'session-1',
  user_id: 'teacher-1',
  creator_token: 'token-1',
  title: '联动测验',
  questions: [
    {
      id: 'q1',
      type: 'single',
      content: '2+2=?',
      options: ['1', '2', '3', '4'],
      correct_answer: 'D',
    },
  ],
  status: quizEnded ? 'ended' : 'active',
  reveal_answers: quizEnded,
  student_names: ['张三'],
  created_at: '2026-03-20T10:00:00.000Z',
  ended_at: quizEnded ? '2026-03-20T10:10:00.000Z' : null,
});

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

vi.mock('react-router-dom', () => ({
  useParams: () => ({ sessionId: 'session-1' }),
}));

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
      if (table === 'quiz_sessions') return buildQueryResult([buildSession()]);
      if (table === 'quiz_questions') return buildQueryResult([]);
      if (table === 'quiz_categories') return buildQueryResult([]);
      if (table === 'quiz_papers') return buildQueryResult([]);
      if (table === 'quiz_answers') return buildQueryResult([]);
      return buildQueryResult([]);
    },
    rpc: (...args: any[]) => rpcMock(...args),
  },
}));

describe.skip('Quiz end-to-student polling chain', () => {
  beforeEach(() => {
    quizEnded = false;
    rpcMock.mockReset();
    toastMock.mockReset();
    localStorage.clear();
    localStorage.setItem('quiz-student-name', '张三');

    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'update_quiz_session') {
        quizEnded = true;
        return Promise.resolve({ error: null });
      }

      if (fn === 'get_quiz_session_for_student') {
        if (quizEnded) {
          return Promise.resolve({
            data: {
              id: 'session-1',
              title: '联动测验',
              status: 'ended',
              reveal_answers: true,
              student_names: ['张三'],
              questions: [
                {
                  type: 'single',
                  content: '2+2=?',
                  options: ['1', '2', '3', '4'],
                  correct_answer: 'D',
                },
              ],
            },
            error: null,
          });
        }

        return Promise.resolve({
          data: {
            id: 'session-1',
            title: '联动测验',
            status: 'active',
            reveal_answers: false,
            student_names: ['张三'],
            questions: [
              {
                type: 'single',
                content: '2+2=?',
                options: ['1', '2', '3', '4'],
              },
            ],
          },
          error: null,
        });
      }

      if (fn === 'get_quiz_student_result') {
        return Promise.resolve({
          data: {
            student_name: '张三',
            answers: [{ question_index: 0, answer: 'D', is_correct: true }],
            correct_count: 1,
            objective_total: 1,
          },
          error: null,
        });
      }

      return Promise.resolve({ data: null, error: null });
    });
  });

  it('teacher ends quiz and student sees ended score card after polling', async () => {
    render(
      <>
        <QuizPanel />
        <QuizSubmitPage />
      </>
    );

    // Teacher: open sessions tab and enter active session.
    fireEvent.click(screen.getByText('quiz.recentSessions'));
    await waitFor(() => {
      expect(screen.getByText('联动测验')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('联动测验'));

    // Teacher: end session via confirm dialog.
    const endBtn = await screen.findByRole('button', { name: 'quiz.endSession' });
    fireEvent.click(endBtn);
    const confirmBtn = await screen.findByRole('button', { name: '确认结束' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('update_quiz_session', expect.objectContaining({
        p_session_id: 'session-1',
        p_status: 'ended',
        p_reveal_answers: true,
      }));
    });

    // Student: after one polling cycle, ended answer+score card should be shown.
    await waitFor(() => {
      expect(screen.getByText('参考答案：D. 4')).toBeInTheDocument();
    }, { timeout: 8000 });
    expect(screen.getByText('成绩：1 / 1')).toBeInTheDocument();
  });
});
