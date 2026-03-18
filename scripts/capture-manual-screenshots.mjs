import { chromium, devices } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.MANUAL_CAPTURE_URL || 'http://127.0.0.1:4173';
const outDir = path.resolve('docs/images/manual');

async function ensureOutDir() {
  await fs.mkdir(outDir, { recursive: true });
}

async function captureDesktop(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.screenshot({ path: path.join(outDir, '01-home.png'), fullPage: true });

  const tabs = [
    { index: 0, file: '02-random.png' },
    { index: 1, file: '03-teamwork.png' },
    { index: 2, file: '04-seats.png' },
    { index: 3, file: '05-board.png' },
    { index: 4, file: '06-quiz.png' },
    { index: 5, file: '11-sketch.png' },
    { index: 6, file: '12-ppt.png' },
    { index: 7, file: '13-visual.png' },
    { index: 8, file: '07-achievement.png' },
    { index: 9, file: '08-toolkit.png' },
  ];

  for (const item of tabs) {
    const tabButton = page.locator('nav button').nth(item.index);
    if ((await tabButton.count()) > 0) {
      await tabButton.click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(outDir, item.file), fullPage: true });
    }
  }
}

async function captureMobile(browser) {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
  });

  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '09-mobile-home.png'), fullPage: true });

  const tabButton = page.locator('nav button').nth(2);
  if ((await tabButton.count()) > 0) {
    await tabButton.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, '10-mobile-seats.png'), fullPage: true });
  }

  await context.close();
}

async function main() {
  await ensureOutDir();
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await captureDesktop(page);
    await context.close();

    await captureMobile(browser);

    console.log('Manual screenshots captured in docs/images/manual');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
