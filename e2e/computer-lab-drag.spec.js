import { test, expect } from '@playwright/test';

/**
 * 端到端回归：机房（ComputerLab）整行拖拽 & 人员交换
 * 目标：
 *   1) 操作过程中不出现白屏（preview 容器仍正常渲染）
 *   2) 不出现未捕获的 console / pageerror
 *   3) 拖拽桌子整行后，对应行 <g data-testid="computerlab-row-*"> 的 data-row-x/y 发生变化
 *   4) 交换两名学生后，对应座位 <g data-testid="computerlab-seat-*"> 的 data-seat-name 互换
 */

const ROW_DRAG_DX = 80;
const ROW_DRAG_DY = 40;

test.describe('机房拖拽端到端回归', () => {
  /** @type {string[]} */
  let consoleErrors;
  /** @type {string[]} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto('/');
    // 进入「座位」主 tab
    await page.getByRole('button', { name: /🏫/ }).first().click();
    await expect(page.getByTestId('seat-chart-panel')).toBeVisible();

    // 切换到「💻 机房」场景
    await page.getByRole('button', { name: /💻/ }).first().click();

    // 触发自动排座生成布局
    await page.getByRole('button', { name: /自动排座|Auto arrange|Авто-рассадка|自動|自動着席/ }).first().click();

    // 等待 SVG 渲染完成
    await expect(page.getByTestId('computerlab-svg')).toBeVisible();
    await page.waitForSelector('[data-testid^="computerlab-row-"]');
    await page.waitForSelector('[data-testid^="computerlab-seat-"][data-seat-name]:not([data-seat-name=""])');
  });

  test.afterEach(async ({ page }) => {
    // 关键 DOM 仍存在 -> 没有白屏
    await expect(page.getByTestId('seat-chart-panel')).toBeVisible();
    await expect(page.getByTestId('computerlab-svg')).toBeVisible();

    expect(pageErrors, `pageerror: ${pageErrors.join('\n')}`).toHaveLength(0);
    const fatal = consoleErrors.filter(t =>
      /Cannot read|undefined|is not a function|Maximum update depth|Minified React error/i.test(t)
    );
    expect(fatal, `致命 console.error:\n${fatal.join('\n')}`).toHaveLength(0);
  });

  test('整行桌子可被拖拽且偏移量被持久化到 DOM', async ({ page }) => {
    const row = page.getByTestId('computerlab-row-0');
    await expect(row).toBeVisible();

    const beforeX = Number(await row.getAttribute('data-row-x'));
    const beforeY = Number(await row.getAttribute('data-row-y'));

    const box = await row.boundingBox();
    expect(box, '行 bounding box 应可获取').not.toBeNull();
    const startX = box.x + box.width / 2;
    const startY = box.y + 12;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // 分步移动模拟真实拖拽，触发 mousemove 处理器
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX + (ROW_DRAG_DX * i) / 5, startY + (ROW_DRAG_DY * i) / 5);
    }
    await page.mouse.up();

    // 等待状态写回 DOM
    await expect.poll(async () => Number(await row.getAttribute('data-row-x'))).not.toBe(beforeX);
    const afterX = Number(await row.getAttribute('data-row-x'));
    const afterY = Number(await row.getAttribute('data-row-y'));
    expect(Math.abs(afterX - beforeX)).toBeGreaterThan(10);
    expect(Math.abs(afterY - beforeY)).toBeGreaterThan(0);
  });

  test('快速来回拖拽不同的行不会触发白屏', async ({ page }) => {
    const rows = await page.locator('[data-testid^="computerlab-row-"]').all();
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows.slice(0, Math.min(rows.length, 3))) {
      const box = await row.boundingBox();
      if (!box) continue;
      const sx = box.x + box.width / 2;
      const sy = box.y + 12;
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(sx + 60, sy + 30, { steps: 4 });
      // 模拟拖拽中途指针离开画布
      await page.mouse.move(0, 0, { steps: 3 });
      await page.mouse.up();
    }
  });

  test('两名学生可成功交换且 DOM 中名字互换', async ({ page }) => {
    const seats = page.locator('[data-testid^="computerlab-seat-"][data-seat-closed="false"]')
      .filter({ has: page.locator(':scope') })
      .filter({ hasNotText: '' });

    // 取前两个有名字的座位
    const named = await page.locator('[data-testid^="computerlab-seat-"]').evaluateAll(nodes =>
      nodes
        .filter(n => n.getAttribute('data-seat-closed') === 'false' && (n.getAttribute('data-seat-name') || '').length > 0)
        .slice(0, 2)
        .map(n => n.getAttribute('data-testid'))
    );
    expect(named.length).toBe(2);

    const seatA = page.getByTestId(named[0]);
    const seatB = page.getByTestId(named[1]);
    const nameA = await seatA.getAttribute('data-seat-name');
    const nameB = await seatB.getAttribute('data-seat-name');
    expect(nameA).toBeTruthy();
    expect(nameB).toBeTruthy();
    expect(nameA).not.toBe(nameB);

    const boxA = await seatA.boundingBox();
    const boxB = await seatB.boundingBox();
    expect(boxA && boxB).toBeTruthy();

    await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
    await page.mouse.down();
    // 经过中间点触发 mouseenter
    await page.mouse.move((boxA.x + boxB.x) / 2, (boxA.y + boxB.y) / 2, { steps: 4 });
    await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, { steps: 4 });
    await page.mouse.up();

    await expect.poll(async () => seatA.getAttribute('data-seat-name')).toBe(nameB);
    await expect.poll(async () => seatB.getAttribute('data-seat-name')).toBe(nameA);
  });

  test('在空白处释放拖拽不会破坏布局', async ({ page }) => {
    const seat = page.locator('[data-testid^="computerlab-seat-"][data-seat-closed="false"]')
      .filter({ hasNotText: '' })
      .first();
    const box = await seat.boundingBox();
    expect(box).not.toBeNull();
    const beforeName = await seat.getAttribute('data-seat-name');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(10, 10, { steps: 5 });
    await page.mouse.up();

    // SVG 仍在、座位 DOM 仍存在、名字未丢失
    await expect(page.getByTestId('computerlab-svg')).toBeVisible();
    await expect(seat).toBeVisible();
    expect(await seat.getAttribute('data-seat-name')).toBe(beforeName);
  });
});
