import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CountdownTimer from './CountdownTimer';
import { LanguageProvider } from '@/contexts/LanguageContext';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: any) => <div className={className} onClick={onClick}>{children}</div>,
    circle: (props: any) => <circle {...props} />,
    span: ({ children, className, ...props }: any) => <span className={className}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial time display 05:00', () => {
    render(<CountdownTimer />, { wrapper });
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('start button begins countdown', () => {
    render(<CountdownTimer />, { wrapper });
    fireEvent.click(screen.getByText('开始'));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('04:57')).toBeInTheDocument();
  });

  it('pause and resume works', () => {
    render(<CountdownTimer />, { wrapper });
    fireEvent.click(screen.getByText('开始'));
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.click(screen.getByText('暂停'));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('04:58')).toBeInTheDocument();
  });

  it('reset restores initial time', () => {
    render(<CountdownTimer />, { wrapper });
    fireEvent.click(screen.getByText('开始'));
    act(() => { vi.advanceTimersByTime(5000); });
    fireEvent.click(screen.getByText('暂停'));
    fireEvent.click(screen.getByText('重置'));
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('shows 00:00 and disables start when countdown reaches 0', () => {
    render(<CountdownTimer />, { wrapper });
    // Set to 3 seconds using the number inputs
    const inputs = screen.getAllByRole('spinbutton');
    const minInput = inputs.find(i => (i as HTMLInputElement).max === '99')!;
    const secInput = inputs.find(i => (i as HTMLInputElement).max === '59')!;
    fireEvent.change(minInput, { target: { value: '0' } });
    fireEvent.change(secInput, { target: { value: '3' } });

    fireEvent.click(screen.getByText('开始'));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('00:00')).toBeInTheDocument();
    // Start button should be disabled
    const startBtn = screen.getByText('开始').closest('button')!;
    expect(startBtn).toBeDisabled();
  });
});
