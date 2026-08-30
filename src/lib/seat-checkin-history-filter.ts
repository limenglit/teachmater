/**
 * 签到历史记录按「学院 / 班级」过滤。
 *
 * 一场签到可能是跨班级排座，因此判定为「属于某个班级」的条件是：
 * 1) 会话标题（class_name）中包含该班级名称；或
 * 2) 会话名单与该班级名册存在任意一名同名学生（跨班级签到时也能命中）。
 */

export interface HistoryFilterSession {
  class_name?: string;
  student_names?: string[];
}

export interface HistoryFilterClass {
  id: string;
  name: string;
  college_id: string;
  students: string[];
}

const normalize = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, '').trim().toLowerCase();

export function sessionMatchesClass(session: HistoryFilterSession, cls: HistoryFilterClass): boolean {
  const className = normalize(cls.name || '');
  if (!className) return false;

  const title = normalize(session.class_name || '');
  if (title && title.includes(className)) return true;

  const roster = new Set((cls.students || []).map(normalize).filter(Boolean));
  if (roster.size === 0) return false;
  return (session.student_names || []).some(n => roster.has(normalize(n || '')));
}

export function filterHistorySessions<T extends HistoryFilterSession>(
  sessions: T[],
  classes: HistoryFilterClass[],
  selection: { collegeId?: string; classId?: string },
): T[] {
  const { collegeId, classId } = selection;
  if (!collegeId && !classId) return sessions;

  const scoped = classId
    ? classes.filter(c => c.id === classId)
    : classes.filter(c => c.college_id === collegeId);

  if (scoped.length === 0) return [];
  return sessions.filter(s => scoped.some(c => sessionMatchesClass(s, c)));
}
