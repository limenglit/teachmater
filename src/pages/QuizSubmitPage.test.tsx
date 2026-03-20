import { render, screen, waitFor } from '@testing-library/react';
import QuizSubmitPage from './QuizSubmitPage';

const rpcMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ sessionId: 'session-1' }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
  },
}));

describe('QuizSubmitPage ended result visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('quiz-student-name', '张三');

    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_quiz_session_for_student') {
        return Promise.resolve({
          data: {
            id: 'session-1',
            title: '单元测验',
            status: 'ended',
            reveal_answers: true,
            student_names: ['张三'],
            questions: [
              {
                type: 'single',
                content: '1+1=?',
                options: ['1', '2', '3', '4'],
                correct_answer: 'B',
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
            answers: [{ question_index: 0, answer: 'B', is_correct: true }],
            correct_count: 1,
            objective_total: 1,
          },
          error: null,
        });
      }

      return Promise.resolve({ data: null, error: null });
    });
  });

  it('shows correct answers and score after session ended', async () => {
    render(<QuizSubmitPage />);

    await waitFor(() => {
      expect(screen.getByText('参考答案：B. 2')).toBeInTheDocument();
    });

    expect(screen.getByText('成绩：1 / 1')).toBeInTheDocument();
    expect(screen.getByText('你的作答：B')).toBeInTheDocument();
  });
});
