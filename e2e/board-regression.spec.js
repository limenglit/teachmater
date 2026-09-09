import { test, expect } from '@playwright/test';

const LONG_TEXT = Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 行：function demo${i}() { return ${i}; }`).join('\n');

async function openBoardTab(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /🎨/ }).first().click();
  await expect(page.getByTestId('board-panel')).toBeVisible();
}

async function createBoard(page, title) {
  await page.getByTestId('board-create-input').fill(title);
  await page.getByTestId('board-create-btn').click();
  const item = page.locator('[data-testid="board-item"]').filter({ hasText: title }).first();
  await expect(item).toBeVisible({ timeout: 15_000 });
  return item;
}

async function submitCard(page, boardId, { nickname, content }) {
  await page.goto(`/board/${boardId}/submit`);
  await page.getByPlaceholder(/昵称|nickname/i).first().fill(nickname);
  await page.getByRole('button', { name: /加入|join/i }).first().click();
  const editor = page.locator('textarea').first();
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.fill(content);
  await page.getByRole('button', { name: /^提交|submit/i }).last().click();
}

test.describe('白板模块端到端回归', () => {
  test('创建白板、切换视图、锁板与删除', async ({ page }) => {
    const title = `E2E白板-${Date.now()}`;
    await openBoardTab(page);
    const item = await createBoard(page, title);
    await item.click();

    await expect(page.getByTestId('board-panel-session')).toBeVisible();

    // 依次切换四种视图，每种都要保持页面可用
    for (const mode of ['timeline', 'canvas', 'storyboard', 'wall']) {
      await page.locator(`[data-view-mode="${mode}"]`).click();
      await expect(page.locator(`[data-view-mode="${mode}"][data-active="true"]`)).toBeVisible({ timeout: 10_000 });
    }

    // 锁板 / 解锁
    const lock = page.getByTestId('board-lock-toggle').first();
    if (await lock.count()) {
      await lock.click();
      await expect(page.getByTestId('board-lock-toggle').first()).toHaveAttribute('data-locked', 'true', { timeout: 10_000 });
      await page.getByTestId('board-lock-toggle').first().click();
      await expect(page.getByTestId('board-lock-toggle').first()).toHaveAttribute('data-locked', 'false', { timeout: 10_000 });
    }

    await page.getByTestId('board-back').first().click();
    await expect(page.getByTestId('board-panel')).toBeVisible();

    // 删除白板（confirm 二次确认）
    page.once('dialog', d => d.accept());
    await item.hover();
    await item.getByTestId('board-delete').click();
    await expect(page.locator('[data-testid="board-item"]').filter({ hasText: title })).toHaveCount(0, { timeout: 10_000 });
  });

  test('学生提交卡片、点赞幂等、长文本折叠与删除卡片', async ({ page }) => {
    const title = `E2E提交-${Date.now()}`;
    await openBoardTab(page);
    const item = await createBoard(page, title);
    const boardId = await item.getAttribute('data-board-id');
    expect(boardId).toBeTruthy();

    await submitCard(page, boardId, { nickname: '小测', content: LONG_TEXT });

    // 回到教师端查看卡片
    await openBoardTab(page);
    await page.locator(`[data-board-id="${boardId}"]`).first().click();
    const card = page.locator('[data-testid="board-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // 长文本自动折叠，可展开与复制
    const expandBtn = card.getByTestId('board-card-expand');
    await expect(expandBtn).toHaveAttribute('data-expanded', 'false');
    await expandBtn.click();
    await expect(expandBtn).toHaveAttribute('data-expanded', 'true');
    await expect(card.getByTestId('board-card-copy')).toBeVisible();

    // 点赞幂等：连点三次仍然只记 1 个赞
    for (let i = 0; i < 3; i++) await card.getByTestId('board-card-like').click();
    await expect(card).toHaveAttribute('data-card-likes', '1', { timeout: 10_000 });

    // 置顶
    await card.getByTestId('board-card-pin').click();
    await expect(page.locator('[data-testid="board-card"]').first()).toHaveAttribute('data-card-pinned', 'true', { timeout: 10_000 });

    // 删除卡片
    await page.locator('[data-testid="board-card"]').first().getByTestId('board-card-delete').click();
    await expect(page.locator('[data-testid="board-card"]')).toHaveCount(0, { timeout: 10_000 });

    // 清理
    await page.getByTestId('board-back').first().click();
    page.once('dialog', d => d.accept());
    await page.locator(`[data-board-id="${boardId}"]`).first().getByTestId('board-delete').click();
  });

  test('锁板后学生端不可提交', async ({ page }) => {
    const title = `E2E锁板-${Date.now()}`;
    await openBoardTab(page);
    const item = await createBoard(page, title);
    const boardId = await item.getAttribute('data-board-id');
    await item.click();
    await page.getByTestId('board-lock-toggle').first().click();
    await expect(page.getByTestId('board-lock-toggle').first()).toHaveAttribute('data-locked', 'true', { timeout: 10_000 });

    await page.goto(`/board/${boardId}/submit`);
    await expect(page.getByText(/锁定|locked/i).first()).toBeVisible({ timeout: 15_000 });

    await openBoardTab(page);
    page.once('dialog', d => d.accept());
    await page.locator(`[data-board-id="${boardId}"]`).first().getByTestId('board-delete').click();
  });
});
