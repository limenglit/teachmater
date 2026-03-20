import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import SeatCheckinPage from './SeatCheckinPage';

const fromMock = vi.fn();
const toastMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ sessionId: 'session-1' }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: any[]) => toastMock(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args),
  },
}));

vi.mock('@/components/checkin-views/ClassroomCheckinView', () => ({
  default: ({ studentName }: { studentName: string }) => <div>座位视图-{studentName}</div>,
}));

vi.mock('@/components/checkin-views/RoundTableCheckinView', () => ({
  default: () => <div>round-table-view</div>,
}));

vi.mock('@/components/checkin-views/ConferenceCheckinView', () => ({
  default: () => <div>conference-view</div>,
}));

vi.mock('@/components/checkin-views/ConcertCheckinView', () => ({
  default: () => <div>concert-view</div>,
}));

vi.mock('@/components/checkin-views/ComputerLabCheckinView', () => ({
  default: () => <div>computer-lab-view</div>,
}));

type RecordQueryConfig = {
  existingNames: string[];
};

const buildSeatCheckinSessionQuery = (status: 'active' | 'ended') => {
  const query: any = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue({
    data: {
      id: 'session-1',
      seat_data: { rows: [] },
      student_names: ['张三', '李四'],
      scene_config: {},
      scene_type: 'classroom',
      status,
    },
    error: null,
  });

  return query;
};

const buildSeatCheckinRecordQuery = (config: RecordQueryConfig) => {
  const filters: Record<string, string> = {};
  const query: any = {
    select: vi.fn(),
    eq: vi.fn((key: string, value: string) => {
      filters[key] = value;
      return query;
    }),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  query.select.mockReturnValue(query);
  query.maybeSingle.mockImplementation(() => {
    const exists = filters.session_id === 'session-1' && config.existingNames.includes(filters.student_name);
    return Promise.resolve({ data: exists ? { id: `record-${filters.student_name}` } : null, error: null });
  });

  return query;
};

describe('SeatCheckinPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('restores the seat directly and shows already checked-in reminder on second scan', async () => {
    localStorage.setItem('teachmate-seat-checkin-names', JSON.stringify({ 'session-1': '张三' }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'seat_checkin_sessions') return buildSeatCheckinSessionQuery('active');
      if (table === 'seat_checkin_records') return buildSeatCheckinRecordQuery({ existingNames: ['张三'] });
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<SeatCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText('座位视图-张三')).toBeInTheDocument();
    });

    expect(screen.getByText('已经完成签到，以下为你的座位信息。')).toBeInTheDocument();
  });

  it('allows ended session student with existing record to view seat by entering name', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'seat_checkin_sessions') return buildSeatCheckinSessionQuery('ended');
      if (table === 'seat_checkin_records') return buildSeatCheckinRecordQuery({ existingNames: ['张三'] });
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<SeatCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText('签到已结束，仅已签到同学可查看座位。')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('seatCheckin.namePlaceholder'), { target: { value: '张三' } });
    fireEvent.click(screen.getByText('seatCheckin.confirm'));

    await waitFor(() => {
      expect(screen.getByText('座位视图-张三')).toBeInTheDocument();
    });
  });

  it('blocks ended session student without record from creating new check-in', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'seat_checkin_sessions') return buildSeatCheckinSessionQuery('ended');
      if (table === 'seat_checkin_records') return buildSeatCheckinRecordQuery({ existingNames: [] });
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<SeatCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText('签到已结束，仅已签到同学可查看座位。')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('seatCheckin.namePlaceholder'), { target: { value: '李四' } });
    fireEvent.click(screen.getByText('seatCheckin.confirm'));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
        title: '签到已结束，无法新增签到',
        variant: 'destructive',
      }));
    });

    expect(screen.queryByText('座位视图-李四')).not.toBeInTheDocument();
  });
});
