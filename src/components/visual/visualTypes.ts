export interface StructureNode {
  label: string;
  description?: string;
  value?: number;
}

export interface DataPoint {
  label: string;
  value: number;
  unit?: string;
}

export interface Relationship {
  from: string;
  to: string;
  label?: string;
}

export interface Category {
  name: string;
  items: string[];
}

export type StructureType = 'flow' | 'comparison' | 'pyramid' | 'funnel' | 'timeline' | 'quadrant' | 'list' | 'hierarchy' | 'cycle' | 'mindmap' | 'matrix' | 'radial' | 'swot';
export type ChartType = 'bar' | 'line' | 'pie' | 'radar' | 'scatter' | 'area' | 'donut' | 'treemap' | 'none';
export type TemplateStyle = 'modern' | 'classic' | 'playful' | 'dark' | 'magazine' | 'tech' | 'elegant' | 'bold';

export type FontFamily = 'sans' | 'serif' | 'mono' | 'rounded' | 'narrow';
export type LayoutDensity = 'compact' | 'normal' | 'spacious';

export interface VisualSettings {
  fontFamily: FontFamily;
  fontSize: number; // 12-24
  layoutDensity: LayoutDensity;
}

export const FONT_FAMILIES: { id: FontFamily; name: string; css: string }[] = [
  { id: 'sans', name: '无衬线', css: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif' },
  { id: 'rounded', name: '圆体', css: '"Noto Sans SC", "PingFang SC", ui-rounded, sans-serif' },
  { id: 'narrow', name: '窄体', css: '"Arial Narrow", "Noto Sans SC", sans-serif' },
  { id: 'serif', name: '衬线', css: 'Georgia, "Noto Serif SC", "SimSun", serif' },
  { id: 'mono', name: '等宽', css: '"JetBrains Mono", "Fira Code", "Noto Sans SC", monospace' },
];

export interface AnalysisResult {
  title: string;
  summary: string;
  keywords: string[];
  structure_type: StructureType;
  structure_nodes: StructureNode[];
  data_points: DataPoint[];
  suggested_chart: ChartType;
  relationships?: Relationship[];
  categories?: Category[];
}

export interface ColorScheme {
  id: string;
  name: string;
  colors: string[];
  bg: string;
  text: string;
}

export const COLOR_SCHEMES: ColorScheme[] = [
  { id: 'ocean', name: '海洋蓝', colors: ['#0ea5e9', '#06b6d4', '#0891b2', '#0284c7', '#0369a1'], bg: '#f0f9ff', text: '#0c4a6e' },
  { id: 'sunset', name: '日落橙', colors: ['#f97316', '#fb923c', '#f59e0b', '#ef4444', '#ec4899'], bg: '#fff7ed', text: '#7c2d12' },
  { id: 'forest', name: '森林绿', colors: ['#22c55e', '#16a34a', '#15803d', '#84cc16', '#059669'], bg: '#f0fdf4', text: '#14532d' },
  { id: 'lavender', name: '薰衣紫', colors: ['#8b5cf6', '#a78bfa', '#7c3aed', '#6366f1', '#ec4899'], bg: '#faf5ff', text: '#3b0764' },
  { id: 'coral', name: '珊瑚红', colors: ['#f43f5e', '#fb7185', '#e11d48', '#f97316', '#f59e0b'], bg: '#fff1f2', text: '#881337' },
  { id: 'earth', name: '大地棕', colors: ['#92400e', '#b45309', '#a16207', '#854d0e', '#78716c'], bg: '#fefce8', text: '#422006' },
  { id: 'neon', name: '霓虹灯', colors: ['#06b6d4', '#8b5cf6', '#ec4899', '#22c55e', '#f97316'], bg: '#18181b', text: '#fafafa' },
  { id: 'pastel', name: '马卡龙', colors: ['#93c5fd', '#c4b5fd', '#fda4af', '#86efac', '#fde68a'], bg: '#fefefe', text: '#374151' },
  // New schemes
  { id: 'midnight', name: '午夜蓝', colors: ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'], bg: '#0f172a', text: '#e2e8f0' },
  { id: 'cherry', name: '樱花粉', colors: ['#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8', '#a855f7'], bg: '#fdf2f8', text: '#831843' },
  { id: 'mint', name: '薄荷绿', colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669'], bg: '#ecfdf5', text: '#064e3b' },
  { id: 'amber', name: '琥珀金', colors: ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#b45309'], bg: '#fffbeb', text: '#78350f' },
  { id: 'slate', name: '石板灰', colors: ['#475569', '#64748b', '#94a3b8', '#334155', '#1e293b'], bg: '#f8fafc', text: '#1e293b' },
  { id: 'tropical', name: '热带风', colors: ['#f97316', '#06b6d4', '#eab308', '#22c55e', '#ec4899'], bg: '#fefce8', text: '#1c1917' },
  { id: 'aurora', name: '极光紫', colors: ['#7c3aed', '#2563eb', '#06b6d4', '#10b981', '#8b5cf6'], bg: '#0f172a', text: '#e0e7ff' },
  { id: 'rose', name: '玫瑰红', colors: ['#be123c', '#e11d48', '#f43f5e', '#fb7185', '#fda4af'], bg: '#fff1f2', text: '#4c0519' },
];

export interface VisualHistoryItem {
  id: string;
  title: string;
  timestamp: number;
  analysis: AnalysisResult;
  inputText: string;
  colorScheme: string;
  template: TemplateStyle;
}
