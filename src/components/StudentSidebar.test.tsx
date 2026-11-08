import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import StudentSidebar from './StudentSidebar';
import { StudentProvider } from '@/contexts/StudentContext';

const STORAGE_KEY = 'teachmate_students';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

beforeEach(() => {
  localStorage.clear();
  // Seed with 2 students
  localStorage.setItem(STORAGE_KEY, JSON.stringify([
    { id: 's_1', name: '张三' },
    { id: 's_2', name: '李四' },
  ]));
});

describe('StudentSidebar', () => {
  it('imports manually pasted students when clipboard permission is denied', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) } });
    render(<StudentProvider><StudentSidebar /></StudentProvider>);
    fireEvent.click(screen.getByTitle('粘贴'));
    const input = await screen.findByRole('textbox', { name: '粘贴学生名单' });
    fireEvent.change(input, { target: { value: '王五\n赵六' } });
    fireEvent.click(screen.getByRole('button', { name: /追加到名单/ }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map((s: { name: string }) => s.name)).toEqual(['张三', '李四', '王五', '赵六']));
  });

  it('allows manual paste in WeChat without requesting clipboard permission', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('MicroMessenger');
    const readText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText } });
    render(<StudentProvider><StudentSidebar /></StudentProvider>);
    fireEvent.click(screen.getByTitle('粘贴'));
    await screen.findByRole('textbox', { name: '粘贴学生名单' });
    expect(readText).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: '粘贴学生名单' }), { target: { value: '孙七' } });
    fireEvent.click(screen.getByRole('button', { name: /追加到名单/ }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map((s: { name: string }) => s.name)).toContain('孙七'));
  });
  // Case 8: 点击"清空"后列表为空
  it('clears all students when clicking the clear button', () => {
    render(
      <StudentProvider>
        <StudentSidebar />
      </StudentProvider>
    );

    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();

    const clearBtn = screen.getByTitle('清空');
    fireEvent.click(clearBtn);

    expect(screen.queryByText('张三')).not.toBeInTheDocument();
    expect(screen.queryByText('李四')).not.toBeInTheDocument();
    expect(screen.getByText('暂无学生，请导入名单')).toBeInTheDocument();
  });
});
