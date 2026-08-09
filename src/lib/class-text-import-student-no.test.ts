import { describe, it, expect } from 'vitest';
import { parseStudentsFromText } from '@/hooks/useStudentStore';
import { sortStudentsByStudentNo } from './seat-student-no';

/**
 * 回归：注册用户「选班级 → 导入名单」（文本/TXT 粘贴导入）必须保留学号，
 * 与「学校 → 导入」表格路径行为一致，从而支持按学号从小到大落座。
 */

/** 模拟 ClassLibrary.confirmTextImport 的数据管线 */
function buildClassInserts(text: string, opts: { dedupe?: boolean; existing?: { name: string; student_number: string }[] } = {}) {
  const raw = parseStudentsFromText(text)
    .map(s => ({ name: s.name.trim(), studentNumber: (s.studentNumber || '').trim() }))
    .filter(s => s.name);
  if (!opts.dedupe) return raw;
  const keyOf = (n: string, no: string) => `${n}|${no}`;
  const existing = new Set((opts.existing || []).map(s => keyOf(s.name, s.student_number || '')));
  const seen = new Set<string>();
  const out: typeof raw = [];
  for (const e of raw) {
    const k = keyOf(e.name, e.studentNumber);
    if (existing.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

describe('班级名单文本导入：保留学号并可按学号排座', () => {
  it('带表头 TSV（学院/班级/学号/姓名）写入学号', () => {
    const text = ['学院\t班级\t学号\t姓名', '水利学院\t2026高职\t26030410\t李政', '水利学院\t2026高职\t26030401\t何玉媛'].join('\r\n');
    const rows = buildClassInserts(text);
    expect(rows.map(r => r.studentNumber)).toEqual(['26030410', '26030401']);
  });

  it('无表头「学号<TAB>姓名」也能拆出学号', () => {
    const rows = buildClassInserts('26030410\t李政\n260304100\t潘浩利\n26030402\t陈建立');
    expect(rows.map(r => r.studentNumber)).toEqual(['26030410', '260304100', '26030402']);
    expect(rows.map(r => r.name)).toEqual(['李政', '潘浩利', '陈建立']);
  });

  it('逗号 CSV（学号,姓名）导入后按学号从小到大排座（跨位数）', () => {
    const rows = buildClassInserts(['学号,姓名', '26030410,李政', '260304100,潘浩利', '26030401,何玉媛', '26030402,陈建立'].join('\n'));
    const sorted = sortStudentsByStudentNo(rows.map((r, i) => ({ id: `s_${i}`, name: r.name, studentNumber: r.studentNumber })));
    expect(sorted.map(s => s.name)).toEqual(['何玉媛', '陈建立', '李政', '潘浩利']);
  });

  it('去重按「姓名+学号」判定：同名不同学号保留', () => {
    const rows = buildClassInserts('01\t张三\n02\t张三\n01\t张三', { dedupe: true });
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.studentNumber)).toEqual(['01', '02']);
  });

  it('追加模式下跳过班级中已存在的同姓名+学号记录', () => {
    const rows = buildClassInserts('26030401\t何玉媛\n26030402\t陈建立', {
      dedupe: true,
      existing: [{ name: '何玉媛', student_number: '26030401' }],
    });
    expect(rows).toEqual([{ name: '陈建立', studentNumber: '26030402' }]);
  });
});
