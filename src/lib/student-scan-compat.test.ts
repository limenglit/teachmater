import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { isStudentScanRoute } from './student-route';
import { deviceInfo, formatScanDiag } from './scan-session';

// 学生扫码页相关源码不得使用旧 iOS（15–17）不支持、且打包工具不会自动转换的写法。
const FORBIDDEN: [RegExp, string][] = [
  [/\(\?<[=!]/, '正则后行断言（iOS 16.4 以下不支持）'],
  [/Promise\.withResolvers/, 'Promise.withResolvers（iOS 17.4+）'],
  [/AbortSignal\.(any|timeout)\(/, 'AbortSignal.any/timeout（iOS 16/17.4+）'],
  [/Object\.groupBy|Map\.groupBy/, 'groupBy（iOS 17.4+）'],
  [/\.(toSorted|toReversed|toSpliced)\(/, '数组拷贝方法（iOS 16+）'],
  [/Array\.fromAsync/, 'Array.fromAsync（iOS 16.4+）'],
  [/navigator\.locks/, 'navigator.locks（部分 iOS 微信内核存在锁等待缺陷）'],
];

const root = join(__dirname, '..');
const files = [
  'pages/CheckInPage.tsx',
  'pages/SeatCheckinPage.tsx',
  'lib/scan-session.ts',
  'lib/student-supabase.ts',
  'lib/student-route.ts',
  ...readdirSync(join(root, 'components/checkin-views'))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
    .map((f) => `components/checkin-views/${f}`),
];

describe('student scan pages stay compatible with older iPhones', () => {
  for (const f of files) {
    it(`${f} has no unsupported syntax/API`, () => {
      const src = readFileSync(join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const [re, label] of FORBIDDEN) expect(re.test(src), `${f}: ${label}`).toBe(false);
    });
  }

  it('student pages never import the shared login client', () => {
    for (const f of ['pages/CheckInPage.tsx', 'pages/SeatCheckinPage.tsx', 'lib/scan-session.ts']) {
      expect(readFileSync(join(root, f), 'utf8')).not.toMatch(/integrations\/supabase\/client/);
    }
  });

  it('recognises student scan routes', () => {
    expect(isStudentScanRoute('/checkin/abc')).toBe(true);
    expect(isStudentScanRoute('/SEAT-CHECKIN/abc')).toBe(true);
    expect(isStudentScanRoute('/')).toBe(false);
    expect(isStudentScanRoute('/board/1')).toBe(false);
  });

  it('formats diagnostics with iOS and WeChat versions', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50',
      configurable: true,
    });
    const d = deviceInfo();
    expect(d.ios).toBe('17.5.1');
    expect(d.wechat).toBe('8.0.50');
    const text = formatScanDiag({ ...d, stage: 'fetch', error: 'TypeError: Load failed', elapsedMs: 3200, attempts: 6 });
    expect(text).toContain('iOS 17.5.1');
    expect(text).toContain('微信 8.0.50');
    expect(text).toContain('Load failed');
  });
});
