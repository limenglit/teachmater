import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      expect(screen.getByText((_text, el) => el?.tagName === 'P' && el.textContent === '参考答案：B. 2')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('get_quiz_student_result', expect.objectContaining({
        p_session_id: 'session-1',
        p_student_name: '张三',
      }));
    });

    await waitFor(() => {
      expect(screen.getByText('成绩：1 / 1')).toBeInTheDocument();
    });
    expect(screen.getByText((_text, el) => el?.tagName === 'P' && el.textContent === '你的作答：B')).toBeInTheDocument();
  });

  it('normalizes student name before submitting answers', async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_quiz_session_for_student') {
        return Promise.resolve({
          data: {
            id: 'session-1',
            title: '单元测验',
            status: 'active',
            reveal_answers: false,
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

      if (fn === 'submit_quiz_answers') {
        return Promise.resolve({ error: null });
      }

      return Promise.resolve({ data: null, error: null });
    });

    localStorage.setItem('quiz-student-name', ' 张三　');

    render(<QuizSubmitPage />);

    const startButton = await screen.findByRole('button', { name: 'quiz.startAnswer' });
    fireEvent.click(startButton);

    const optionB = await screen.findByRole('radio', { name: '2' });
    fireEvent.click(optionB);

    fireEvent.click(screen.getByRole('button', { name: 'quiz.submit' }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('submit_quiz_answers', expect.objectContaining({
        p_session_id: 'session-1',
        p_student_name: '张三',
      }));
    });
  });

  it('renders formulas in questions, options, submitted and reference answers', async () => {
    const chemistry = '$\\ce{2H2O -> 2H2 ^ + O2 ^}$';
    rpcMock.mockImplementation((fn: string) => Promise.resolve({
      error: null,
      data: fn === 'get_quiz_session_for_student' ? {
        id: 'session-1', title: '学科公式核对', status: 'ended', reveal_answers: true,
        student_names: ['张三'], questions: [
          { type: 'single', content: '$x_{1}^{2}$', options: ['$\\frac{1}{2}$', '$2$'], correct_answer: 'A' },
          { type: 'short', content: '\\(E_k=\\frac{1}{2}mv^2\\)', options: [], correct_answer: chemistry },
        ],
      } : { student_name: '张三', answers: [{ question_index: 1, answer: chemistry }], correct_count: 0, objective_total: 1 },
    }));
    const { container } = render(<QuizSubmitPage />);
    await waitFor(() => expect(container.querySelectorAll('[role="math"]').length).toBeGreaterThanOrEqual(7));
    expect(container.querySelector('.katex-error')).toBeNull();
    const review = container.querySelector('#quiz-review-q-1');
    expect(review?.querySelectorAll('p [role="math"]')).toHaveLength(3);
  });
});
