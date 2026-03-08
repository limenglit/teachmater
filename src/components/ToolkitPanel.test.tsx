import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ToolkitPanel from './ToolkitPanel';
import { StudentProvider } from '@/contexts/StudentContext';

const renderWithProviders = (ui: React.ReactElement) =>
  render(<StudentProvider>{ui}</StudentProvider>);

vi.mock('./BarrageDiscussion', () => ({
  default: () => <div data-testid="mock-barrage">Barrage</div>,
}));

vi.mock('./CountdownTimer', () => ({
  default: () => <div data-testid="mock-countdown">Countdown</div>,
}));

describe('ToolkitPanel command cards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows 3-6 icon candidates for manual selection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        icons: ['mdi:account', 'lucide:alarm-clock', 'tabler:book', 'ph:chalkboard'],
      }),
    } as Response);

    renderWithProviders(<ToolkitPanel />);

    fireEvent.change(screen.getByPlaceholderText('输入课堂指令主题，如：小组辩论'), {
      target: { value: '小组辩论' },
    });
    fireEvent.click(screen.getByRole('button', { name: '检索徽章' }));

    await waitFor(() => {
      expect(screen.getByText('已找到 4 个候选图标，请点选一个用于“小组辩论”')).toBeInTheDocument();
    });

    const candidateButtons = screen.getAllByTitle(/选择候选/);
    expect(candidateButtons.length).toBe(4);

    fireEvent.click(candidateButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText('小组辩论').length).toBeGreaterThan(0);
    });
  });

  it('falls back to default question mark when search fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    renderWithProviders(<ToolkitPanel />);

    fireEvent.change(screen.getByPlaceholderText('输入课堂指令主题，如：小组辩论'), {
      target: { value: '快速测验' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('输入课堂指令主题，如：小组辩论'), { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('联网检索图标失败，已使用默认“？”图标发布该指令')).toBeInTheDocument();
    });
    expect(screen.getAllByText('快速测验').length).toBeGreaterThan(0);
  });

  it('falls back when candidates are fewer than minimum', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ icons: ['mdi:account'] }),
    } as Response);

    renderWithProviders(<ToolkitPanel />);

    fireEvent.change(screen.getByPlaceholderText('输入课堂指令主题，如：小组辩论'), {
      target: { value: '课堂热身' },
    });
    fireEvent.click(screen.getByRole('button', { name: '检索徽章' }));

    await waitFor(() => {
      expect(screen.getByText('图标候选不足，已使用默认“？”图标发布该指令')).toBeInTheDocument();
    });
    expect(screen.getAllByText('课堂热身').length).toBeGreaterThan(0);
  });
});
