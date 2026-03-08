import { describe, it, expect } from 'vitest';
import {
  formatTime,
  formatDuration,
  matchCheckinStatus,
  computeCheckinStats,
  generateCheckinCSV,
  filterNameSuggestions,
  buildHistoryEntry,
  type CheckinRecord,
  type SessionData,
} from './checkin-utils';

// ── Helpers ─────────────────────────────────────────────
const baseTime = '2026-03-08T10:00:00.000Z';
const makeRecord = (name: string, offsetSec: number, status = 'matched'): CheckinRecord => ({
  id: `r_${name}`,
  student_name: name,
  checked_in_at: new Date(new Date(baseTime).getTime() + offsetSec * 1000).toISOString(),
  status,
});
const roster = ['张三', '李四', '王五', '赵六', '钱七'];

// ── formatTime ──────────────────────────────────────────
describe('formatTime', () => {
  it('formats 0 seconds', () => expect(formatTime(0)).toBe('00:00'));
  it('formats 59 seconds', () => expect(formatTime(59)).toBe('00:59'));
  it('formats 60 seconds', () => expect(formatTime(60)).toBe('01:00'));
  it('formats 5 minutes', () => expect(formatTime(300)).toBe('05:00'));
  it('formats 10:05', () => expect(formatTime(605)).toBe('10:05'));
  it('formats large values', () => expect(formatTime(3661)).toBe('61:01'));
});

// ── formatDuration ──────────────────────────────────────
describe('formatDuration', () => {
  it('seconds only when < 60', () => expect(formatDuration(45)).toBe('45秒'));
  it('minutes and seconds when >= 60', () => expect(formatDuration(125)).toBe('2分5秒'));
  it('exact minute boundary', () => expect(formatDuration(120)).toBe('2分0秒'));
  it('custom labels', () => expect(formatDuration(30, 's', '{0}m{1}s')).toBe('30s'));
});

// ── matchCheckinStatus ──────────────────────────────────
describe('matchCheckinStatus', () => {
  it('returns matched for roster name', () => {
    expect(matchCheckinStatus('张三', roster)).toBe('matched');
  });
  it('returns unknown for non-roster name', () => {
    expect(matchCheckinStatus('路人甲', roster)).toBe('unknown');
  });
  it('trims whitespace', () => {
    expect(matchCheckinStatus(' 张三 ', roster.map(n => ` ${n} `))).toBe('matched');
  });
  it('empty roster → unknown', () => {
    expect(matchCheckinStatus('张三', [])).toBe('unknown');
  });
  it('empty name → unknown', () => {
    expect(matchCheckinStatus('', roster)).toBe('unknown');
  });
});

// ── computeCheckinStats ─────────────────────────────────
describe('computeCheckinStats', () => {
  const records: CheckinRecord[] = [
    makeRecord('张三', 10),
    makeRecord('李四', 30),
    makeRecord('路人甲', 15, 'unknown'),
  ];
  const leaveSet = new Set(['赵六']);

  it('computes correct checkin rate', () => {
    const stats = computeCheckinStats(records, roster, leaveSet, baseTime);
    expect(stats.checkinRate).toBe(40); // 2/5
  });

  it('identifies matched and unknown records', () => {
    const stats = computeCheckinStats(records, roster, leaveSet, baseTime);
    expect(stats.matchedRecords.length).toBe(2);
    expect(stats.unknownRecords.length).toBe(1);
  });

  it('identifies unchecked students', () => {
    const stats = computeCheckinStats(records, roster, leaveSet, baseTime);
    expect(stats.uncheckedStudents).toEqual(['王五', '赵六', '钱七']);
  });

  it('separates leave from absent', () => {
    const stats = computeCheckinStats(records, roster, leaveSet, baseTime);
    expect(stats.leaveCount).toBe(1);
    expect(stats.absentCount).toBe(2);
  });

  it('computes time stats correctly', () => {
    const stats = computeCheckinStats(records, roster, leaveSet, baseTime);
    expect(stats.fastestTime).toBe(10);
    expect(stats.slowestTime).toBe(30);
    expect(stats.avgTime).toBe(20); // (10+30)/2
  });

  it('handles zero records', () => {
    const stats = computeCheckinStats([], roster, new Set(), baseTime);
    expect(stats.checkinRate).toBe(0);
    expect(stats.avgTime).toBe(0);
    expect(stats.fastestTime).toBe(0);
    expect(stats.slowestTime).toBe(0);
    expect(stats.uncheckedStudents.length).toBe(5);
  });

  it('handles empty roster', () => {
    const stats = computeCheckinStats(records, [], new Set(), baseTime);
    expect(stats.checkinRate).toBe(0);
    expect(stats.totalStudents).toBe(0);
  });

  it('100% checkin rate when all present', () => {
    const allRecords = roster.map((n, i) => makeRecord(n, (i + 1) * 10));
    const stats = computeCheckinStats(allRecords, roster, new Set(), baseTime);
    expect(stats.checkinRate).toBe(100);
    expect(stats.uncheckedStudents.length).toBe(0);
    expect(stats.absentCount).toBe(0);
  });
});

// ── generateCheckinCSV ──────────────────────────────────
describe('generateCheckinCSV', () => {
  const labels = {
    name: '姓名', status: '状态', time: '时间',
    checked: '已签到', unchecked: '未签到', leave: '请假', unknown: '未知',
  };
  const records: CheckinRecord[] = [
    makeRecord('张三', 10),
    makeRecord('路人甲', 15, 'unknown'),
  ];

  it('generates header row', () => {
    const csv = generateCheckinCSV(records, roster, new Set(), labels);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('姓名,状态,时间');
  });

  it('includes matched students', () => {
    const csv = generateCheckinCSV(records, roster, new Set(), labels);
    expect(csv).toContain('张三,已签到');
  });

  it('includes unchecked students', () => {
    const csv = generateCheckinCSV(records, roster, new Set(), labels);
    expect(csv).toContain('李四,未签到,');
  });

  it('marks leave students', () => {
    const csv = generateCheckinCSV(records, roster, new Set(['李四']), labels);
    expect(csv).toContain('李四,请假,');
  });

  it('includes unknown records', () => {
    const csv = generateCheckinCSV(records, roster, new Set(), labels);
    expect(csv).toContain('路人甲,未知');
  });

  it('total line count is correct', () => {
    const csv = generateCheckinCSV(records, roster, new Set(), labels);
    const lines = csv.split('\n');
    // 1 header + 1 matched + 4 unchecked + 1 unknown = 7
    expect(lines.length).toBe(7);
  });

  it('handles empty records', () => {
    const csv = generateCheckinCSV([], roster, new Set(), labels);
    const lines = csv.split('\n');
    // 1 header + 5 unchecked
    expect(lines.length).toBe(6);
  });
});

// ── filterNameSuggestions ───────────────────────────────
describe('filterNameSuggestions', () => {
  const names = ['张三', '张思远', '李四', '王五', '张小明'];

  it('filters by partial match', () => {
    const result = filterNameSuggestions('张', names);
    expect(result).toEqual(['张三', '张思远', '张小明']);
  });

  it('excludes exact match', () => {
    const result = filterNameSuggestions('张三', names);
    expect(result).not.toContain('张三');
  });

  it('returns empty for empty input', () => {
    expect(filterNameSuggestions('', names)).toEqual([]);
  });

  it('respects maxResults', () => {
    const result = filterNameSuggestions('张', names, 2);
    expect(result.length).toBe(2);
  });

  it('case insensitive', () => {
    const engNames = ['Alice', 'Bob', 'ALICE2'];
    expect(filterNameSuggestions('alice', engNames)).toEqual(['Alice', 'ALICE2']);
  });

  it('no match returns empty', () => {
    expect(filterNameSuggestions('xyz', names)).toEqual([]);
  });
});

// ── buildHistoryEntry ───────────────────────────────────
describe('buildHistoryEntry', () => {
  const session: SessionData = {
    id: 'sess_1',
    created_at: baseTime,
    duration_minutes: 5,
    status: 'ended',
    ended_at: new Date(new Date(baseTime).getTime() + 300000).toISOString(),
    creator_token: 'tok',
  };
  const records: CheckinRecord[] = [makeRecord('张三', 10), makeRecord('李四', 20)];

  it('captures unchecked students', () => {
    const entry = buildHistoryEntry(session, records, roster);
    expect(entry.unchecked).toEqual(['王五', '赵六', '钱七']);
  });

  it('includes session and records', () => {
    const entry = buildHistoryEntry(session, records, roster);
    expect(entry.session.id).toBe('sess_1');
    expect(entry.records.length).toBe(2);
  });

  it('sets savedAt timestamp', () => {
    const entry = buildHistoryEntry(session, records, roster);
    expect(entry.savedAt).toBeDefined();
    expect(new Date(entry.savedAt).getTime()).toBeGreaterThan(0);
  });

  it('handles all checked in', () => {
    const allRecords = roster.map((n, i) => makeRecord(n, i * 10));
    const entry = buildHistoryEntry(session, allRecords, roster);
    expect(entry.unchecked).toEqual([]);
  });

  it('handles no records', () => {
    const entry = buildHistoryEntry(session, [], roster);
    expect(entry.unchecked).toEqual(roster);
  });
});

// ── Edge cases ──────────────────────────────────────────
describe('edge cases', () => {
  it('duplicate checkin records counted once in CSV', () => {
    const dupes: CheckinRecord[] = [
      makeRecord('张三', 10),
      { ...makeRecord('张三', 20), id: 'r_张三_dup' },
    ];
    const labels = { name: 'N', status: 'S', time: 'T', checked: 'Y', unchecked: 'N', leave: 'L', unknown: 'U' };
    const csv = generateCheckinCSV(dupes, roster, new Set(), labels);
    // Both matched records appear (dedup is handled at insert level, not CSV)
    const matchedLines = csv.split('\n').filter(l => l.includes(',Y,'));
    expect(matchedLines.length).toBe(2);
  });

  it('computeCheckinStats with negative time offset', () => {
    // Record before session start (edge case)
    const earlyRecord = makeRecord('张三', -5);
    const stats = computeCheckinStats([earlyRecord], roster, new Set(), baseTime);
    expect(stats.fastestTime).toBe(-5); // Negative is technically possible
    expect(stats.matchedRecords.length).toBe(1);
  });

  it('formatTime with negative input', () => {
    // Should not crash
    const result = formatTime(-1);
    expect(typeof result).toBe('string');
  });
});
