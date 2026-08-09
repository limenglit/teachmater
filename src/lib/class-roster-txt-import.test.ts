import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readSpreadsheetFile, parseDelimitedText } from './excel-utils';
import { buildClassRosterPreview } from './roster-import';
import { sortStudentsByStudentNo } from './seat-student-no';

const FIXTURE = resolve(process.cwd(), 'docs/test-rosters/13-班级库-学院班级学号姓名-UTF16.txt');

function makeFile(name: string, bytes: Uint8Array, type = 'text/plain'): File {
  return new File([bytes], name, { type });
}

describe('注册用户班级库：TXT 名单导入 → 学号排座', () => {
  const bytes = new Uint8Array(readFileSync(FIXTURE));

  it('UTF-16LE 制表符 TXT 可被表格读取器解析', async () => {
    const rows = await readSpreadsheetFile(makeFile('2026国培中职8.3-2.txt', bytes));
    expect(rows.length).toBe(101); // 表头 + 100 名学生
    expect(rows[0]).toEqual(['学院', '班级', '学号', '姓名']);
    expect(rows[1][2]).toBe('26030401');
    expect(rows[1][3]).toBe('何玉宾');
  });

  it('预览按院系/班级/学号/姓名正确映射，不丢行', async () => {
    const rows = await readSpreadsheetFile(makeFile('2026国培中职8.3-2.txt', bytes));
    const { preview, skippedRows } = buildClassRosterPreview(rows);
    expect(skippedRows).toBe(0);
    expect(preview.length).toBe(100);
    expect(preview.every(r => r.studentNumber !== '')).toBe(true);
    expect(preview[0]).toMatchObject({ className: '2026高职', studentNumber: '26030401', name: '何玉宾' });
  });

  it('载入到名单后可按学号从小到大排座（含 100 号跨位数排序）', async () => {
    const rows = await readSpreadsheetFile(makeFile('2026国培中职8.3-2.txt', bytes));
    const { preview } = buildClassRosterPreview(rows);
    // 模拟 loadToWorkspace：班级学生 → 花名册（保留学号），并打乱顺序
    const roster = [...preview]
      .map((r, i) => ({ id: `c_${i}`, name: r.name, studentNumber: r.studentNumber }))
      .reverse();

    const sorted = sortStudentsByStudentNo(roster);
    const numbers = sorted.map(s => Number(s.studentNumber));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(sorted[0].studentNumber).toBe('26030401');
    expect(sorted[sorted.length - 1].studentNumber).toBe('260304100');
  });

  it('分隔符自适应：逗号 / 分号 TXT 同样可解析', () => {
    expect(parseDelimitedText('学号,姓名\n2,李四\n1,张三')).toEqual([
      ['学号', '姓名'], ['2', '李四'], ['1', '张三'],
    ]);
    expect(parseDelimitedText('学号;姓名\r\n2;李四\r\n1;张三')).toEqual([
      ['学号', '姓名'], ['2', '李四'], ['1', '张三'],
    ]);
  });
});
