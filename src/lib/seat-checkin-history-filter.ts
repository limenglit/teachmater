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
  /** Exact class links persisted when the session was published. Undefined means a legacy record. */
  class_ids?: string[];
}

export interface HistoryFilterClass {
  id: string;
  name: string;
  college_id: string;
  students: string[];
}

const normalize = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, '').trim().toLowerCase();

const WORDISH = /[0-9a-z\u4e00-\u9fff]/;
const DIGIT = /[0-9]/;

/**
 * Title matching with a boundary guard so「1班」never matches「11班」or「设计1班」.
 * The character right before the class name must not continue a longer name,
 * and the character right after must not be another digit.
 */
export function titleMentionsClass(title: string, className: string): boolean {
  if (!title || !className) return false;
  let from = 0;
  for (;;) {
    const idx = title.indexOf(className, from);
    if (idx === -1) return false;
    const before = idx > 0 ? title[idx - 1] : '';
    const after = title[idx + className.length] || '';
    if (!WORDISH.test(before) && !DIGIT.test(after)) return true;
    from = idx + 1;
  }
}

export function sessionMatchesClass(session: HistoryFilterSession, cls: HistoryFilterClass): boolean {
  if (Array.isArray(session.class_ids)) return session.class_ids.includes(cls.id);

  const className = normalize(cls.name || '');
  if (!className) return false;

  const title = normalize(session.class_name || '');
  if (titleMentionsClass(title, className)) return true;

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
