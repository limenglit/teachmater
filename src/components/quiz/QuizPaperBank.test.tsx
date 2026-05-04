import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import QuizPaperBank from './QuizPaperBank';
import type { QuizPaper } from './quizTypes';
import { exportQuizPaper } from './quizPaperExport';

vi.mock('@/components/ui/select', async () => {
  const React = await import('react');

  const SelectItem = ({ value, children }: any) => React.createElement('option', { value }, children);

  const collectItems = (children: React.ReactNode): Array<React.ReactElement<{ value: string }>> => {
    const items: Array<React.ReactElement<{ value: string }>> = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === SelectItem) {
        items.push(child as React.ReactElement<{ value: string }>);
      }
      if (child.props?.children) {
        items.push(...collectItems(child.props.children));
      }
    });
    return items;
  };

  return {
    Select: ({ value, onValueChange, children }: any) => {
      const items = collectItems(children);
      return React.createElement(
        'select',
        {
          'aria-label': 'export-format',
          value,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onValueChange(event.target.value),
        },
        items.map((item) => React.createElement('option', { key: item.props.value, value: item.props.value }, item.props.children)),
      );
    },
    SelectTrigger: ({ children }: any) => React.createElement(React.Fragment, null, children),
    SelectContent: ({ children }: any) => React.createElement(React.Fragment, null, children),
    SelectItem,
    SelectValue: () => null,
  };
});

vi.mock('@/components/ui/checkbox', async () => {
  const React = await import('react');
  return {
    Checkbox: ({ checked, onCheckedChange }: any) => React.createElement('input', {
      type: 'checkbox',
      checked: !!checked,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onCheckedChange(event.target.checked),
    }),
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('./quizPaperExport', async () => {
  const actual = await vi.importActual<typeof import('./quizPaperExport')>('./quizPaperExport');
  return {
    ...actual,
    exportQuizPaper: vi.fn().mockResolvedValue(undefined),
  };
});

const samplePaper: QuizPaper = {
  id: 'paper-1',
  user_id: 'local',
  title: '生物单元测验',
  description: '用于导出测试',
  questions: [
    {
      question_id: 'q1',
      score: 5,
      order: 0,
      question: {
        id: 'q1',
        user_id: 'local',
        type: 'single',
        content: '光合作用主要发生在哪里？',
        options: ['A. 叶绿体', 'B. 线粒体', 'C. 细胞膜', 'D. 液泡'],
        correct_answer: 'A',
        tags: 'biology',
        created_at: new Date().toISOString(),
        explanation: '叶绿体中含有叶绿素，是光合作用的主要场所。',
      } as any,
    },
  ],
  template: null,
  total_score: 5,
  is_template: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('QuizPaperBank export dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses xlsx without answers by default', async () => {
    render(<QuizPaperBank papers={[samplePaper]} setPapers={vi.fn()} questions={[]} isGuest />);

    fireEvent.click(screen.getByTitle('quiz.paper.export'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'quiz.paper.export' }));

    await waitFor(() => {
      expect(exportQuizPaper).toHaveBeenCalledWith(samplePaper, expect.objectContaining({
        format: 'xlsx',
        includeAnswers: false,
      }));
    });
  });

  it('passes selected docx format and includeAnswers flag', async () => {
    render(<QuizPaperBank papers={[samplePaper]} setPapers={vi.fn()} questions={[]} isGuest />);

    fireEvent.click(screen.getByTitle('quiz.paper.export'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('export-format'), { target: { value: 'docx' } });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'quiz.paper.export' }));

    await waitFor(() => {
      expect(exportQuizPaper).toHaveBeenCalledWith(samplePaper, expect.objectContaining({
        format: 'docx',
        includeAnswers: true,
      }));
    });
  });
});