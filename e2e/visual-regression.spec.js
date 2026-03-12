import { test, expect } from '@playwright/test';

async function disableMotion(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function openMainTab(page, emoji) {
  await page.getByRole('button', { name: new RegExp(emoji) }).first().click();
}

test.describe('关键模块可视回归', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await disableMotion(page);
  });

  test('座位模块主页稳定渲染', async ({ page }) => {
    await openMainTab(page, '🏫');
    await expect(page.getByTestId('seat-chart-panel')).toBeVisible();
    await expect(page).toHaveScreenshot('seat-chart-main.png', { fullPage: true });
  });

  test('测验模块主页稳定渲染', async ({ page }) => {
    await openMainTab(page, '📝');
    await expect(page.getByTestId('quiz-panel')).toBeVisible();
    await expect(page).toHaveScreenshot('quiz-panel-main.png', { fullPage: true });
  });

  test('白板模块主页稳定渲染', async ({ page }) => {
    await openMainTab(page, '🎨');
    await expect(page.getByTestId('board-panel')).toBeVisible();
    await expect(page).toHaveScreenshot('board-panel-main.png', { fullPage: true });
  });

  test('工具箱与讨论卡片稳定渲染', async ({ page }) => {
    await openMainTab(page, '🧰');
    await expect(page.getByTestId('toolkit-panel')).toBeVisible();
    await expect(page.getByTestId('barrage-discussion')).toBeVisible();
    await expect(page).toHaveScreenshot('toolkit-discussion-main.png', { fullPage: true });
  });
});
