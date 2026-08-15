import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BoardCardItem from './BoardCardItem';
import type { BoardCard } from '@/components/BoardPanel';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }),
      insert: async () => ({ error: null }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

const LONG_TEXT = Array.from({ length: 12 }, (_, i) => `line ${i} ${'x'.repeat(30)}`).join('\n');

function makeCard(overrides: Partial<BoardCard> = {}): BoardCard {
  return {
    id: 'card-1',
    board_id: 'board-1',
    content: LONG_TEXT,
    card_type: 'text',
    media_url: '',
    url: '',
    color: '#ffffff',
    author_nickname: 'Alice',
    is_pinned: false,
    is_approved: true,
    likes_count: 0,
    column_id: '',
    position_x: 0,
    position_y: 0,
    sort_order: 0,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as BoardCard;
}

function getContentParagraph(snippet: string) {
  return screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes(snippet));
}

function renderCard(card: BoardCard) {
  return render(
    <BoardCardItem card={card} onManage={() => {}} onLike={() => {}} isCreator={false} />,
  );
}

function setClipboard(impl: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(impl) },
  });
}

describe('BoardCardItem long content folding', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    setClipboard(async () => {});
  });

  it('collapses long content and shows expand toggle', () => {
    renderCard(makeCard());
    const paragraph = getContentParagraph('line 0');
    expect(paragraph.className).toContain('max-h-40');
    expect(screen.getByText('board.expand')).toBeInTheDocument();
  });

  it('expands and collapses on toggle click', () => {
    renderCard(makeCard());
    fireEvent.click(screen.getByText('board.expand'));
    expect(getContentParagraph('line 0').className).not.toContain('max-h-40');
    expect(screen.getByText('board.collapse')).toBeInTheDocument();

    fireEvent.click(screen.getByText('board.collapse'));
    expect(getContentParagraph('line 0').className).toContain('max-h-40');
  });

  it('keeps original line breaks and indentation via whitespace-pre-wrap', () => {
    const indented = `function a() {\n    const b = 1;\n\treturn b;\n}`;
    renderCard(makeCard({ content: indented + '\n'.repeat(8) }));
    const paragraph = getContentParagraph('const b = 1;');
    expect(paragraph.className).toContain('whitespace-pre-wrap');
    expect(paragraph.textContent).toContain('    const b = 1;');
    expect(paragraph.textContent).toContain('\treturn b;');
  });

  it('does not show toggle for short content', () => {
    renderCard(makeCard({ content: 'short' }));
    expect(screen.queryByText('board.expand')).not.toBeInTheDocument();
    expect(screen.queryByText('board.copyContent')).not.toBeInTheDocument();
  });
});

describe('BoardCardItem copy feedback', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('copies content and shows success status + toast', async () => {
    setClipboard(async () => {});
    renderCard(makeCard());

    fireEvent.click(screen.getByTitle('board.copyContent'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(LONG_TEXT);
      expect(toastSuccess).toHaveBeenCalledWith('board.copySuccess');
      expect(screen.getByText('board.copied')).toBeInTheDocument();
      expect(screen.getByText('board.copySuccess')).toBeInTheDocument();
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('shows error status + toast when clipboard write fails', async () => {
    setClipboard(async () => {
      throw new Error('denied');
    });
    renderCard(makeCard());

    fireEvent.click(screen.getByTitle('board.copyContent'));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('board.copyFailed');
      expect(screen.getByText('board.copyFailed')).toBeInTheDocument();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.queryByText('board.copied')).not.toBeInTheDocument();
  });

  it('resets copy status after the 2s timeout', async () => {
    vi.useFakeTimers();
    setClipboard(async () => {});
    renderCard(makeCard());

    fireEvent.click(screen.getByTitle('board.copyContent'));
    await vi.waitFor(() => expect(screen.getByText('board.copied')).toBeInTheDocument());

    vi.advanceTimersByTime(2100);
    await vi.waitFor(() => expect(screen.queryByText('board.copied')).not.toBeInTheDocument());
    vi.useRealTimers();
  });
});
