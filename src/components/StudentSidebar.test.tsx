import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentSidebar from './StudentSidebar';
import { StudentProvider } from '@/contexts/StudentContext';

const STORAGE_KEY = 'teachmate_students';

beforeEach(() => {
  localStorage.clear();
  // Seed with 2 students
  localStorage.setItem(STORAGE_KEY, JSON.stringify([
    { id: 's_1', name: '张三' },
    { id: 's_2', name: '李四' },
  ]));
});

describe('StudentSidebar', () => {
  // Case 8: 点击"清空"后列表为空
  it('clears all students when clicking the clear button', () => {
    render(
      <StudentProvider>
        <StudentSidebar />
      </StudentProvider>
    );

    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();

    const clearBtn = screen.getByText('清空');
    fireEvent.click(clearBtn);

    expect(screen.queryByText('张三')).not.toBeInTheDocument();
    expect(screen.queryByText('李四')).not.toBeInTheDocument();
    expect(screen.getByText('暂无学生，请导入名单')).toBeInTheDocument();
  });
});
