/**
 * Pure utility functions for the Check-in module.
 * Extracted from CheckInPanel for testability.
 */

export interface CheckinRecord {
  id: string;
  student_name: string;
  checked_in_at: string;
  status: string; // 'matched' | 'unknown' | 'pending'
}

export interface SessionData {
  id: string;
  created_at: string;
  duration_minutes: number;
  status: string;
  ended_at: string | null;
  creator_token: string;
}

/** Format seconds to mm:ss */
export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/** Format duration in human readable form */
export function formatDuration(s: number, secondsUnit = '秒', minuteSecond = '{0}分{1}秒'): string {
  if (s < 60) return `${s}${secondsUnit}`;
  return minuteSecond.replace('{0}', String(Math.floor(s / 60))).replace('{1}', String(s % 60));
}

/** Determine if a student name matches the roster */
export function matchCheckinStatus(studentName: string, rosterNames: string[]): 'matched' | 'unknown' {
  return rosterNames.some(n => n.trim() === studentName.trim()) ? 'matched' : 'unknown';
}

/** Compute checkin statistics */
export function computeCheckinStats(
  records: CheckinRecord[],
  studentNames: string[],
  leaveSet: Set<string>,
  sessionCreatedAt: string,
) {
  const matchedRecords = records.filter(r => r.status === 'matched');
  const unknownRecords = records.filter(r => r.status === 'unknown');
  const checkedNames = matchedRecords.map(r => r.student_name);
  const uncheckedStudents = studentNames.filter(n => !checkedNames.includes(n));
  const totalStudents = studentNames.length;
  const checkinRate = totalStudents > 0 ? Math.round((matchedRecords.length / totalStudents) * 100) : 0;
  const leaveCount = uncheckedStudents.filter(n => leaveSet.has(n)).length;
  const absentCount = uncheckedStudents.length - leaveCount;

  const sessionStart = new Date(sessionCreatedAt).getTime();
  const checkinTimes = matchedRecords.map(r => (new Date(r.checked_in_at).getTime() - sessionStart) / 1000);
  const avgTime = checkinTimes.length > 0 ? Math.round(checkinTimes.reduce((a, b) => a + b, 0) / checkinTimes.length) : 0;
  const fastestTime = checkinTimes.length > 0 ? Math.round(Math.min(...checkinTimes)) : 0;
  const slowestTime = checkinTimes.length > 0 ? Math.round(Math.max(...checkinTimes)) : 0;

  return {
    matchedRecords,
    unknownRecords,
    checkedNames,
    uncheckedStudents,
    totalStudents,
    checkinRate,
    leaveCount,
    absentCount,
    avgTime,
    fastestTime,
    slowestTime,
  };
}

/** Generate CSV content for check-in export */
export function generateCheckinCSV(
  records: CheckinRecord[],
  studentNames: string[],
  leaveSet: Set<string>,
  labels: { name: string; status: string; time: string; checked: string; unchecked: string; leave: string; unknown: string },
): string {
  const lines = [`${labels.name},${labels.status},${labels.time}`];
  const matchedRecords = records.filter(r => r.status === 'matched');
  const unknownRecords = records.filter(r => r.status === 'unknown');
  const checkedNames = matchedRecords.map(r => r.student_name);
  const uncheckedStudents = studentNames.filter(n => !checkedNames.includes(n));

  matchedRecords.forEach(r => {
    lines.push(`${r.student_name},${labels.checked},${new Date(r.checked_in_at).toLocaleString()}`);
  });
  uncheckedStudents.forEach(n => {
    lines.push(`${n},${leaveSet.has(n) ? labels.leave : labels.unchecked},`);
  });
  unknownRecords.forEach(r => {
    lines.push(`${r.student_name},${labels.unknown},${new Date(r.checked_in_at).toLocaleString()}`);
  });
  return lines.join('\n');
}

/** Filter name suggestions based on partial input */
export function filterNameSuggestions(input: string, allNames: string[], maxResults = 5): string[] {
  if (!input || input.length === 0) return [];
  const lower = input.toLowerCase();
  return allNames.filter(n => n.toLowerCase().includes(lower) && n !== input).slice(0, maxResults);
}

/** Save session to history (returns the updated history array) */
export function buildHistoryEntry(
  session: SessionData,
  records: CheckinRecord[],
  studentNames: string[],
) {
  return {
    session,
    records,
    unchecked: studentNames.filter(n => !records.some(r => r.student_name === n && r.status === 'matched')),
    savedAt: new Date().toISOString(),
  };
}
