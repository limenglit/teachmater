import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const docsDir = path.resolve('docs');
const htmlPath = path.join(docsDir, 'teacher-training-handout.html');
const pdfPath = path.join(docsDir, '教师培训讲义版-教创搭子.pdf');

const sections = [
  {
    title: '1. 开场与系统定位',
    objective: '3 分钟让参训教师建立整体认知。',
    points: [
      '教创搭子是课堂组织、互动、测验、评价、导出的一体化工具。',
      '一节课可按“课前准备-课中互动-课后留档”三阶段使用。',
      '手机端可完成高频操作，电脑端适合精细编辑。',
    ],
    images: [
      { src: 'images/manual/annotated/01-home-annotated.png', caption: '图 1-1 应用总览（标注版）' },
      { src: 'images/manual/annotated/09-mobile-home-annotated.png', caption: '图 1-2 手机端总览（标注版）' },
    ],
    demo: '现场演示：加载名单 -> 切换功能标签 -> 展示主工作区。',
  },
  {
    title: '2. 课堂组织：点名、分组、排座',
    objective: '建立高效课堂秩序，减少组织耗时。',
    points: [
      '随机点名支持去重、语音播报与弹窗显示。',
      '分组建队支持自动分配与拖拽微调。',
      '排座支持多场景与多策略，并可开启座位签到。',
    ],
    images: [
      { src: 'images/manual/annotated/02-random-annotated.png', caption: '图 2-1 随机点名（标注版）' },
      { src: 'images/manual/annotated/03-teamwork-annotated.png', caption: '图 2-2 分组建队（标注版）' },
      { src: 'images/manual/annotated/04-seats-annotated.png', caption: '图 2-3 多场景排座（标注版）' },
      { src: 'images/manual/annotated/10-mobile-seats-annotated.png', caption: '图 2-4 手机端座位视图（标注版）' },
    ],
    demo: '现场演示：自动分组 -> 一键排座 -> 导出座位图。',
  },
  {
    title: '3. 课堂互动：白板与测验',
    objective: '让学生“即时参与、可视表达、可量化反馈”。',
    points: [
      '白板互动支持二维码提交、卡片墙展示和课堂汇总。',
      '测验模块支持题库建题、发布会话、统计结果导出。',
      '两者都可用于形成课堂证据和课后复盘材料。',
    ],
    images: [
      { src: 'images/manual/annotated/05-board-annotated.png', caption: '图 3-1 白板互动（标注版）' },
      { src: 'images/manual/annotated/06-quiz-annotated.png', caption: '图 3-2 随堂测验（标注版）' },
    ],
    demo: '现场演示：创建互动白板 -> 发布测验二维码 -> 查看统计。',
  },
  {
    title: '4. 课堂激励与微工具',
    objective: '构建正向激励与课堂节奏控制能力。',
    points: [
      '成就系统支持积分、徽章、排行榜与导出。',
      '工具箱集合倒计时、二维码、投票、指令卡等高频功能。',
      '建议将工具箱作为课堂“即插即用”组件。',
    ],
    images: [
      { src: 'images/manual/annotated/07-achievement-annotated.png', caption: '图 4-1 成就系统（标注版）' },
      { src: 'images/manual/annotated/08-toolkit-annotated.png', caption: '图 4-2 工具箱（标注版）' },
    ],
    demo: '现场演示：批量加分 -> 发放徽章 -> 启动倒计时。',
  },
  {
    title: '5. 培训收尾：实操任务与落地建议',
    objective: '确保参训教师可以独立完成一次完整课堂流程。',
    points: [
      '实操任务 A：完成“名单 -> 点名 -> 分组 -> 排座 -> 导出”。',
      '实操任务 B：完成“白板互动 -> 测验 -> 成就加分 -> 导出”。',
      '建议校内建立“模板班级”和“标准课前检查表”。',
    ],
    images: [],
    demo: '现场任务：每组教师 15 分钟复现一次课堂全流程。',
  },
];

function buildHtml() {
  const sectionHtml = sections
    .map((section) => {
      const pointsHtml = section.points.map((p) => `<li>${p}</li>`).join('');
      const imageHtml = section.images
        .map(
          (img) => `
            <figure class="shot">
              <img src="${img.src}" alt="${img.caption}" />
              <figcaption>${img.caption}</figcaption>
            </figure>
          `,
        )
        .join('');

      return `
        <section class="section page-break">
          <h2>${section.title}</h2>
          <p class="objective"><strong>培训目标：</strong>${section.objective}</p>
          <ul>${pointsHtml}</ul>
          ${imageHtml ? `<div class="grid">${imageHtml}</div>` : ''}
          <p class="demo"><strong>讲师演示脚本：</strong>${section.demo}</p>
        </section>
      `;
    })
    .join('\n');

  return `
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>教创搭子教师培训讲义版</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      color: #111827;
      background: #f8fafc;
      line-height: 1.5;
      font-size: 12pt;
    }
    .cover {
      min-height: 260mm;
      background: linear-gradient(135deg, #eff6ff 0%, #fef3c7 100%);
      border: 2px solid #bfdbfe;
      border-radius: 16px;
      padding: 24mm 16mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      page-break-after: always;
    }
    .cover h1 {
      margin: 0;
      font-size: 28pt;
      color: #0f172a;
    }
    .cover h2 {
      margin: 10mm 0 0;
      font-size: 16pt;
      color: #1e293b;
      font-weight: 500;
    }
    .cover p {
      margin-top: 12mm;
      font-size: 11pt;
      color: #334155;
    }
    .section {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .page-break {
      page-break-before: always;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 16pt;
      color: #1d4ed8;
    }
    .objective, .demo {
      margin: 8px 0;
      padding: 8px;
      background: #f8fafc;
      border-left: 4px solid #2563eb;
      border-radius: 6px;
      font-size: 10.5pt;
    }
    ul {
      margin: 6px 0 10px 18px;
      padding: 0;
    }
    li { margin: 3px 0; }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin: 10px 0;
    }
    .shot {
      margin: 0;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }
    .shot img {
      width: 100%;
      display: block;
    }
    .shot figcaption {
      padding: 6px 8px;
      font-size: 10pt;
      background: #f8fafc;
      color: #334155;
      border-top: 1px solid #e5e7eb;
    }
    .footer {
      margin-top: 8mm;
      text-align: center;
      font-size: 9pt;
      color: #64748b;
    }
  </style>
</head>
<body>
  <section class="cover">
    <h1>教创搭子</h1>
    <h2>教师培训讲义版（线下宣讲）</h2>
    <p>版本：2026-03-18<br />用途：校内培训 / 教研工作坊 / 新教师上手</p>
  </section>

  ${sectionHtml}

  <p class="footer">教创搭子培训讲义 · 自动生成版本</p>
</body>
</html>
  `;
}

async function main() {
  await fs.mkdir(docsDir, { recursive: true });
  const html = buildHtml();
  await fs.writeFile(htmlPath, html, 'utf8');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }

  console.log('Generated handout HTML:', htmlPath);
  console.log('Generated handout PDF:', pdfPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
