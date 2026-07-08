import { test, expect } from '@playwright/test';

// 沙盒中 Playwright 自带的 chrome-headless-shell 可能缺少系统库；使用完整 chromium。
test.use({ launchOptions: { executablePath: '/bin/chromium' } });

const REPORTED_ROSTER = `闫振华

郑灿灿

李名莉

刘亚闯

张子扬

马欢欢

晋懿普

常文博

魏三营

文紫薇

郭文超

耿卓凡

王增华

贾小朋

许庆峰

胡志涛

李志林

李晓苗

胡瑞

徐亚光

柴佳新

宋沛乐

杨凯丽

黄帅娜

李自玉

柴晓芳

李泽坤

张山

陈牧

袁素君

王宇晨

潘振南

杨琦琦

侯英

孙源

王文花

李甜甜

左东祥

谢耀坤

邹洪亮

张明阳

关庆辉

祝夏斌

贺秀秀

陈闻欣

魏宁宁

张昕

李啸林

张姗姗

刘志敏

陈艺文

邢淏鑫

毕博文

魏华阳

姚梦娟

郭宇航

陈明月

闫丽娟

李雪洋`;

const expectedNames = REPORTED_ROSTER.split(/\s+/).filter(Boolean);

async function openImportDialog(page) {
  await page.getByRole('button', { name: '导入' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('学生名单导入端到端回归', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('button[title="清空"]').click();
    await expect(page.getByText('0 人')).toBeVisible();
  });

  test('上传 59 人 TXT 后侧栏总数、随机模块总数和本地名单都更新为 59', async ({ page }) => {
    await openImportDialog(page);

    await page.locator('input[type="file"]').setInputFiles({
      name: '学生名单-59人.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(REPORTED_ROSTER, 'utf8'),
    });

    await expect(page.getByRole('dialog')).toContainText('共解析 59 条有效记录');
    await expect(page.getByRole('button', { name: /追加到名单 \(59\)/ })).toBeEnabled();
    await page.getByRole('button', { name: /追加到名单 \(59\)/ }).click();

    await expect(page.getByText('59 人').first()).toBeVisible();
    await expect(page.getByText('滚轮模式 (59人)')).toBeVisible();
    await expect(page.getByText('剩余 59/59 人').first()).toBeVisible();

    const storedNames = await page.evaluate(() => {
      const students = JSON.parse(localStorage.getItem('teachmate_students') || '[]');
      return students.map((student) => student.name);
    });
    expect(storedNames).toHaveLength(59);
    expect(storedNames).toEqual(expectedNames);
  });

  test('二次批量追加后总数即时增长，不覆盖现有名单', async ({ page }) => {
    await openImportDialog(page);
    await page.locator('textarea').fill(REPORTED_ROSTER);
    await page.getByRole('button', { name: /追加到名单 \(59\)/ }).click();
    await expect(page.getByText('59 人').first()).toBeVisible();

    await openImportDialog(page);
    await page.locator('textarea').fill('追加甲\n追加乙\n追加丙');
    await expect(page.getByRole('dialog')).toContainText('共解析 3 条有效记录');
    await page.getByRole('button', { name: /追加到名单 \(3\)/ }).click();

    await expect(page.getByText('62 人').first()).toBeVisible();
    await expect(page.getByText('滚轮模式 (62人)')).toBeVisible();
    const storedNames = await page.evaluate(() => {
      const students = JSON.parse(localStorage.getItem('teachmate_students') || '[]');
      return students.map((student) => student.name);
    });
    expect(storedNames).toHaveLength(62);
    expect(storedNames.slice(0, 59)).toEqual(expectedNames);
    expect(storedNames.slice(59)).toEqual(['追加甲', '追加乙', '追加丙']);
  });
});