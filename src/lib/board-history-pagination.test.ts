import { describe, it, expect } from 'vitest';
import { filterHistorySessions, type HistoryFilterClass } from './seat-checkin-history-filter';
import { paginate, totalPages } from '@/components/admin/AdminPagination';

interface BoardRow {
  id: string;
  class_name: string;
  student_names: string[];
}

const classes: HistoryFilterClass[] = [
  { id: 'c1', name: '1班', college_id: 'col1', students: ['张三', '李四'] },
  { id: 'c11', name: '11班', college_id: 'col1', students: ['王五'] },
  { id: 'c2', name: '设计1班', college_id: 'col2', students: ['赵六'] },
];

const boards: BoardRow[] = [
  { id: 'b1', class_name: '1班 头脑风暴', student_names: ['张三'] },
  { id: 'b2', class_name: '11班 作业墙', student_names: ['王五'] },
  { id: 'b3', class_name: '设计1班 作品集', student_names: ['赵六'] },
];

describe('board history filtering', () => {
  it('returns everything without a selection', () => {
    expect(filterHistorySessions(boards, classes, {})).toHaveLength(3);
  });

  it('does not mix 1班 with 11班', () => {
    const only1 = filterHistorySessions(boards, classes, { classId: 'c1' });
    expect(only1.map(b => b.id)).toEqual(['b1']);
    const only11 = filterHistorySessions(boards, classes, { classId: 'c11' });
    expect(only11.map(b => b.id)).toEqual(['b2']);
  });

  it('filters by college', () => {
    const col1 = filterHistorySessions(boards, classes, { collegeId: 'col1' });
    expect(col1.map(b => b.id).sort()).toEqual(['b1', 'b2']);
  });

  it('matches by roster overlap when the title has no class name', () => {
    const rows = [{ id: 'bx', class_name: '课堂讨论', student_names: ['赵六'] }];
    expect(filterHistorySessions(rows, classes, { classId: 'c2' }).map(r => r.id)).toEqual(['bx']);
  });

  it('prefers explicit class ids over name matching', () => {
    const rows = [{ id: 'by', class_name: '1班 讨论', student_names: [], class_ids: ['c11'] }];
    expect(filterHistorySessions(rows, classes, { classId: 'c1' })).toHaveLength(0);
    expect(filterHistorySessions(rows, classes, { classId: 'c11' })).toHaveLength(1);
  });

  it('returns nothing when no class matches the selection', () => {
    expect(filterHistorySessions(boards, classes, { classId: 'missing' })).toEqual([]);
  });
});

describe('board history pagination', () => {
  const many = Array.from({ length: 23 }, (_, i) => ({ id: `b${i + 1}`, class_name: '', student_names: [] }));

  it('shows 10 per page by default', () => {
    expect(paginate(many, 1, 10)).toHaveLength(10);
    expect(paginate(many, 1, 10)[0].id).toBe('b1');
  });

  it('slices the last partial page', () => {
    const last = paginate(many, 3, 10);
    expect(last).toHaveLength(3);
    expect(last[0].id).toBe('b21');
  });

  it('computes total pages for each page size', () => {
    expect(totalPages(23, 10)).toBe(3);
    expect(totalPages(23, 20)).toBe(2);
    expect(totalPages(0, 10)).toBe(1);
  });

  it('paginates the filtered result, not the raw list', () => {
    const filtered = filterHistorySessions(boards, classes, { collegeId: 'col1' });
    expect(paginate(filtered, 1, 10)).toHaveLength(2);
    expect(paginate(filtered, 2, 10)).toHaveLength(0);
  });
});
