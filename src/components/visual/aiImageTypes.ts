// AI 生图（火山引擎豆包）配置：10 种图表类型 + 二级风格 + 配色/字体/风格
export interface ChartTypeDef {
  key: string;
  name: string;
  icon: string;
  subs: string[];
}

export const CHART_TYPES: ChartTypeDef[] = [
  { key: 'infographic', name: '信息图', icon: '📊', subs: ['统计卡片', '数据总览', '要点列表', '图文混排', '时间轴信息图', '对比信息图'] },
  { key: 'mechanism', name: '机制图', icon: '⚙️', subs: ['流程机制', '因果链', '反馈回路', '循环机制', '层次结构', '网络机制'] },
  { key: 'research', name: '科研申报图', icon: '🔬', subs: ['技术路线', '研究框架', '实验设计', '甘特图', '鱼骨图', '概念框架'] },
  { key: 'flowchart', name: '流程图', icon: '🔀', subs: ['基本流程', '泳道图', '跨职能流程', '决策树', '工作流', '数据流'] },
  { key: 'architecture', name: '架构图', icon: '🏗️', subs: ['系统架构', '云架构', '微服务', '数据架构', '网络拓扑', '分层架构'] },
  { key: 'datachart', name: '数据图表', icon: '📈', subs: ['柱状图', '折线图', '饼图', '雷达图', '散点图', '面积图', '环形图', '热力图'] },
  { key: 'mindmap', name: '思维导图', icon: '🧠', subs: ['辐射状', '树状图', '逻辑图', '概念图', '气泡图', '组织结构'] },
  { key: 'timeline', name: '时间轴', icon: '⏳', subs: ['水平时间轴', '垂直时间轴', '环形时间轴', '里程碑', '甘特图', '项目路线'] },
  { key: 'comparison', name: '对比图', icon: '⚖️', subs: ['并排对比', '矩阵对比', '韦恩图', '表格对比', '雷达对比', '条形对比'] },
  { key: 'relationship', name: '关系图', icon: '🔗', subs: ['网络图', '桑基图', '和弦图', '力导向图', '拓扑关系', '实体关系'] },
];

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

export const AI_LANGUAGES = [
  { key: 'zh', name: '中文标注' },
  { key: 'en', name: '英文标注' },
  { key: 'bilingual', name: '中英双语' },
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
};

export function buildPrompt(p: AIImageParams): string {
  const type = CHART_TYPES.find(t => t.key === p.chartType);
  const palette = AI_PALETTES.find(c => c.key === p.palette);
  const font = AI_FONTS.find(f => f.key === p.font)?.name ?? '思源黑体';
  const style = AI_STYLES.find(s => s.key === p.style)?.name ?? '专业商务';
  const bg = AI_BACKGROUNDS.find(b => b.key === p.background)?.name ?? '纯白背景';
  const density = AI_TEXT_DENSITY.find(d => d.key === p.textDensity)?.name ?? '文字精简';
  const lang = AI_LANGUAGES.find(l => l.key === p.language)?.name ?? '中文标注';
  const ratio = AI_RATIOS.find(r => r.key === p.ratio)?.key ?? '4:3';

  const lines = [
    `请生成一张高质量的${type?.name ?? '信息图'}，二级风格为「${p.subStyle}」，画面比例 ${ratio}。`,
    `整体设计风格：${style}；${bg}；${lang}；${density}。`,
    `字体风格接近${font}，文字排版清晰、字形完整、无错别字、无乱码、不截断。`,
    `配色方案：主色 ${palette?.colors[0]}，辅助色 ${palette?.colors[1]}，浅底色 ${palette?.colors[2]}，深色文字 ${palette?.colors[3]}。`,
    '要求：矢量扁平化设计，层级分明，图形与标注一一对应，数据与文字准确，适合课堂教学与学术汇报展示，不要出现水印或无意义装饰文字。',
  ];

  if (p.negativePrompt.trim()) {
    lines.push(`避免出现：${p.negativePrompt.trim().slice(0, 200)}。`);
  }

  lines.push('内容如下：', p.docText.slice(0, 1200));
  return lines.join('\n');
}

