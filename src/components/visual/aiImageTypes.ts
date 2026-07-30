// AI 生图（火山引擎豆包 / Seedream）配置：10 种图表类型 + 二级风格 + 配色/字体/风格
export interface ChartTypeDef {
  key: string;
  name: string;
  icon: string;
  desc: string;
  subs: string[];
}

export const CHART_TYPES: ChartTypeDef[] = [
  { key: 'infographic', name: '信息图', icon: '📊', desc: '把要点、数据整合成一张可讲解的图文海报', subs: ['统计卡片', '数据总览', '要点列表', '图文混排', '时间轴信息图', '对比信息图'] },
  { key: 'mechanism', name: '机制图', icon: '⚙️', desc: '解释「怎么运作」，强调输入→过程→输出', subs: ['流程机制', '因果链', '反馈回路', '循环机制', '层次结构', '网络机制'] },
  { key: 'research', name: '科研申报图', icon: '🔬', desc: '课题申报、技术路线与研究框架', subs: ['技术路线', '研究框架', '实验设计', '甘特图', '鱼骨图', '概念框架'] },
  { key: 'flowchart', name: '流程图', icon: '🔀', desc: '按步骤/分支表达执行过程', subs: ['基本流程', '泳道图', '跨职能流程', '决策树', '工作流', '数据流'] },
  { key: 'architecture', name: '架构图', icon: '🏗️', desc: '系统分层、模块与依赖关系', subs: ['系统架构', '云架构', '微服务', '数据架构', '网络拓扑', '分层架构'] },
  { key: 'datachart', name: '数据图表', icon: '📈', desc: '用图形准确表达数值与趋势', subs: ['柱状图', '折线图', '饼图', '雷达图', '散点图', '面积图', '环形图', '热力图'] },
  { key: 'mindmap', name: '思维导图', icon: '🧠', desc: '中心主题向外发散的知识结构', subs: ['辐射状', '树状图', '逻辑图', '概念图', '气泡图', '组织结构'] },
  { key: 'timeline', name: '时间轴', icon: '⏳', desc: '按时间顺序展示阶段与里程碑', subs: ['水平时间轴', '垂直时间轴', '环形时间轴', '里程碑', '甘特图', '项目路线'] },
  { key: 'comparison', name: '对比图', icon: '⚖️', desc: '并列比较多个对象的异同', subs: ['并排对比', '矩阵对比', '韦恩图', '表格对比', '雷达对比', '条形对比'] },
  { key: 'relationship', name: '关系图', icon: '🔗', desc: '表达实体之间的连接与流向', subs: ['网络图', '桑基图', '和弦图', '力导向图', '拓扑关系', '实体关系'] },
];

// 每种图表类型的构图指令（写进提示词，显著提升结构正确率）
export const CHART_TYPE_GUIDES: Record<string, string> = {
  infographic: '顶部一条主标题带副标题，主体分 3–6 个模块化卡片区块，每个区块配一个简洁矢量图标 + 一句要点，重要数字放大加粗；整体像一张可直接投屏讲解的教学海报。',
  mechanism: '用「输入 → 处理 → 输出」的主干贯穿画面，关键环节用方框/圆角块表示，箭头标明方向与作用，必要时画出反馈回路；每个环节下方一行小字解释作用。',
  research: '自上而下呈现研究层级：研究目标 → 关键科学问题 → 技术路线/研究内容 → 预期成果，层与层之间用箭头串联，模块化分区、留白充足，符合基金申报书插图规范。',
  flowchart: '标准流程图符号：椭圆表示开始/结束，矩形表示处理，菱形表示判断（分支标注「是/否」），箭头单一方向不交叉，主流程走直线、分支向侧边展开。',
  architecture: '严格分层绘制（如展示层/服务层/数据层），同层模块等高对齐，层间用箭头或连接线表达调用关系，外部系统放在画面边缘并用虚线框区分。',
  datachart: '坐标轴、刻度、图例、数据标签齐全且数值与文本一致；配色区分各系列，网格线淡化，标题说明数据含义，不要编造未给出的数据。',
  mindmap: '中心主题放在画面正中并最醒目，一级分支向四周均匀发散并用不同颜色区分，二级分支用细线延伸，分支线条为平滑曲线，文字沿分支水平排列。',
  timeline: '一条清晰主轴贯穿画面，节点等间距分布并标注时间与事件名，节点上下交替放置说明卡片，起点与终点有明确标识。',
  comparison: '左右（或多列）对称构图，每列顶部为对象名称，下方逐行对齐比较维度，同一维度横向对齐，差异处用强调色标出，可加一行结论。',
  relationship: '节点大小体现重要度，连线粗细体现关系强度并标注关系名称，避免连线交叉与重叠，重要节点集中于画面中心区域。',
};

export interface PaletteDef {
  key: string;
  name: string;
  colors: string[];
}

export const AI_PALETTES: PaletteDef[] = [
  { key: 'blue', name: '科技蓝', colors: ['#4f6ef6', '#8aa2ff', '#e8edff', '#1e293b'] },
  { key: 'teal', name: '青绿', colors: ['#0ea5a4', '#5eead4', '#e6fffb', '#134e4a'] },
  { key: 'violet', name: '紫罗兰', colors: ['#7c3aed', '#c4b5fd', '#f3eaff', '#3b0764'] },
  { key: 'amber', name: '暖橙', colors: ['#f59e0b', '#fcd34d', '#fff7e6', '#78350f'] },
  { key: 'rose', name: '玫瑰红', colors: ['#e11d48', '#fda4af', '#fff1f3', '#4c0519'] },
  { key: 'slate', name: '商务灰', colors: ['#475569', '#94a3b8', '#f1f5f9', '#0f172a'] },
  { key: 'forest', name: '森林绿', colors: ['#15803d', '#86efac', '#ecfdf3', '#052e16'] },
  { key: 'ink', name: '水墨', colors: ['#1f2937', '#6b7280', '#f8fafc', '#020617'] },
];

export const AI_FONTS = [
  { key: 'sans', name: '思源黑体' },
  { key: 'serif', name: '思源宋体' },
  { key: 'yahei', name: '微软雅黑' },
  { key: 'kai', name: '楷体' },
];

export const AI_STYLES = [
  { key: 'professional', name: '专业商务' },
  { key: 'minimal', name: '简约现代' },
  { key: 'academic', name: '学术严谨' },
  { key: 'creative', name: '创意活泼' },
];

export const AI_STYLE_GUIDES: Record<string, string> = {
  professional: '干净的商务风格，规整网格排版，圆角卡片，轻微投影，克制的图标语言。',
  minimal: '极简现代风格，大量留白，细线条，弱化装饰，只保留信息本身。',
  academic: '学术严谨风格，结构对称、线条精确、标注规范，接近论文与教材插图。',
  creative: '活泼的教学风格，柔和圆润的形状与生动图标，颜色明快但不喧宾夺主。',
};

// 火山方舟 Seedream 支持的生图模型
export const AI_MODELS = [
  { key: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0（推荐）', maxTier: '4K' },
  { key: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0 文生图', maxTier: '2K' },
];

// 分辨率档位
export const AI_RESOLUTIONS = [
  { key: '1K', name: '1K 标准（快）' },
  { key: '2K', name: '2K 高清' },
  { key: '4K', name: '4K 超清（慢）' },
];

// 画面比例 → 各档位实际像素（符合方舟 Seedream 尺寸范围）
export interface RatioDef {
  key: string;
  name: string;
  dims: Record<string, string>;
}

export const AI_RATIOS: RatioDef[] = [
  { key: '1:1', name: '正方形 1:1', dims: { '1K': '1024x1024', '2K': '2048x2048', '4K': '4096x4096' } },
  { key: '4:3', name: '横版 4:3', dims: { '1K': '1152x864', '2K': '2304x1728', '4K': '4096x3072' } },
  { key: '3:4', name: '竖版 3:4', dims: { '1K': '864x1152', '2K': '1728x2304', '4K': '3072x4096' } },
  { key: '16:9', name: '宽屏 16:9', dims: { '1K': '1280x720', '2K': '2560x1440', '4K': '4096x2304' } },
  { key: '9:16', name: '竖屏 9:16', dims: { '1K': '720x1280', '2K': '1440x2560', '4K': '2304x4096' } },
  { key: '3:2', name: '横版 3:2', dims: { '1K': '1248x832', '2K': '2496x1664', '4K': '3936x2624' } },
  { key: '2:3', name: '竖版 2:3', dims: { '1K': '832x1248', '2K': '1664x2496', '4K': '2624x3936' } },
  { key: '21:9', name: '超宽 21:9', dims: { '1K': '1512x648', '2K': '3024x1296', '4K': '4096x1760' } },
];

export const AI_BACKGROUNDS = [
  { key: 'white', name: '纯白背景' },
  { key: 'light', name: '浅灰底' },
  { key: 'gradient', name: '淡渐变' },
  { key: 'dark', name: '深色底' },
  { key: 'transparent', name: '近似透明（白底）' },
];

export const AI_TEXT_DENSITY = [
  { key: 'low', name: '文字精简' },
  { key: 'medium', name: '文字适中' },
  { key: 'high', name: '文字详尽' },
];

export const AI_TEXT_DENSITY_GUIDES: Record<string, string> = {
  low: '每个模块只保留标题 + 不超过 8 个字的关键词，全图文字总量控制在 60 字以内。',
  medium: '每个模块标题 + 一句不超过 20 字的说明，全图文字总量控制在 150 字以内。',
  high: '每个模块可含标题与 2–3 条要点，但仍需保证字号可读、不拥挤。',
};

export const AI_LANGUAGES = [
  { key: 'zh', name: '中文标注' },
  { key: 'en', name: '英文标注' },
  { key: 'bilingual', name: '中英双语' },
];

// 一键场景预设：降低新用户的配置成本
export interface PresetDef {
  key: string;
  name: string;
  icon: string;
  patch: Partial<AIImageParams>;
}

export const AI_PRESETS: PresetDef[] = [
  { key: 'lesson', name: '课堂讲解图', icon: '🧑‍🏫', patch: { chartType: 'infographic', subStyle: '图文混排', style: 'creative', palette: 'blue', ratio: '16:9', background: 'white', textDensity: 'low', language: 'zh' } },
  { key: 'principle', name: '原理机制图', icon: '⚙️', patch: { chartType: 'mechanism', subStyle: '流程机制', style: 'academic', palette: 'teal', ratio: '4:3', background: 'white', textDensity: 'low', language: 'zh' } },
  { key: 'research', name: '课题技术路线', icon: '🔬', patch: { chartType: 'research', subStyle: '技术路线', style: 'academic', palette: 'slate', ratio: '4:3', background: 'light', textDensity: 'medium', language: 'zh' } },
  { key: 'summary', name: '知识总结导图', icon: '🧠', patch: { chartType: 'mindmap', subStyle: '辐射状', style: 'minimal', palette: 'violet', ratio: '16:9', background: 'white', textDensity: 'low', language: 'zh' } },
  { key: 'compare', name: '对比分析图', icon: '⚖️', patch: { chartType: 'comparison', subStyle: '并排对比', style: 'professional', palette: 'amber', ratio: '4:3', background: 'white', textDensity: 'medium', language: 'zh' } },
  { key: 'poster', name: '竖版展板', icon: '📌', patch: { chartType: 'infographic', subStyle: '数据总览', style: 'professional', palette: 'forest', ratio: '3:4', background: 'gradient', textDensity: 'medium', language: 'zh' } },
];

export function resolveSize(ratio: string, resolution: string): string {
  const r = AI_RATIOS.find(x => x.key === ratio) ?? AI_RATIOS[0];
  return r.dims[resolution] ?? r.dims['2K'];
}

export interface AIImageParams {
  chartType: string;
  subStyle: string;
  palette: string;
  font: string;
  style: string;
  model: string;
  ratio: string;
  resolution: string;
  background: string;
  textDensity: string;
  language: string;
  watermark: boolean;
  seed: number | null;
  negativePrompt: string;
  docText: string;
  title: string;
}

export const DEFAULT_AI_IMAGE_PARAMS: AIImageParams = {
  chartType: 'infographic',
  subStyle: '统计卡片',
  palette: 'blue',
  font: 'sans',
  style: 'professional',
  model: 'doubao-seedream-4-0-250828',
  ratio: '4:3',
  resolution: '2K',
  background: 'white',
  textDensity: 'low',
  language: 'zh',
  watermark: false,
  seed: null,
  negativePrompt: '',
  docText: '',
  title: '',
};

const BACKGROUND_GUIDES: Record<string, string> = {
  white: '纯白背景（#FFFFFF），无杂色与噪点',
  light: '浅灰底（#F5F7FA），元素与背景保持足够对比',
  gradient: '淡雅渐变背景，渐变幅度轻微、不干扰文字阅读',
  dark: '深色底，文字与图形使用高亮色确保对比度',
  transparent: '接近透明的纯白底，便于抠图与二次排版',
};

const LANGUAGE_GUIDES: Record<string, string> = {
  zh: '所有标注使用规范简体中文',
  en: '所有标注使用简洁英文',
  bilingual: '关键标注使用「中文（英文）」双语形式，中文为主、英文为辅',
};

// 默认负向词：Seedream 类模型最常见的翻车点
const BASE_NEGATIVE = '错别字、乱码文字、重复文字、无意义英文字符、文字被裁切、文字压图、水印、二维码、logo、真人照片、过度装饰、杂乱线条、模糊低清';

/** 从文档中提炼标题与要点，让模型更容易生成结构正确的图 */
export function extractOutline(docText: string): { title: string; points: string[] } {
  const lines = docText
    .split(/[\n\r]+/)
    .map(l => l.replace(/^[\s•\-*·\d.、）)]+/, '').trim())
    .filter(Boolean);
  const title = lines[0]?.slice(0, 40) ?? '';
  const rest = lines.slice(1);
  const source = rest.length >= 2
    ? rest
    : docText.split(/[。；;！!？?\n]/).map(s => s.trim()).filter(s => s.length > 3);
  return { title, points: source.slice(0, 8).map(p => p.slice(0, 60)) };
}

export function buildPrompt(p: AIImageParams): string {
  const type = CHART_TYPES.find(t => t.key === p.chartType);
  const palette = AI_PALETTES.find(c => c.key === p.palette);
  const font = AI_FONTS.find(f => f.key === p.font)?.name ?? '思源黑体';
  const style = AI_STYLES.find(s => s.key === p.style)?.name ?? '专业商务';
  const bg = BACKGROUND_GUIDES[p.background] ?? BACKGROUND_GUIDES.white;
  const density = AI_TEXT_DENSITY_GUIDES[p.textDensity] ?? AI_TEXT_DENSITY_GUIDES.low;
  const lang = LANGUAGE_GUIDES[p.language] ?? LANGUAGE_GUIDES.zh;
  const ratio = AI_RATIOS.find(r => r.key === p.ratio)?.key ?? '4:3';
  const typeGuide = CHART_TYPE_GUIDES[p.chartType] ?? '';
  const styleGuide = AI_STYLE_GUIDES[p.style] ?? '';

  const outline = extractOutline(p.docText);
  const title = (p.title || outline.title || type?.name || '信息图').slice(0, 40);

  const lines = [
    `任务：为教学与学术汇报绘制一张${type?.name ?? '信息图'}（二级形式：${p.subStyle}），画面比例 ${ratio}，一次成图、内容完整。`,
    `主标题：「${title}」，标题位于画面显著位置。`,
    `构图要求：${typeGuide}`,
    `视觉风格：${style}，${styleGuide}背景为${bg}。`,
    `配色：主色 ${palette?.colors[0]}，辅助色 ${palette?.colors[1]}，浅底色 ${palette?.colors[2]}，深色文字 ${palette?.colors[3]}；同类元素配色一致，强调色只用于重点。`,
    `文字：字形接近${font}，${lang}；${density}字号层级分明（标题 > 模块名 > 说明），文字完整不截断、不重叠、不出现错别字与乱码。`,
    '质量：矢量扁平化插画，线条干净，元素对齐到统一网格，四周留出安全边距，图形与标注一一对应，数据与文字必须与给定内容一致，不得编造数据。',
  ];

  if (outline.points.length) {
    lines.push('需要呈现的要点（逐条对应一个图形模块，不要遗漏、不要新增）：');
    outline.points.forEach((pt, i) => lines.push(`${i + 1}. ${pt}`));
  }

  const negative = [BASE_NEGATIVE, p.negativePrompt.trim().slice(0, 200)].filter(Boolean).join('、');
  lines.push(`画面中避免出现：${negative}。`);

  lines.push('原始内容参考：', p.docText.slice(0, 1200));
  return lines.join('\n');
}
