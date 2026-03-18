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
export type NodeShape = 'rounded' | 'pill' | 'square' | 'diamond' | 'circle' | 'hexagon';
export type IconStyle = 'none' | 'emoji' | 'number' | 'letter' | 'bullet';
export type ConnectorStyle = 'arrow' | 'line' | 'dashed' | 'dotted' | 'none';
export type GradientMode = 'none' | 'linear' | 'radial';
export type ShadowStyle = 'none' | 'subtle' | 'medium' | 'dramatic';
export type BackgroundPattern = 'none' | 'dots' | 'grid' | 'diagonal' | 'waves';
export type BorderStyle = 'none' | 'solid' | 'dashed' | 'double';
export type AspectRatio = 'auto' | '1:1' | '4:3' | '16:9' | '9:16';

export interface VisualSettings {
  fontFamily: FontFamily;
  fontSize: number; // 12-24
  layoutDensity: LayoutDensity;
  nodeShape: NodeShape;
  iconStyle: IconStyle;
  connectorStyle: ConnectorStyle;
  gradientMode: GradientMode;
  shadowStyle: ShadowStyle;
  backgroundPattern: BackgroundPattern;
  borderStyle: BorderStyle;
  aspectRatio: AspectRatio;
  showDescription: boolean;
  showValues: boolean;
}

export const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  fontFamily: 'sans',
  fontSize: 14,
  layoutDensity: 'normal',
  nodeShape: 'rounded',
  iconStyle: 'number',
  connectorStyle: 'arrow',
  gradientMode: 'none',
  shadowStyle: 'subtle',
  backgroundPattern: 'none',
  borderStyle: 'none',
  aspectRatio: 'auto',
  showDescription: true,
  showValues: true,
};

export const FONT_FAMILIES: { id: FontFamily; name: string; css: string }[] = [
  { id: 'sans', name: '无衬线', css: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif' },
  { id: 'rounded', name: '圆体', css: '"Noto Sans SC", "PingFang SC", ui-rounded, sans-serif' },
  { id: 'narrow', name: '窄体', css: '"Arial Narrow", "Noto Sans SC", sans-serif' },
  { id: 'serif', name: '衬线', css: 'Georgia, "Noto Serif SC", "SimSun", serif' },
  { id: 'mono', name: '等宽', css: '"JetBrains Mono", "Fira Code", "Noto Sans SC", monospace' },
];

export const NODE_SHAPES: { id: NodeShape; name: string; emoji: string }[] = [
  { id: 'rounded', name: '圆角', emoji: '▢' },
  { id: 'pill', name: '胶囊', emoji: '💊' },
  { id: 'square', name: '方形', emoji: '■' },
  { id: 'circle', name: '圆形', emoji: '●' },
  { id: 'diamond', name: '菱形', emoji: '◆' },
  { id: 'hexagon', name: '六边形', emoji: '⬡' },
];

export const ICON_STYLES: { id: IconStyle; name: string; example: string }[] = [
  { id: 'none', name: '无', example: '' },
  { id: 'emoji', name: '表情', example: '🔹' },
  { id: 'number', name: '数字', example: '①' },
  { id: 'letter', name: '字母', example: 'A' },
  { id: 'bullet', name: '圆点', example: '●' },
];

export const CONNECTOR_STYLES: { id: ConnectorStyle; name: string }[] = [
  { id: 'arrow', name: '箭头 →' },
  { id: 'line', name: '直线 —' },
  { id: 'dashed', name: '虚线 - -' },
  { id: 'dotted', name: '点线 · ·' },
  { id: 'none', name: '无' },
];

export const GRADIENT_MODES: { id: GradientMode; name: string }[] = [
  { id: 'none', name: '纯色' },
  { id: 'linear', name: '线性渐变' },
  { id: 'radial', name: '径向渐变' },
];

export const SHADOW_STYLES: { id: ShadowStyle; name: string }[] = [
  { id: 'none', name: '无' },
  { id: 'subtle', name: '轻微' },
  { id: 'medium', name: '中等' },
  { id: 'dramatic', name: '醒目' },
];

export const BG_PATTERNS: { id: BackgroundPattern; name: string; emoji: string }[] = [
  { id: 'none', name: '无', emoji: '⬜' },
  { id: 'dots', name: '点阵', emoji: '⠿' },
  { id: 'grid', name: '网格', emoji: '▦' },
  { id: 'diagonal', name: '斜线', emoji: '╱' },
  { id: 'waves', name: '波浪', emoji: '〰️' },
];

export const BORDER_STYLES: { id: BorderStyle; name: string }[] = [
  { id: 'none', name: '无' },
  { id: 'solid', name: '实线' },
  { id: 'dashed', name: '虚线' },
  { id: 'double', name: '双线' },
];

export const ASPECT_RATIOS: { id: AspectRatio; name: string }[] = [
  { id: 'auto', name: '自适应' },
  { id: '1:1', name: '1:1' },
  { id: '4:3', name: '4:3' },
  { id: '16:9', name: '16:9' },
  { id: '9:16', name: '9:16' },
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

// Utility: get icon for a node
export function getNodeIcon(style: IconStyle, index: number): string {
  switch (style) {
    case 'emoji': return ['🔹', '🔸', '💠', '🔶', '🔷', '✦', '◈', '⬥'][index % 8];
    case 'number': return ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'][index % 10];
    case 'letter': return String.fromCharCode(65 + (index % 26));
    case 'bullet': return ['●', '◉', '◎', '○', '◆', '◇'][index % 6];
    default: return '';
  }
}

// Utility: get CSS for node shape
export function getNodeShapeStyle(shape: NodeShape): React.CSSProperties {
  switch (shape) {
    case 'pill': return { borderRadius: '9999px' };
    case 'square': return { borderRadius: '2px' };
    case 'circle': return { borderRadius: '50%' };
    case 'diamond': return { borderRadius: '4px', transform: 'rotate(45deg)' };
    case 'hexagon': return { borderRadius: '8px', clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' };
    case 'rounded':
    default: return { borderRadius: '12px' };
  }
}

// Utility: get shadow CSS
export function getShadowCSS(shadow: ShadowStyle): string {
  switch (shadow) {
    case 'subtle': return '0 1px 3px rgba(0,0,0,0.1)';
    case 'medium': return '0 4px 12px rgba(0,0,0,0.15)';
    case 'dramatic': return '0 8px 30px rgba(0,0,0,0.25)';
    default: return 'none';
  }
}

// Utility: get gradient background
export function getGradientBg(mode: GradientMode, color: string, secondColor?: string): string {
  const c2 = secondColor || adjustBrightness(color, 30);
  switch (mode) {
    case 'linear': return `linear-gradient(135deg, ${color}, ${c2})`;
    case 'radial': return `radial-gradient(circle, ${color}, ${c2})`;
    default: return color;
  }
}

// Utility: get border CSS
export function getBorderCSS(style: BorderStyle, color: string): string {
  switch (style) {
    case 'solid': return `2px solid ${color}`;
    case 'dashed': return `2px dashed ${color}`;
    case 'double': return `4px double ${color}`;
    default: return 'none';
  }
}

// Utility: get connector symbol
export function getConnectorSymbol(style: ConnectorStyle): string {
  switch (style) {
    case 'arrow': return '→';
    case 'line': return '—';
    case 'dashed': return '- -';
    case 'dotted': return '· · ·';
    default: return '';
  }
}

// Utility: SVG background pattern
export function getPatternSVG(pattern: BackgroundPattern, color: string): string {
  const c = encodeURIComponent(color + '15');
  switch (pattern) {
    case 'dots':
      return `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='${c}'/%3E%3C/svg%3E")`;
    case 'grid':
      return `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0H0v20' fill='none' stroke='${c}' stroke-width='0.5'/%3E%3C/svg%3E")`;
    case 'diagonal':
      return `url("data:image/svg+xml,%3Csvg width='10' height='10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10L10 0' fill='none' stroke='${c}' stroke-width='0.5'/%3E%3C/svg%3E")`;
    case 'waves':
      return `url("data:image/svg+xml,%3Csvg width='40' height='12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 6C5 0 10 0 20 6S35 12 40 6' fill='none' stroke='${c}' stroke-width='0.5'/%3E%3C/svg%3E")`;
    default: return 'none';
  }
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

// Utility: aspect ratio to CSS
export function getAspectRatioStyle(ratio: AspectRatio): React.CSSProperties {
  switch (ratio) {
    case '1:1': return { aspectRatio: '1/1' };
    case '4:3': return { aspectRatio: '4/3' };
    case '16:9': return { aspectRatio: '16/9' };
    case '9:16': return { aspectRatio: '9/16', maxWidth: '400px', margin: '0 auto' };
    default: return {};
  }
}
