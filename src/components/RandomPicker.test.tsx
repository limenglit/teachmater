import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// Mock sounds
vi.mock('@/lib/sounds', () => ({
  playTick: vi.fn(),
  playCelebration: vi.fn(),
}));

// Mock framer-motion to avoid animation complexity
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => <div ref={ref} {...props}>{children}</div>),
    p: React.forwardRef(({ children, ...props }: any, ref: any) => <p ref={ref} {...props}>{children}</p>),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock SpinWheel
vi.mock('@/components/SpinWheel', () => ({
  default: ({ availableStudents, onRollStart, onRollEnd, soundEnabled }: any) => (
    <div data-testid="spin-wheel">
      <button
        data-testid="wheel-spin"
        disabled={availableStudents.length === 0}
        onClick={() => {
          onRollStart();
          if (availableStudents.length > 0) {
            onRollEnd(availableStudents[0]);
          }
        }}
      >
        Spin
      </button>
      <span data-testid="wheel-available">{availableStudents.length}</span>
    </div>
  ),
}));

import { playTick, playCelebration } from '@/lib/sounds';
import { StudentProvider } from '@/contexts/StudentContext';

const STORAGE_KEY = 'teachmate_students';

function renderPicker(studentCount = 25) {
  // >20 students triggers roller mode (not wheel)
  const students = Array.from({ length: studentCount }, (_, i) => ({
    id: `s_${i}`,
    name: `学生${i + 1}`,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
  return render(
    <StudentProvider>
      <RandomPicker />
    </StudentProvider>
  );
}

function renderPickerWithWheel(studentCount = 5) {
  // <=20 students triggers wheel mode
  const students = Array.from({ length: studentCount }, (_, i) => ({
    id: `s_${i}`,
    name: `同学${i + 1}`,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
  return render(
    <StudentProvider>
      <RandomPicker />
    </StudentProvider>
  );
}

// Must import after mocks
import RandomPicker from './RandomPicker';

// ResizeObserver polyfill for Radix Slider
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    value: { speak: vi.fn(), cancel: vi.fn() },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RandomPicker', () => {
  // Case 1: 无可用学生时，按钮禁用
  it('disables roll button when no students available', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    render(
      <StudentProvider>
        <RandomPicker />
      </StudentProvider>
    );
    // Wheel mode with 0 students — the wheel spin button should be disabled
    const spinBtn = screen.getByTestId('wheel-spin');
    expect(spinBtn).toBeDisabled();
  });

  // Case 2: 开启"不重复"时，连续抽取不会重复直到池耗尽
  it('does not repeat students when noRepeat is on (wheel mode)', () => {
    renderPickerWithWheel(3);
    const picked: string[] = [];

    // noRepeat is on by default
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('wheel-spin'));
    }
    // After 3 picks with 3 students, available should be 0
    expect(screen.getByTestId('wheel-available').textContent).toBe('0');
  });

  // Case 3: 点击"重置"后可再次抽到已抽过学生
  it('resets pool when clicking reset (wheel mode)', () => {
    renderPickerWithWheel(2);

    // Pick both students
    fireEvent.click(screen.getByTestId('wheel-spin'));
    fireEvent.click(screen.getByTestId('wheel-spin'));
    expect(screen.getByTestId('wheel-available').textContent).toBe('0');

    // Click reset
    const resetBtn = screen.getByText('重置');
    fireEvent.click(resetBtn);
    expect(screen.getByTestId('wheel-available').textContent).toBe('2');
  });

  // Case 4: 关闭音效后不调用 playTick/playCelebration (roller mode >20)
  it('does not call playTick/playCelebration when sound is off', () => {
    renderPicker(25);

    // Turn off sound — find the switch next to 音效
    const soundSwitch = screen.getByText('音效').closest('label')!.querySelector('button')!;
    fireEvent.click(soundSwitch); // turn off

    // Click roll
    const rollBtn = screen.getByText('滚动');
    fireEvent.click(rollBtn);

    // Advance timers to complete roll
    act(() => { vi.advanceTimersByTime(4000); });

    expect(playTick).not.toHaveBeenCalled();
    expect(playCelebration).not.toHaveBeenCalled();
  });

  // Case 5: 关闭语音后不调用 speechSynthesis.speak
  it('does not call speechSynthesis.speak when voice is off', () => {
    renderPicker(25);

    // Turn off voice
    const voiceSwitch = screen.getByText('语音').closest('label')!.querySelector('button')!;
    fireEvent.click(voiceSwitch);

    const rollBtn = screen.getByText('滚动');
    fireEvent.click(rollBtn);
    act(() => { vi.advanceTimersByTime(4000); });

    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  // Case 6: 抽取完成后"已选人数"和"剩余人数"显示正确 (wheel mode)
  it('shows correct picked and remaining counts after picks', () => {
    renderPickerWithWheel(5);

    fireEvent.click(screen.getByTestId('wheel-spin'));
    fireEvent.click(screen.getByTestId('wheel-spin'));

    // Should show "已选 2 人" and "剩余 3/5 人"
    expect(screen.getByText('已选 2 人')).toBeInTheDocument();
    expect(screen.getByText('剩余 3/5 人')).toBeInTheDocument();
  });

  // Case 7: 弹窗开关关闭时，不显示大字弹出层
  it('does not show fullscreen popup when popup toggle is off', () => {
    renderPicker(25);

    // Turn off popup
    const popupSwitch = screen.getByText('大字弹出').closest('label')!.querySelector('button')!;
    fireEvent.click(popupSwitch);

    const rollBtn = screen.getByText('滚动');
    fireEvent.click(rollBtn);
    act(() => { vi.advanceTimersByTime(4000); });

    // The popup overlay text "点击任意处关闭" should NOT exist
    expect(screen.queryByText('点击任意处关闭')).not.toBeInTheDocument();
  });
});
