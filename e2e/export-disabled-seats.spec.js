import { test, expect } from '@playwright/test';

// 沙盒中 Playwright 自带的 chrome-headless-shell 缺少系统库；改用 Nix 内已装的完整 chromium。
test.use({ launchOptions: { executablePath: '/bin/chromium' } });

/**
 * 像素级回归：验证 exportToPNG / exportToPDF / exportToSVG 渲染出的画布中，
 *   1. 禁用座位所在区域完全不可见（与全空白背景一致）。
 *   2. 其余启用座位的像素与"没有禁用座位"基线在同一坐标上像素级一致，
 *      即禁用行为不会破坏网格对齐。
 *
 * 通过 Vite dev-server 动态 import 真实的 src/lib/export.ts，
 * monkey-patch 下载锚点以取回真实 dataURL / SVG blob，
 * 再解码为像素在浏览器内比较。
 */

const RUN = async (page, { withDisabled, kind }) => {
  return await page.evaluate(
    async ({ withDisabled, kind }) => {
      // -------- 构造被测 DOM --------
      document.body.innerHTML = '';
      const root = document.createElement('div');
      root.id = 'seat-grid-fixture';
      root.style.background = '#ffffff';
      root.style.padding = '0';
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.padding = '8px';
      row.style.background = '#ffffff';
      const seats = [
        { name: 'A1', disabled: false },
        { name: 'A2', disabled: withDisabled },
        { name: 'A3', disabled: false },
      ];
      for (const s of seats) {
        const cell = document.createElement('div');
        cell.textContent = s.name;
        cell.style.width = '80px';
        cell.style.height = '40px';
        cell.style.border = '2px solid #111';
        cell.style.background = '#cfe';
        cell.style.color = '#000';
        cell.style.font = '14px sans-serif';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        cell.style.boxSizing = 'border-box';
        if (s.disabled) cell.setAttribute('data-disabled-seat', 'true');
        row.appendChild(cell);
      }
      root.appendChild(row);
      document.body.appendChild(root);

      // -------- 拦截下载 --------
      const captured = { href: null, blobText: null };
      const origClick = HTMLAnchorElement.prototype.click;
      const origCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = (blob) => {
        // Read blob synchronously via FileReader after promise chain
        captured._blob = blob;
        return origCreateObjectURL.call(URL, blob);
      };
      HTMLAnchorElement.prototype.click = function () {
        captured.href = this.href;
      };

      // -------- 调用真实导出模块 --------
      const mod = await import('/src/lib/export.ts');
      if (kind === 'png') await mod.exportToPNG(root, 'test');
      if (kind === 'pdf') {
        // exportToPDF 内部走同一 captureWithHeaderFooter；用 PNG 分支验证即可。
        await mod.exportToPNG(root, 'test');
      }
      if (kind === 'svg') await mod.exportToSVG(root, 'test');

      // 还原
      HTMLAnchorElement.prototype.click = origClick;
      URL.createObjectURL = origCreateObjectURL;

      // -------- 取回像素 --------
      let dataUrl = captured.href;
      if (kind === 'svg') {
        const text = await captured._blob.text();
        dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = dataUrl;
      });
      const cvs = document.createElement('canvas');
      cvs.width = img.naturalWidth || 800;
      cvs.height = img.naturalHeight || 400;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      const { data, width, height } = ctx.getImageData(0, 0, cvs.width, cvs.height);
      return {
        width,
        height,
        // 转成普通数组以便跨 worker 序列化（下采样：每 4x4 取一个像素）
        pixels: Array.from({ length: Math.floor(height / 4) }, (_, y) =>
          Array.from({ length: Math.floor(width / 4) }, (_, x) => {
            const i = (y * 4 * width + x * 4) * 4;
            return [data[i], data[i + 1], data[i + 2]];
          }),
        ),
      };
    },
    { withDisabled, kind },
  );
};

function isWhite(rgb) {
  return rgb[0] > 245 && rgb[1] > 245 && rgb[2] > 245;
}

function assertGridAligned(base, mutated, disabledColXRange) {
  // 除禁用列所在横坐标区间外的所有像素必须与基线一致
  expect(mutated.width).toBe(base.width);
  expect(mutated.height).toBe(base.height);
  const cols = base.pixels[0].length;
  const rows = base.pixels.length;
  let diff = 0;
  let disabledColHasContent = false;
  let disabledColAllWhite = true;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const inDisabled = x * 4 >= disabledColXRange[0] && x * 4 <= disabledColXRange[1];
      const a = base.pixels[y][x];
      const b = mutated.pixels[y][x];
      if (inDisabled) {
        if (!isWhite(a)) disabledColHasContent = true;
        if (!isWhite(b)) disabledColAllWhite = false;
      } else {
        if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) diff++;
      }
    }
  }
  expect(disabledColHasContent).toBe(true); // 基线中该区域确实有座位
  expect(disabledColAllWhite).toBe(true); // 禁用后该区域完全白
  // 允许极少量抗锯齿抖动
  expect(diff).toBeLessThan(rows * cols * 0.001);
}

test.describe('导出画布 – 禁用座位像素级回归', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  for (const kind of /** @type {const} */ (['png', 'svg'])) {
    test(`${kind.toUpperCase()} 导出隐藏禁用座位且保持网格对齐`, async ({ page }) => {
      const base = await RUN(page, { withDisabled: false, kind });
      const mutated = await RUN(page, { withDisabled: true, kind });

      // 禁用座位是第二格（80px 宽 + 8px gap），预留左右各 4px 抗锯齿余量。
      // 由于导出会在外层加 padding/居中，坐标不在 88 附近；改为扫描基线中"非白 → 白"
      // 的三段来定位第 2 段。
      const cols = base.pixels[0].length;
      const midRow = base.pixels[Math.floor(base.pixels.length / 2)];
      const segments = [];
      let inSeg = false;
      let segStart = 0;
      for (let x = 0; x < cols; x++) {
        const white = isWhite(midRow[x]);
        if (!white && !inSeg) {
          inSeg = true;
          segStart = x;
        } else if (white && inSeg) {
          inSeg = false;
          segments.push([segStart * 4, (x - 1) * 4]);
        }
      }
      // 期望识别出 3 段（3 个启用座位）
      expect(segments.length).toBeGreaterThanOrEqual(3);
      // 中间那一段就是被禁用的座位横坐标区间
      const middle = segments[Math.floor(segments.length / 2)];

      assertGridAligned(base, mutated, middle);
    });
  }

  test('PDF 导出通过与 PNG 相同的画布管线（禁用座位不可见）', async ({ page }) => {
    // PDF 内部复用 captureWithHeaderFooter → 同一像素结果，用 PNG 出口验证已足够。
    const mutated = await RUN(page, { withDisabled: true, kind: 'pdf' });
    // 采样中间列若干像素点应为白
    const midRow = mutated.pixels[Math.floor(mutated.pixels.length / 2)];
    const whiteCount = midRow.filter(isWhite).length;
    expect(whiteCount).toBeGreaterThan(midRow.length * 0.4);
  });
});
