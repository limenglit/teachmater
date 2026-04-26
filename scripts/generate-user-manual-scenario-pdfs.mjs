import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const docsDir = path.resolve('docs');

const quickHtmlPath = path.join(docsDir, 'user-manual-10min-quickstart.html');
const quickPdfPath = path.join(docsDir, '教创搭子-用户手册-10分钟速读版.pdf');

const lecturerHtmlPath = path.join(docsDir, 'user-manual-45min-lecturer.html');
const lecturerPdfPath = path.join(docsDir, '教创搭子-用户手册-45分钟讲解版.pdf');

function buildQuickHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>教创搭子用户手册-10分钟速读版</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      color: #0f172a;
      font-size: 11pt;
      line-height: 1.5;
      background: #f8fafc;
    }
    .sheet {
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      background: #fff;
      padding: 10px 12px;
    }
    h1 {
      margin: 0;
      font-size: 20pt;
      color: #1d4ed8;
    }
    .subtitle {
      margin-top: 4px;
      color: #334155;
      font-size: 10pt;
    }
    .mainline {
      margin-top: 10px;
      border-left: 4px solid #2563eb;
      background: #eff6ff;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 10.5pt;
    }
    .grid {
      margin-top: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
    }
    .card h2 {
      margin: 0;
      padding: 8px 10px;
      font-size: 12pt;
      color: #1e40af;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
    }
    .card ul {
      margin: 8px 0 0 18px;
      padding: 0 10px 10px 0;
    }
    .card li { margin: 4px 0; }
    .shots {
      margin-top: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    figure {
      margin: 0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }
    figure img { display: block; width: 100%; }
    figcaption {
      font-size: 8.5pt;
      color: #475569;
      padding: 4px 6px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .tips {
      margin-top: 10px;
      padding: 8px 10px;
      border: 1px dashed #94a3b8;
      border-radius: 8px;
      background: #f8fafc;
      font-size: 10pt;
    }
    .footer {
      margin-top: 8px;
      text-align: right;
      color: #64748b;
      font-size: 8.5pt;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h1>教创搭子用户手册（10分钟速读版）</h1>
    <div class="subtitle">适用对象：第一次上手的老师 · 目标：一节课跑通“课前-课中-课后”</div>

    <div class="mainline">
      <strong>主线：</strong>
      课前导入学员名单并完成分组/建队/排座；
      课中使用白板互动并收缴作业；
      课后用词库巩固知识点并查看班级积分。
    </div>

    <div class="grid">
      <section class="card">
        <h2>课前（3-4分钟）</h2>
        <ul>
          <li>导入学员名单，检查重名和空行。</li>
          <li>自动分组后拖拽微调，形成队伍结构。</li>
          <li>按教室实际行列、走道、禁用位完成排座。</li>
        </ul>
      </section>

      <section class="card">
        <h2>课中（4-5分钟）</h2>
        <ul>
          <li>创建白板话题，发布二维码。</li>
          <li>收集学生作业卡片并进行点评/置顶。</li>
          <li>穿插倒计时、随机点名，保持课堂节奏。</li>
        </ul>
      </section>

      <section class="card">
        <h2>课后（2-3分钟）</h2>
        <ul>
          <li>将本节知识点整理进词库并生成闪卡。</li>
          <li>查看班级积分与个人表现变化。</li>
          <li>导出课堂数据并按班级日期归档。</li>
        </ul>
      </section>

      <section class="card">
        <h2>完成标志</h2>
        <ul>
          <li>名单、分组、座位三项可复用。</li>
          <li>白板作业可追踪、可点评。</li>
          <li>词库与积分可用于复盘和激励。</li>
        </ul>
      </section>
    </div>

    <div class="shots">
      <figure>
        <img src="images/manual/annotated/03-teamwork-annotated.png" alt="分组建队" />
        <figcaption>分组与建队</figcaption>
      </figure>
      <figure>
        <img src="images/manual/annotated/04-seats-annotated.png" alt="排座" />
        <figcaption>按教室实际排座</figcaption>
      </figure>
      <figure>
        <img src="images/manual/annotated/05-board-annotated.png" alt="白板互动" />
        <figcaption>白板互动与作业收缴</figcaption>
      </figure>
    </div>

    <div class="tips">
      <strong>新手建议：</strong>先跑通主线，不追求一次用全功能。先稳定流程，再扩展玩法。
    </div>

    <div class="footer">教创搭子 · 用户手册速读版</div>
  </div>
</body>
</html>`;
}

const lecturerSections = [
  {
    title: '第1讲 课前准备：名单导入与班级校验（8分钟）',
    story: '作为任课老师，我希望开课前 8 分钟完成班级数据准备，避免上课后再处理名单。',
    steps: [
      '打开首页并导入学员名单。',
      '检查重名、空行、缺失姓名。',
      '确认本次课堂目标与分组策略。',
    ],
    image: { src: 'images/manual/annotated/01-home-annotated.png', caption: '首页与名单区' },
  },
  {
    title: '第2讲 课前组织：分组与建队（8分钟）',
    story: '作为课堂组织者，我希望在开课前形成可执行的小组结构。',
    steps: [
      '进入分组/建队模块，设置组数或每队人数。',
      '点击自动分组后，根据任务进行拖拽微调。',
      '确认每队职责或队长。',
    ],
    image: { src: 'images/manual/annotated/03-teamwork-annotated.png', caption: '分组建队操作区' },
  },
  {
    title: '第3讲 课前就绪：按教室实际排座（8分钟）',
    story: '作为班级管理者，我希望座位图与教室真实布局一致，减少现场混乱。',
    steps: [
      '选择场景并配置行列、走道、禁用位。',
      '自动排座后按实际情况局部微调。',
      '必要时导出座位图用于投屏或打印。',
    ],
    image: { src: 'images/manual/annotated/04-seats-annotated.png', caption: '多场景排座' },
  },
  {
    title: '第4讲 课中互动：白板收缴作业（8分钟）',
    story: '作为授课老师，我希望学生通过手机快速提交作业，我能实时汇总并讲评。',
    steps: [
      '创建白板话题并明确提交要求。',
      '出示二维码让学生提交作业卡片。',
      '按内容筛选、点评、置顶优秀答案。',
    ],
    image: { src: 'images/manual/annotated/05-board-annotated.png', caption: '白板互动与卡片汇总' },
  },
  {
    title: '第5讲 课后巩固：词库记忆与积分复盘（8分钟）',
    story: '作为授课老师，我希望课后把知识点固化到词库并结合积分做持续激励。',
    steps: [
      '将本课核心点录入词库并生成闪卡。',
      '布置学生课后用闪卡复习。',
      '查看班级积分变化并记录激励结果。',
    ],
    image: { src: 'images/manual/annotated/07-achievement-annotated.png', caption: '成就与班级积分' },
  },
  {
    title: '第6讲 收尾留档：输出课堂资产（5分钟）',
    story: '作为教研负责人，我希望每节课都可追溯、可复用。',
    steps: [
      '导出分组、座位、白板提交、测验、积分数据。',
      '按“班级-日期-课次”命名归档。',
      '复盘下节课需要沿用的模板。',
    ],
    image: { src: 'images/manual/annotated/08-toolkit-annotated.png', caption: '工具箱与导出辅助' },
  },
];

function buildLecturerHtml() {
  const sectionsHtml = lecturerSections
    .map((s) => `
      <section class="page page-break">
        <h2>${s.title}</h2>
        <p class="story"><strong>用户故事：</strong>${s.story}</p>
        <ol>${s.steps.map((step) => `<li>${step}</li>`).join('')}</ol>
        <figure>
          <img src="${s.image.src}" alt="${s.image.caption}" />
          <figcaption>${s.image.caption}</figcaption>
        </figure>
      </section>
    `)
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>教创搭子用户手册-45分钟讲解版</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      color: #0f172a;
      background: #eef2ff;
      font-size: 11pt;
      line-height: 1.55;
    }
    .cover {
      min-height: 265mm;
      background: linear-gradient(145deg, #dbeafe 0%, #fff7ed 100%);
      border: 2px solid #93c5fd;
      border-radius: 14px;
      padding: 22mm 14mm;
      page-break-after: always;
    }
    .cover h1 { margin: 0; font-size: 30pt; color: #1e3a8a; }
    .cover h2 { margin: 4mm 0 0; font-size: 17pt; color: #1d4ed8; }
    .cover p { margin-top: 8mm; color: #334155; }
    .agenda {
      margin-top: 8mm;
      padding: 10px 12px;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      background: #ffffffcc;
      font-size: 10pt;
    }
    .page {
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 10px 12px;
    }
    .page-break { page-break-before: always; }
    h2 { margin: 0 0 6px; color: #1d4ed8; font-size: 15pt; }
    .story {
      margin: 0 0 8px;
      padding: 8px 10px;
      background: #f8fafc;
      border-left: 4px solid #2563eb;
      border-radius: 6px;
      font-size: 10pt;
    }
    ol { margin: 0 0 8px 18px; padding: 0; }
    li { margin: 4px 0; }
    figure {
      margin: 0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }
    figure img { display: block; width: 100%; }
    figcaption {
      font-size: 9pt;
      color: #475569;
      padding: 5px 8px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .footer {
      margin-top: 6mm;
      text-align: center;
      color: #64748b;
      font-size: 8.5pt;
    }
  </style>
</head>
<body>
  <section class="cover">
    <h1>教创搭子</h1>
    <h2>用户手册（45分钟讲解版）</h2>
    <p>结构：课前准备 → 课中互动 → 课后巩固与复盘</p>
    <div class="agenda">
      <strong>培训主线：</strong>
      导入学员名单、分组建队、按教室排座；
      白板互动并收缴作业；
      词库巩固知识点并查看班级积分。
    </div>
  </section>

  ${sectionsHtml}

  <p class="footer">教创搭子 · 用户手册45分钟讲解版</p>
</body>
</html>`;
}

async function renderPdf(browser, htmlPath, pdfPath) {
  const page = await browser.newPage();
  try {
    await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await page.close();
  }
}

async function main() {
  await fs.mkdir(docsDir, { recursive: true });

  await fs.writeFile(quickHtmlPath, buildQuickHtml(), 'utf8');
  await fs.writeFile(lecturerHtmlPath, buildLecturerHtml(), 'utf8');

  const browser = await chromium.launch({ headless: true });
  try {
    await renderPdf(browser, quickHtmlPath, quickPdfPath);
    await renderPdf(browser, lecturerHtmlPath, lecturerPdfPath);
  } finally {
    await browser.close();
  }

  console.log('Generated:', quickPdfPath);
  console.log('Generated:', lecturerPdfPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
