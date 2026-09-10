import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 教师端功能需要登录态。会话文件由 `lovable auth-session --json --self` 生成，
// 未找到时自动跳过（本地/CI 可通过 BOARD_E2E_SESSION_FILE 指定路径）。
const SESSION_FILE = process.env.BOARD_E2E_SESSION_FILE
  || path.join(os.homedir(), '.cache', 'lovable-auth', 'session.json');

function loadSession() {
  try {
    const raw = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    const storageKey = raw.storage_key || raw.storageKey;
    const session = raw.session || raw;
    if (!storageKey || !session?.access_token) return null;
    return { storageKey, sessionJson: JSON.stringify(session) };
  } catch {
    return null;
  }
}

const auth = loadSession();

const LONG_TEXT = Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 行：function demo${i}() { return ${i}; }`).join('\n');

async function openBoardTab(page) {
  await page.goto('/');
  if (auth) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [auth.storageKey, auth.sessionJson]);
    await page.reload();
    // 等待登录态生效，否则新建的白板会挂在匿名身份下、列表看不到
    await expect(page.getByRole('button', { name: '登录' })).toHaveCount(0, { timeout: 20_000 });
  }
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
  await page.getByTestId('board-submit-nickname').fill(nickname);
  await page.getByTestId('board-submit-join').click();
  const fab = page.getByTestId('board-submit-fab');
  if (await fab.count()) await fab.click();
  const editor = page.getByTestId('board-submit-content');
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.fill(content);
  await page.getByTestId('board-submit-btn').click();
  // 提交成功后编辑面板自动关闭
  await expect(page.getByTestId('board-submit-content')).toHaveCount(0, { timeout: 20_000 });
}

test.describe('白板模块端到端回归', () => {
  test.skip(!auth, '缺少登录态会话文件，跳过教师端白板回归');

  test('创建白板、切换视图、锁板与删除', async ({ page }) => {
    const title = `E2E白板-${Date.now()}`;
    await openBoardTab(page);
    const item = await createBoard(page, title);
    await item.click();

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
    await expect(page.getByTestId('board-locked-screen')).toBeVisible({ timeout: 15_000 });

    await openBoardTab(page);
    page.once('dialog', d => d.accept());
    await page.locator(`[data-board-id="${boardId}"]`).first().getByTestId('board-delete').click();
  });
});
