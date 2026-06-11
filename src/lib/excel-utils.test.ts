import { describe, it, expect } from 'vitest';
import iconv from 'iconv-lite';
import { decodeCsvBytes, parseCsv, readSpreadsheetFile } from './excel-utils';

const SAMPLE = '姓名,班级\n张三,一班\nJohn Smith,Class A\n李小明 Tom,二班\n';

function toAB(buf: Uint8Array | Buffer): ArrayBuffer {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

describe('decodeCsvBytes - encoding auto-detection', () => {
  it('decodes plain UTF-8 (no BOM) with Chinese + English', () => {
    const bytes = new TextEncoder().encode(SAMPLE);
    const text = decodeCsvBytes(toAB(bytes));
    expect(text).toBe(SAMPLE);
    expect(text).toContain('张三');
    expect(text).toContain('John Smith');
    expect(text).toContain('李小明 Tom');
  });

  it('decodes UTF-8 with BOM and strips the BOM', () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const body = new TextEncoder().encode(SAMPLE);
    const merged = new Uint8Array(bom.length + body.length);
    merged.set(bom, 0);
    merged.set(body, bom.length);
    const text = decodeCsvBytes(toAB(merged));
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text).toBe(SAMPLE);
    expect(text).toContain('一班');
  });

  it('decodes GB18030 / GBK (Excel zh-CN default) mixed Chinese + English', () => {
    const encoded = iconv.encode(SAMPLE, 'gb18030');
    const text = decodeCsvBytes(toAB(encoded));
    expect(text).toContain('张三');
    expect(text).toContain('一班');
    expect(text).toContain('John Smith');
    expect(text).toContain('李小明 Tom');
    expect(text).not.toContain('\ufffd');
  });

  it('decodes pure GBK-encoded Chinese name column', () => {
    const src = '姓名\n王芳\n欧阳娜娜\n';
    const encoded = iconv.encode(src, 'gbk');
    const text = decodeCsvBytes(toAB(encoded));
    expect(text).toContain('王芳');
    expect(text).toContain('欧阳娜娜');
    expect(text).not.toContain('\ufffd');
  });

  it('decodes UTF-16 LE BOM', () => {
    const bom = new Uint8Array([0xff, 0xfe]);
    const body = iconv.encode(SAMPLE, 'utf16-le');
    const merged = new Uint8Array(bom.length + body.length);
    merged.set(bom, 0);
    merged.set(body, bom.length);
    const text = decodeCsvBytes(toAB(merged));
    expect(text).toContain('张三');
    expect(text).toContain('John Smith');
  });

  it('keeps ASCII-only English content intact', () => {
    const src = 'name,class\nJohn,A\nAlice,B\n';
    const bytes = new TextEncoder().encode(src);
    expect(decodeCsvBytes(toAB(bytes))).toBe(src);
  });
});

describe('parseCsv after encoding detection', () => {
  it('parses GB18030-encoded mixed CSV into structured rows', () => {
    const encoded = iconv.encode(SAMPLE, 'gb18030');
    const rows = parseCsv(decodeCsvBytes(toAB(encoded)));
    expect(rows).toEqual([
      ['姓名', '班级'],
      ['张三', '一班'],
      ['John Smith', 'Class A'],
      ['李小明 Tom', '二班'],
      [],
    ]);
  });

  it('parses UTF-8 BOM CSV with only the 姓名 column filled', () => {
    const src = '姓名,院系,班级,学号\n张三,,,\nJohn,,,\n';
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const body = new TextEncoder().encode(src);
    const merged = new Uint8Array(bom.length + body.length);
    merged.set(bom, 0);
    merged.set(body, bom.length);
    const rows = parseCsv(decodeCsvBytes(toAB(merged)));
    expect(rows[0]).toEqual(['姓名', '院系', '班级', '学号']);
    expect(rows[1]).toEqual(['张三', '', '', '']);
    expect(rows[2]).toEqual(['John', '', '', '']);
  });
});

describe('readSpreadsheetFile - csv branch with encoding detection', () => {
  it('reads a GB18030 .csv File and returns trimmed 2D rows', async () => {
    const encoded = iconv.encode(SAMPLE, 'gb18030');
    const file = new File([toAB(encoded)], 'roster.csv', { type: 'text/csv' });
    const rows = await readSpreadsheetFile(file);
    expect(rows).toEqual([
      ['姓名', '班级'],
      ['张三', '一班'],
      ['John Smith', 'Class A'],
      ['李小明 Tom', '二班'],
    ]);
  });

  it('reads a UTF-8 BOM .csv File with only the 姓名 column', async () => {
    const src = '姓名\n张三\nJohn\n李小明\n';
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const body = new TextEncoder().encode(src);
    const merged = new Uint8Array(bom.length + body.length);
    merged.set(bom, 0);
    merged.set(body, bom.length);
    const file = new File([toAB(merged)], 'names.csv', { type: 'text/csv' });
    const rows = await readSpreadsheetFile(file);
    expect(rows).toEqual([['姓名'], ['张三'], ['John'], ['李小明']]);
  });
});
