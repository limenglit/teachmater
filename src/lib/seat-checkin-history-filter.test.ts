import { describe, expect, it } from 'vitest';
import { filterHistorySessions, sessionMatchesClass, type HistoryFilterClass } from './seat-checkin-history-filter';

const classA: HistoryFilterClass = { id: 'a', name: '一班', college_id: 'c1', students: ['张三', '李四'] };
const classB: HistoryFilterClass = { id: 'b', name: '二班', college_id: 'c1', students: ['王五'] };
const classC: HistoryFilterClass = { id: 'c', name: '三班', college_id: 'c2', students: ['赵六'] };

describe('seat checkin history filter', () => {
  it('matches by class name in title', () => {
    expect(sessionMatchesClass({ class_name: '物理 一班 期中', student_names: [] }, classA)).toBe(true);
  });

  it('matches cross-class session by roster overlap', () => {
    const session = { class_name: '跨班级联考', student_names: ['王五', '赵六'] };
    expect(sessionMatchesClass(session, classB)).toBe(true);
    expect(sessionMatchesClass(session, classA)).toBe(false);
  });

  it('filters by class and by college', () => {
    const sessions = [
      { class_name: '一班', student_names: ['张三'] },
      { class_name: '跨班级', student_names: ['王五', '赵六'] },
      { class_name: '其它', student_names: [] },
    ];
    const classes = [classA, classB, classC];
    expect(filterHistorySessions(sessions, classes, { classId: 'a' })).toHaveLength(1);
    expect(filterHistorySessions(sessions, classes, { collegeId: 'c1' })).toHaveLength(2);
    expect(filterHistorySessions(sessions, classes, {})).toHaveLength(3);
  });

  it('uses persisted class ids instead of ambiguous names or shared students', () => {
    const exact = { class_name: '一班联合活动', student_names: ['张三', '王五'], class_ids: ['b'] };
    expect(sessionMatchesClass(exact, classA)).toBe(false);
    expect(sessionMatchesClass(exact, classB)).toBe(true);
  });

  it('treats an explicitly empty class id list as unassociated', () => {
    const unassociated = { class_name: '一班', student_names: ['张三'], class_ids: [] };
    expect(sessionMatchesClass(unassociated, classA)).toBe(false);
  });
});
