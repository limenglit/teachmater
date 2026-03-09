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

export type StructureType = 'flow' | 'comparison' | 'pyramid' | 'funnel' | 'timeline' | 'quadrant' | 'list' | 'hierarchy' | 'cycle';
export type ChartType = 'bar' | 'line' | 'pie' | 'radar' | 'scatter' | 'none';
export type TemplateStyle = 'modern' | 'classic' | 'playful' | 'dark';

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
