import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const docsDir = path.resolve('docs');
const htmlPath = path.join(docsDir, 'teacher-training-45min-lecturer-notes.html');
const pdfPath = path.join(docsDir, '教师培训讲义版-45分钟-讲师备注.pdf');

const sections = [
  {
    title: '第1页 开场与系统定位',
    duration: '3分钟',
    script: '这是教创搭子的主工作台。今天我们按“课前准备-课中互动-课后留档”这条主线演示，45分钟后每位老师都能独立跑通一次完整课堂流程。',
    question: '你当前课堂中最耗时的组织动作是什么？',
    images: [
      { src: 'images/manual/annotated/01-home-annotated.png', caption: '应用首页总览（标注版）' },
      { src: 'images/manual/annotated/09-mobile-home-annotated.png', caption: '手机端总览（标注版）' },
    ],
  },
  {
    title: '第2页 名单与班级库',
    duration: '5分钟',
    script: '先加载班级再开展课堂活动，组织效率会显著提升。名单支持粘贴导入、文本导入和班级库复用。',
    question: '你们的名单维护流程来自教务导出还是手工维护？',
    images: [
      { src: 'images/manual/annotated/01-home-annotated.png', caption: '名单区与主工作区联动（复用示意）' },
    ],
  },
  {
    title: '第3页 随机点名',
    duration: '4分钟',
    script: '随机点名支持去重抽取、语音播报和弹窗显示，适合导入提问、复盘抽问和课堂唤醒。',
    question: '你会选择完全随机，还是随机且不重复？',
    images: [
      { src: 'images/manual/annotated/02-random-annotated.png', caption: '随机点名界面（标注版）' },
    ],
  },
  {
    title: '第4页 分组与建队',
    duration: '3分钟',
    script: '先自动分组再拖拽微调，兼顾效率与教学经验。可快速形成讨论组和项目队。',
    question: '你常用的分组策略是均分、异质分组还是按任务分组？',
    images: [
      { src: 'images/manual/annotated/03-teamwork-annotated.png', caption: '分组建队界面（标注版）' },
    ],
  },
  {
    title: '第5页 多场景排座与座位签到',
    duration: '3分钟',
    script: '排座支持教室、机房、会议等多场景，支持禁用座位、走道、拖拽换位，并可与座位签到联动。',
    question: '你更常用考试排座还是小组协作排座？',
    images: [
      { src: 'images/manual/annotated/04-seats-annotated.png', caption: '多场景排座（标注版）' },
      { src: 'images/manual/annotated/10-mobile-seats-annotated.png', caption: '手机端排座（标注版）' },
    ],
  },
  {
    title: '第6页 白板互动',
    duration: '4分钟',
    script: '教师创建互动板后，学生扫码提交卡片，教师端实时汇总展示，适用于观点收集与课堂共创。',
    question: '你希望白板更偏“收集答案”还是“组织讨论”？',
    images: [
      { src: 'images/manual/annotated/05-board-annotated.png', caption: '白板互动（标注版）' },
    ],
  },
  {
    title: '第7页 随堂测验',
    duration: '5分钟',
    script: '题库、会话发布、作答统计和导出在一个流程内完成。建议课中小测，课后直接导出结果复盘。',
    question: '你最关注测验中的哪个指标：参与率、正确率还是错因分布？',
    images: [
      { src: 'images/manual/annotated/06-quiz-annotated.png', caption: '随堂测验（标注版）' },
    ],
  },
  {
    title: '第8页 成就系统与课堂激励',
    duration: '3分钟',
    script: '通过积分、徽章和排行榜实现过程性评价，适合个人激励和小组竞赛。',
    question: '你更倾向奖励个人成长，还是奖励团队协作？',
    images: [
      { src: 'images/manual/annotated/07-achievement-annotated.png', caption: '成就系统（标注版）' },
    ],
  },
  {
    title: '第9页 工具箱',
    duration: '3分钟',
    script: '工具箱用于课中即插即用，推荐先掌握倒计时、二维码、投票、课堂指令卡四件套。',
    question: '哪三个工具你会在下周课堂优先上线？',
    images: [
      { src: 'images/manual/annotated/08-toolkit-annotated.png', caption: '工具箱（标注版）' },
    ],
  },
  {
    title: '第10页 AI故事板',
    duration: '2分钟',
    script: '输入主题后快速生成故事板，适合情境导入、案例讲解和项目汇报。',
    question: '哪门课最适合先用故事板开场？',
    images: [
      { src: 'images/manual/annotated/11-sketch-annotated.png', caption: 'AI故事板（标注版）' },
    ],
  },
  {
    title: '第11页 AI PPT 生成',
    duration: '3分钟',
    script: '从文本到大纲再到PPT导出，显著缩短备课时间，可按受众与模板快速切换风格。',
    question: '你最希望AI帮你节省哪一步：写大纲、排版还是出图？',
    images: [
      { src: 'images/manual/annotated/12-ppt-annotated.png', caption: 'AI PPT（标注版）' },
    ],
  },
  {
    title: '第12页 AI 文本可视化',
    duration: '3分钟',
    script: '将长文本自动结构化并转成信息图，适合政策解读、章节总结、数据表达。',
    question: '你有哪些文字材料可以直接转为可视化讲义？',
    images: [
      { src: 'images/manual/annotated/13-visual-annotated.png', caption: 'AI文本可视化（标注版）' },
    ],
  },
  {
    title: '第13页 导出留档与收尾任务',
    duration: '4分钟',
    script: '请每组完成“名单-点名-分组-排座-白板/测验-导出”的完整闭环，并用1分钟分享落地方案。',
    question: '如果明天上课，你会先部署哪三个模块？',
    images: [],
  },
];

const totalMinutes = 45;

function sectionToHtml(section) {
  const imagesHtml = section.images
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
    <section class="page page-break">
      <h2>${section.title}</h2>
      <div class="meta"><span class="chip">演示时长：${section.duration}</span></div>
      <p><strong>讲解词：</strong>${section.script}</p>
      <p><strong>提问点：</strong>${section.question}</p>
      ${imagesHtml ? `<div class="grid">${imagesHtml}</div>` : '<p class="hint">本页为讲师口播与实操任务，不强制截图。</p>'}
    </section>
  `;
}

function buildHtml() {
  const sectionsHtml = sections.map(sectionToHtml).join('\n');
  return `
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>教创搭子-45分钟讲师备注版</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      color: #0f172a;
      background: #eef2ff;
      line-height: 1.55;
      font-size: 12pt;
    }
    .cover {
      min-height: 265mm;
      background: radial-gradient(circle at 20% 20%, #dbeafe, #f8fafc 55%), linear-gradient(160deg, #eff6ff 0%, #fff7ed 100%);
      border: 2px solid #93c5fd;
      border-radius: 16px;
      padding: 24mm 14mm;
      page-break-after: always;
    }
    .cover h1 { margin: 0; font-size: 30pt; color: #1e3a8a; }
    .cover h2 { margin: 5mm 0 0; font-size: 18pt; color: #1d4ed8; font-weight: 700; }
    .cover p { margin-top: 8mm; color: #334155; }
    .agenda {
      margin-top: 10mm;
      padding: 10px 12px;
      background: #ffffffcc;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      font-size: 10.5pt;
    }
    .page {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }
    .page-break { page-break-before: always; }
    h2 { margin: 0 0 6px; font-size: 16pt; color: #1d4ed8; }
    .meta { margin-bottom: 8px; }
    .chip {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      background: #dbeafe;
      color: #1e40af;
      font-size: 10pt;
      font-weight: 700;
    }
    p { margin: 6px 0; }
    .grid {
      margin-top: 8px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .shot {
      margin: 0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }
    .shot img { display: block; width: 100%; }
    .shot figcaption {
      padding: 6px 8px;
      font-size: 9.5pt;
      color: #334155;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .hint {
      padding: 8px;
      border-left: 4px solid #f59e0b;
      background: #fffbeb;
      color: #92400e;
      border-radius: 6px;
      font-size: 10pt;
    }
    .footer {
      margin-top: 6mm;
      text-align: center;
      color: #64748b;
      font-size: 9pt;
    }
  </style>
</head>
<body>
  <section class="cover">
    <h1>教创搭子</h1>
    <h2>校内培训讲义（45分钟讲师备注版）</h2>
    <p>版本：2026-03-18</p>
    <p>定位：每页可直接口播，含讲解词、提问点、演示时长。</p>
    <div class="agenda">
      <strong>总时长：</strong>${totalMinutes}分钟<br />
      <strong>覆盖范围：</strong>名单班级库、点名、分组、排座、白板、测验、成就、工具箱、AI故事板、AI PPT、AI文本可视化、导出留档。
    </div>
  </section>

  ${sectionsHtml}

  <p class="footer">教创搭子 · 45分钟讲师备注版 · 自动生成</p>
</body>
</html>
  `;
}

async function main() {
  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(htmlPath, buildHtml(), 'utf8');

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

  console.log('Generated HTML:', htmlPath);
  console.log('Generated PDF:', pdfPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
