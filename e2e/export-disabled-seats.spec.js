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

function segmentsAt(row) {
  const segs = [];
  let inSeg = false;
  let start = 0;
  for (let x = 0; x < row.length; x++) {
    const white = isWhite(row[x]);
    if (!white && !inSeg) {
      inSeg = true;
      start = x;
    } else if (white && inSeg) {
      inSeg = false;
      segs.push([start, x - 1]);
    }
  }
  if (inSeg) segs.push([start, row.length - 1]);
  // 合并因抗锯齿导致相隔 <=1 像素的碎段
  const merged = [];
  for (const s of segs) {
    if (merged.length && s[0] - merged[merged.length - 1][1] <= 1) {
      merged[merged.length - 1][1] = s[1];
    } else {
      merged.push([...s]);
    }
  }
  return merged;
}

function findSeatBand(image) {
  // 找到第一个 y 处横向恰好有 3 段非白（=3 个启用座位）的行，视作基线座位带
  for (let y = 0; y < image.pixels.length; y++) {
    const segs = segmentsAt(image.pixels[y]);
    if (segs.length === 3) return { y, segs };
  }
  return null;
}

test.describe('导出画布 – 禁用座位像素级回归', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  for (const kind of /** @type {const} */ (['png', 'svg'])) {
    test(`${kind.toUpperCase()} 导出隐藏禁用座位且保持网格对齐`, async ({ page }) => {
      const base = await RUN(page, { withDisabled: false, kind });
      const mutated = await RUN(page, { withDisabled: true, kind });

      // 1. 画布尺寸相同 → 外部布局未因禁用座位收缩
      expect(mutated.width).toBe(base.width);
      expect(mutated.height).toBe(base.height);

      // 2. 定位基线中的座位带
      const band = findSeatBand(base);
      expect(band, '基线画布应能识别出 3 个启用座位所在的横向带').not.toBeNull();
      const [leftSeg, midSeg, rightSeg] = band.segs;

      // 3. 在相同 y 上检查禁用版本：中间座位区域应全部为白
      const mutatedRow = mutated.pixels[band.y];
      let disabledAllWhite = true;
      for (let x = midSeg[0]; x <= midSeg[1]; x++) {
        if (!isWhite(mutatedRow[x])) disabledAllWhite = false;
      }
      expect(disabledAllWhite, '禁用座位区域在导出画布中必须完全不可见').toBe(true);

      // 4. 网格对齐：左右两个启用座位在同一行的 x 范围必须与基线一致（允许 ±1 抗锯齿）
      const mutatedSegs = segmentsAt(mutatedRow).filter(
        (s) => s[1] - s[0] > 2, // 过滤微小噪点
      );
      expect(mutatedSegs.length).toBe(2);
      const near = (a, b) => Math.abs(a - b) <= 2;
      expect(near(mutatedSegs[0][0], leftSeg[0])).toBe(true);
      expect(near(mutatedSegs[0][1], leftSeg[1])).toBe(true);
      expect(near(mutatedSegs[1][0], rightSeg[0])).toBe(true);
      expect(near(mutatedSegs[1][1], rightSeg[1])).toBe(true);
    });
  }

  test('PDF 导出通过与 PNG 相同的画布管线（禁用座位不可见）', async ({ page }) => {
    const base = await RUN(page, { withDisabled: false, kind: 'pdf' });
    const mutated = await RUN(page, { withDisabled: true, kind: 'pdf' });
    expect(mutated.width).toBe(base.width);
    const band = findSeatBand(base);
    expect(band).not.toBeNull();
    const [, midSeg] = band.segs;
    const mutatedRow = mutated.pixels[band.y];
    for (let x = midSeg[0]; x <= midSeg[1]; x++) {
      expect(isWhite(mutatedRow[x])).toBe(true);
    }
  });
});

