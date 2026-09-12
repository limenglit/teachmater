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

const CJK_OR_DIGIT = /[0-9\u4e00-\u9fff]/;
const DIGIT = /[0-9]/;
const ALNUM = /[0-9a-z]/;

/**
 * Title matching with a boundary guard so「1班」never matches「11班」or「设计1班」,
 * while「一班」still matches「物理 一班 期中」.
 * - 数字开头的班级名（1班）要求前一个字符既不是数字也不是汉字，避免被更长的班名吞掉。
 * - 其他班级名只要求前一个字符不是数字/字母。
 * - 紧随其后的字符不能是数字（避免「1班」命中「1班2组」的编号串）。
 */
export function titleMentionsClass(title: string, className: string): boolean {
  if (!title || !className) return false;
  const strict = DIGIT.test(className[0]);
  let from = 0;
  for (;;) {
    const idx = title.indexOf(className, from);
    if (idx === -1) return false;
    const before = idx > 0 ? title[idx - 1] : '';
    const after = title[idx + className.length] || '';
    const beforeOk = before === '' || !(strict ? CJK_OR_DIGIT : ALNUM).test(before);
    if (beforeOk && !DIGIT.test(after)) return true;
    from = idx + 1;
  }
}


export function sessionMatchesClass(session: HistoryFilterSession, cls: HistoryFilterClass): boolean {
  // Only trust explicit links when there are any; an empty array means the
  // session was published without a Class Library roster, so fall back to
  // title / roster-name matching instead of hiding the record entirely.
  if (Array.isArray(session.class_ids) && session.class_ids.length > 0) {
    return session.class_ids.includes(cls.id);
  }

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
