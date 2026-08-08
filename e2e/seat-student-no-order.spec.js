import { test, expect } from '@playwright/test';

// 沙盒中 Playwright 自带的 chrome-headless-shell 可能缺少系统库；使用完整 chromium。
test.skip(({ browserName }) => browserName !== 'chromium', '学号排座回归只需 Chromium 覆盖核心链路');
test.use({ launchOptions: { executablePath: '/bin/chromium', args: ['--no-sandbox'] } });

/** 1) 标准 CSV：学号,姓名 表头 */
const CSV_WITH_HEADER = ['学号,姓名', '26030410,李政', '26030401,何玉媛', '260304100,潘浩利', '26030402,陈建立'].join('\n');
const CSV_WITH_HEADER_ORDER = ['何玉媛', '陈建立', '李政', '潘浩利'];

/** 2) 多列 TSV：学院/班级/学号/姓名，CRLF 换行 */
const TSV_MULTI_COLUMN = [
  '学院\t班级\t学号\t姓名',
  '河南水利与环境职业学院\t2026高职\t26030405\t王小明',
  '河南水利与环境职业学院\t2026高职\t26030403\t赵敏',
  '河南水利与环境职业学院\t2026高职\t26030404\t孙悦',
].join('\r\n');
const TSV_MULTI_COLUMN_ORDER = ['赵敏', '孙悦', '王小明'];

/** 3) 无表头 TXT：前缀学号 + 多种分隔符 + 全角数字 + 无学号行 */
const TXT_NO_HEADER = ['10、孙七', '02.李四', '０３ 赵六', '陈晨', '5:王五'].join('\n');
const TXT_NO_HEADER_ORDER = ['02.李四', '０３ 赵六', '5:王五', '10、孙七', '陈晨'];

/** 4) 括号/后缀学号 CSV（姓名,性别） */
const CSV_BRACKET = ['姓名,性别', '张三(2026001),男', '李四（26）,女', '王五[18],男', '周舟,女'].join('\n');
const CSV_BRACKET_ORDER = ['王五[18]', '李四（26）', '张三(2026001)', '周舟'];

async function resetRoster(page) {
  await page.goto('/');
  await page.locator('button[title="清空"]').click();
  await expect(page.locator('.bg-accent').filter({ hasText: '0 人' })).toBeVisible();
}

async function importFile(page, name, mimeType, content) {
  await page.getByRole('button', { name: '导入' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType,
    buffer: Buffer.from(content, 'utf8'),
  });
  await page.getByRole('button', { name: /追加到名单 \(\d+\)/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

async function openStudentNoMode(page) {
  await page.getByRole('button', { name: '座位' }).first().click();
  await page.getByRole('button', { name: /学号顺序/ }).first().click();
  await expect(page.getByText('学号解析预览')).toBeVisible();
}

/** 读取「学号解析预览」表格中按落座序号排列的姓名。 */
async function readPreviewOrder(page) {
  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  const names = [];
  for (let i = 0; i < count; i++) {
    names.push((await rows.nth(i).locator('td').nth(1).innerText()).trim());
  }
  return names;
}

/** 读取座位图上按行/列渲染的姓名顺序。 */
async function readSeatOrder(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[data-seat-chart], .seat-chart svg, svg');
    if (!svg) return [];
    return Array.from(svg.querySelectorAll('text'))
      .map(t => (t.textContent || '').trim())
      .filter(Boolean);
  });
}

const cases = [
  { title: '带表头 CSV（学号,姓名）', file: ['学号名单.csv', 'text/csv', CSV_WITH_HEADER], order: CSV_WITH_HEADER_ORDER },
  { title: '多列 TSV（学院/班级/学号/姓名，CRLF）', file: ['多列名单.txt', 'text/plain', TSV_MULTI_COLUMN], order: TSV_MULTI_COLUMN_ORDER },
  { title: '无表头 TXT（分隔符 + 全角数字 + 无学号）', file: ['无表头名单.txt', 'text/plain', TXT_NO_HEADER], order: TXT_NO_HEADER_ORDER },
  { title: '括号/后缀学号 CSV', file: ['括号学号.csv', 'text/csv', CSV_BRACKET], order: CSV_BRACKET_ORDER },
];

test.describe('学号顺序排座端到端回归', () => {
  for (const item of cases) {
    test(`${item.title} 上传后按学号从小到大落座`, async ({ page }) => {
      await resetRoster(page);
      await importFile(page, ...item.file);
      await openStudentNoMode(page);

      expect(await readPreviewOrder(page)).toEqual(item.order);

      const seatNames = await readSeatOrder(page);
      const seated = item.order.filter(name => seatNames.includes(name));
      expect(seatNames.filter(n => seated.includes(n))).toEqual(seated);
    });
  }
});
