import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportButtons from './ExportButtons';
import * as exportLib from '@/lib/export';

vi.mock('@/lib/export', () => ({
  exportToPNG: vi.fn().mockResolvedValue(undefined),
  exportToPDF: vi.fn().mockResolvedValue(undefined),
}));

describe('ExportButtons', () => {
  let ref: React.RefObject<HTMLElement>;

  beforeEach(() => {
    vi.clearAllMocks();
    ref = { current: document.createElement('div') } as React.RefObject<HTMLElement>;
  });

  it('calls exportToPNG when PNG button clicked', async () => {
    render(<ExportButtons targetRef={ref} filename="test-file" />);
    fireEvent.click(screen.getByText('PNG'));
    await waitFor(() => {
      expect(exportLib.exportToPNG).toHaveBeenCalledWith(ref.current, 'test-file', 'test-file');
    });
  });

  it('calls exportToPDF when PDF button clicked', async () => {
    render(<ExportButtons targetRef={ref} filename="test-file" />);
    fireEvent.click(screen.getByText('PDF'));
    await waitFor(() => {
      expect(exportLib.exportToPDF).toHaveBeenCalledWith(ref.current, 'test-file', 'test-file');
    });
  });

  it('uses custom title when provided', async () => {
    render(<ExportButtons targetRef={ref} filename="default-name" />);
    const input = screen.getByPlaceholderText(/导出名称/);
    fireEvent.change(input, { target: { value: '自定义标题' } });
    fireEvent.click(screen.getByText('PNG'));
    await waitFor(() => {
      expect(exportLib.exportToPNG).toHaveBeenCalledWith(ref.current, '自定义标题', '自定义标题');
    });
  });

  it('does not call export when ref is null', async () => {
    const nullRef = { current: null } as React.RefObject<HTMLElement>;
    render(<ExportButtons targetRef={nullRef} filename="test" />);
    fireEvent.click(screen.getByText('PNG'));
    // Should not throw, and should not call exportToPNG
    expect(exportLib.exportToPNG).not.toHaveBeenCalled();
  });

  it('shows error toast when export fails', async () => {
    vi.mocked(exportLib.exportToPNG).mockRejectedValueOnce(new Error('fail'));
    render(<ExportButtons targetRef={ref} filename="test" />);
    fireEvent.click(screen.getByText('PNG'));
    // Should not throw
    await waitFor(() => {
      expect(exportLib.exportToPNG).toHaveBeenCalled();
    });
  });
});
