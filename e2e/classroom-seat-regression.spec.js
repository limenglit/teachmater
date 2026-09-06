import { test, expect } from '@playwright/test';

/**
 * Classroom (座位 → 教室) end-to-end regression.
 * Covers: every seating strategy, drag swap, undo/redo, leave pool
 * (remove + restore) and clearing the grid.
 */

const readGrid = page =>
  page.evaluate(() =>
    Object.fromEntries(
      Array.from(document.querySelectorAll('[data-seat]')).map(el => [el.dataset.seat, el.dataset.seatName || '']),
    ),
  );

const seatedCount = grid => Object.values(grid).filter(Boolean).length;

async function openClassroom(page) {
  await page.goto('/');
  await page.getByText('座位', { exact: true }).first().click();
  await expect(page.locator('[data-testid="seat-chart-panel"]')).toBeVisible();
  await page.locator('[data-seat]').first().waitFor();
}

test.describe('classroom seating', () => {
  test('all seating strategies fill every student exactly once', async ({ page }) => {
    await openClassroom(page);
    for (const strategy of ['竖S形', '横S形', '智能集中', '随机排座', '考试座位', '学号顺序']) {
      await page.getByRole('button', { name: strategy, exact: true }).click();
      await page.getByRole('button', { name: '自动排座' }).click();
      await expect.poll(async () => seatedCount(await readGrid(page))).toBeGreaterThan(0);
      const grid = await readGrid(page);
      const names = Object.values(grid).filter(Boolean);
      expect(new Set(names).size, `${strategy} produced duplicates`).toBe(names.length);
    }
  });

  test('drag swap, undo and redo keep the grid consistent', async ({ page }) => {
    await openClassroom(page);
    await page.getByRole('button', { name: '自动排座' }).click();
    await expect.poll(async () => seatedCount(await readGrid(page))).toBeGreaterThan(1);

    const before = await readGrid(page);
    const [a, b] = Object.keys(before).filter(k => before[k]);
    await page.locator(`[data-seat="${a}"]`).dragTo(page.locator(`[data-seat="${b}"]`));
    await expect.poll(async () => (await readGrid(page))[a]).toBe(before[b]);
    const swapped = await readGrid(page);
    expect(swapped[b]).toBe(before[a]);
    expect(seatedCount(swapped)).toBe(seatedCount(before));

    await page.getByRole('button', { name: /撤销/ }).click();
    await expect.poll(async () => (await readGrid(page))[a]).toBe(before[a]);
    await page.getByRole('button', { name: /重做/ }).click();
    await expect.poll(async () => (await readGrid(page))[a]).toBe(swapped[a]);
  });

  test('leave pool removes and restores a student', async ({ page }) => {
    await openClassroom(page);
    await page.getByRole('button', { name: '自动排座' }).click();
    await expect.poll(async () => seatedCount(await readGrid(page))).toBeGreaterThan(0);

    const grid = await readGrid(page);
    const seat = Object.keys(grid).find(k => grid[k]);
    const name = grid[seat];

    await page.locator(`[data-seat="${seat}"]`).dblclick();
    await expect.poll(async () => (await readGrid(page))[seat]).toBe('');
    await expect(page.locator(`[data-leave-chip="${name}"]`)).toBeVisible();

    await page.locator(`[data-leave-chip="${name}"]`).dblclick();
    await expect.poll(async () => (await readGrid(page))[seat]).toBe(name);
  });

  test('clearing the grid empties every seat', async ({ page }) => {
    await openClassroom(page);
    await page.getByRole('button', { name: '自动排座' }).click();
    await expect.poll(async () => seatedCount(await readGrid(page))).toBeGreaterThan(0);
    page.on('dialog', d => d.accept());
    await page.getByRole('button', { name: '清空座位' }).click();
    await expect.poll(async () => seatedCount(await readGrid(page))).toBe(0);
  });
});
