import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const sourceDir = path.resolve('docs/images/manual');
const outDir = path.resolve('docs/images/manual/annotated');

const annotationMap = {
  '01-home.png': [
    { box: [0.01, 0.10, 0.17, 0.86], label: '名单与班级区', anchor: [0.22, 0.13] },
    { box: [0.18, 0.00, 0.80, 0.11], label: '功能导航条', anchor: [0.56, 0.16] },
    { box: [0.20, 0.12, 0.77, 0.82], label: '课堂主工作区', anchor: [0.66, 0.38] },
  ],
  '02-random.png': [
    { box: [0.22, 0.11, 0.46, 0.63], label: '点名核心区域', anchor: [0.72, 0.20] },
    { box: [0.22, 0.74, 0.20, 0.12], label: '抽取控制按钮', anchor: [0.55, 0.78] },
    { box: [0.56, 0.13, 0.23, 0.70], label: '骰子辅助抽取', anchor: [0.82, 0.28] },
  ],
  '03-teamwork.png': [
    { box: [0.20, 0.18, 0.58, 0.64], label: '分组列表与拖拽区', anchor: [0.81, 0.20] },
    { box: [0.20, 0.10, 0.22, 0.08], label: '分组/建队切换', anchor: [0.52, 0.12] },
    { box: [0.79, 0.11, 0.20, 0.80], label: '操作与导出面板', anchor: [0.56, 0.62] },
  ],
  '04-seats.png': [
    { box: [0.20, 0.13, 0.23, 0.78], label: '场景与参数设置', anchor: [0.48, 0.16] },
    { box: [0.44, 0.13, 0.55, 0.78], label: '座位图编辑区', anchor: [0.76, 0.14] },
    { box: [0.44, 0.86, 0.22, 0.10], label: '导出与签到入口', anchor: [0.77, 0.82] },
  ],
  '05-board.png': [
    { box: [0.20, 0.12, 0.76, 0.12], label: '白板控制栏', anchor: [0.56, 0.28] },
    { box: [0.20, 0.24, 0.76, 0.66], label: '卡片墙展示区', anchor: [0.80, 0.40] },
    { box: [0.77, 0.12, 0.19, 0.78], label: '会话/二维码操作', anchor: [0.56, 0.66] },
  ],
  '06-quiz.png': [
    { box: [0.20, 0.15, 0.76, 0.09], label: '题库/会话页签', anchor: [0.58, 0.29] },
    { box: [0.20, 0.25, 0.56, 0.63], label: '题目与试卷区', anchor: [0.80, 0.45] },
    { box: [0.77, 0.25, 0.19, 0.62], label: '发起测验操作', anchor: [0.56, 0.72] },
  ],
  '07-achievement.png': [
    { box: [0.20, 0.12, 0.76, 0.10], label: '班级与积分操作', anchor: [0.56, 0.27] },
    { box: [0.20, 0.23, 0.76, 0.09], label: '排行榜/徽章页签', anchor: [0.70, 0.38] },
    { box: [0.20, 0.33, 0.76, 0.56], label: '积分榜主视图', anchor: [0.80, 0.56] },
  ],
  '08-toolkit.png': [
    { box: [0.20, 0.13, 0.76, 0.11], label: '课堂工具总入口', anchor: [0.55, 0.29] },
    { box: [0.20, 0.26, 0.76, 0.63], label: '工具卡片矩阵', anchor: [0.80, 0.44] },
    { box: [0.63, 0.57, 0.33, 0.28], label: '二维码与指令卡', anchor: [0.54, 0.84] },
  ],
  '09-mobile-home.png': [
    { box: [0.00, 0.15, 1.00, 0.07], label: '移动端导航', anchor: [0.72, 0.33] },
    { box: [0.02, 0.22, 0.96, 0.74], label: '移动端主工作区', anchor: [0.78, 0.55] },
  ],
  '10-mobile-seats.png': [
    { box: [0.02, 0.15, 0.96, 0.08], label: '座位模块切换', anchor: [0.70, 0.33] },
    { box: [0.02, 0.25, 0.96, 0.68], label: '移动端座位编辑区', anchor: [0.76, 0.59] },
  ],
  '11-sketch.png': [
    { box: [0.20, 0.12, 0.24, 0.79], label: '故事板参数配置', anchor: [0.50, 0.14] },
    { box: [0.45, 0.12, 0.53, 0.79], label: 'AI生成预览区', anchor: [0.76, 0.15] },
    { box: [0.22, 0.86, 0.19, 0.10], label: '生成与历史操作', anchor: [0.58, 0.83] },
  ],
  '12-ppt.png': [
    { box: [0.20, 0.11, 0.76, 0.10], label: 'PPT工作流步骤条', anchor: [0.60, 0.26] },
    { box: [0.20, 0.24, 0.40, 0.66], label: '输入与设计区', anchor: [0.64, 0.40] },
    { box: [0.62, 0.24, 0.34, 0.66], label: '预览与导出区', anchor: [0.84, 0.42] },
  ],
  '13-visual.png': [
    { box: [0.20, 0.18, 0.76, 0.16], label: '文本输入与分析', anchor: [0.56, 0.37] },
    { box: [0.20, 0.35, 0.76, 0.12], label: '样式与图表控制', anchor: [0.76, 0.50] },
    { box: [0.20, 0.48, 0.76, 0.42], label: '可视化结果与导出', anchor: [0.80, 0.66] },
  ],
};

function drawArrow(ctx, fromX, fromY, toX, toY, color) {
  const headLength = 14;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 8), toY - headLength * Math.sin(angle - Math.PI / 8));
  ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 8), toY - headLength * Math.sin(angle + Math.PI / 8));
  ctx.closePath();
  ctx.fill();
}

async function annotateSingle(browser, fileName) {
  const srcPath = path.join(sourceDir, fileName);
  const outPath = path.join(outDir, fileName.replace('.png', '-annotated.png'));
  const specs = annotationMap[fileName] || [];

  const buffer = await fs.readFile(srcPath);
  const base64 = buffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  const result = await page.evaluate(async ({ dataUrl, specs }) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context unavailable');
    }

    ctx.drawImage(image, 0, 0);

    const red = '#e11d48';
    const white = '#ffffff';

    for (const spec of specs) {
      const [bx, by, bw, bh] = spec.box;
      const [ax, ay] = spec.anchor;

      const x = bx * image.width;
      const y = by * image.height;
      const w = bw * image.width;
      const h = bh * image.height;

      ctx.strokeStyle = red;
      ctx.lineWidth = Math.max(3, Math.round(image.width / 450));
      ctx.strokeRect(x, y, w, h);

      const labelPaddingX = 14;
      const labelPaddingY = 10;
      const fontSize = Math.max(18, Math.round(image.width / 55));
      ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;

      const text = spec.label;
      const textWidth = ctx.measureText(text).width;
      const labelW = textWidth + labelPaddingX * 2;
      const labelH = fontSize + labelPaddingY * 2;

      let lx = ax * image.width;
      let ly = ay * image.height;

      if (lx + labelW > image.width - 8) lx = image.width - labelW - 8;
      if (ly + labelH > image.height - 8) ly = image.height - labelH - 8;
      if (lx < 8) lx = 8;
      if (ly < 8) ly = 8;

      const targetX = x + w / 2;
      const targetY = y + h / 2;
      const fromX = lx + labelW / 2;
      const fromY = ly + labelH / 2;

      ctx.fillStyle = white;
      ctx.strokeStyle = red;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const radius = 10;
      ctx.moveTo(lx + radius, ly);
      ctx.lineTo(lx + labelW - radius, ly);
      ctx.quadraticCurveTo(lx + labelW, ly, lx + labelW, ly + radius);
      ctx.lineTo(lx + labelW, ly + labelH - radius);
      ctx.quadraticCurveTo(lx + labelW, ly + labelH, lx + labelW - radius, ly + labelH);
      ctx.lineTo(lx + radius, ly + labelH);
      ctx.quadraticCurveTo(lx, ly + labelH, lx, ly + labelH - radius);
      ctx.lineTo(lx, ly + radius);
      ctx.quadraticCurveTo(lx, ly, lx + radius, ly);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = red;
      ctx.fillText(text, lx + labelPaddingX, ly + labelPaddingY + fontSize);

      const headLength = 14;
      const angle = Math.atan2(targetY - fromY, targetX - fromX);

      ctx.strokeStyle = red;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      ctx.fillStyle = red;
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX - headLength * Math.cos(angle - Math.PI / 8), targetY - headLength * Math.sin(angle - Math.PI / 8));
      ctx.lineTo(targetX - headLength * Math.cos(angle + Math.PI / 8), targetY - headLength * Math.sin(angle + Math.PI / 8));
      ctx.closePath();
      ctx.fill();
    }

    return canvas.toDataURL('image/png');
  }, { dataUrl, specs });

  const outBase64 = result.replace(/^data:image\/png;base64,/, '');
  await fs.writeFile(outPath, Buffer.from(outBase64, 'base64'));
  await page.close();
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    const files = Object.keys(annotationMap);
    for (const fileName of files) {
      await annotateSingle(browser, fileName);
      console.log(`Annotated: ${fileName}`);
    }
    console.log('All annotated images generated.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
