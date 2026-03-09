// PPT generation types and presets

export type PPTSlideType = 'title' | 'toc' | 'content' | 'section' | 'conclusion' | 'two-column' | 'image-text' | 'comparison' | 'quote' | 'timeline';

export interface PPTSlide {
  type: PPTSlideType;
  title: string;
  bullets?: string[];
  subtitle?: string;
  leftBullets?: string[];
  rightBullets?: string[];
  leftTitle?: string;
  rightTitle?: string;
  quoteText?: string;
  quoteAuthor?: string;
  imagePlaceholder?: string;
  imageUrl?: string;
  timelineItems?: { year: string; text: string }[];
}

export interface PPTOutline {
  title: string;
  keywords: string[];
  slides: PPTSlide[];
  audience: 'report' | 'teaching' | 'marketing';
}

export interface PPTTemplate {
  id: string;
  nameKey: string;
  description: string;
}

export interface PPTStyle {
  id: string;
  nameKey: string;
  description: string;
}

export interface PPTLayout {
  id: PPTSlideType;
  nameKey: string;
  icon: string;
  description: string;
}

export interface PPTColorScheme {
  id: string;
  nameKey: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface PPTProject {
  id: string;
  title: string;
  outline: PPTOutline;
  template: string;
  style: string;
  colorScheme: string;
  fontFamily: string;
  fontSize: string;
  createdAt: string;
}

// Font presets
export interface PPTFont {
  id: string;
  nameKey: string;
  fontFace: string;
  sample: string;
}

export interface PPTFontSize {
  id: string;
  nameKey: string;
  titleSize: number;
  bodySize: number;
  captionSize: number;
}

export const PPT_FONTS: PPTFont[] = [
  { id: 'yahei', nameKey: 'ppt.font.yahei', fontFace: 'Microsoft YaHei', sample: '微软雅黑' },
  { id: 'songti', nameKey: 'ppt.font.songti', fontFace: 'SimSun', sample: '宋体正文' },
  { id: 'kaiti', nameKey: 'ppt.font.kaiti', fontFace: 'KaiTi', sample: '楷体优雅' },
  { id: 'heiti', nameKey: 'ppt.font.heiti', fontFace: 'SimHei', sample: '黑体醒目' },
  { id: 'arial', nameKey: 'ppt.font.arial', fontFace: 'Arial', sample: 'Arial Clean' },
  { id: 'georgia', nameKey: 'ppt.font.georgia', fontFace: 'Georgia', sample: 'Georgia Serif' },
];

export const PPT_FONT_SIZES: PPTFontSize[] = [
  { id: 'compact', nameKey: 'ppt.fontSize.compact', titleSize: 28, bodySize: 14, captionSize: 10 },
  { id: 'standard', nameKey: 'ppt.fontSize.standard', titleSize: 32, bodySize: 16, captionSize: 12 },
  { id: 'large', nameKey: 'ppt.fontSize.large', titleSize: 40, bodySize: 20, captionSize: 14 },
  { id: 'xl', nameKey: 'ppt.fontSize.xl', titleSize: 48, bodySize: 24, captionSize: 16 },
];

// Presets
export const PPT_TEMPLATES: PPTTemplate[] = [
  { id: 'business', nameKey: 'ppt.template.business', description: '商务汇报' },
  { id: 'education', nameKey: 'ppt.template.education', description: '教学演示' },
  { id: 'academic', nameKey: 'ppt.template.academic', description: '学术报告' },
  { id: 'creative', nameKey: 'ppt.template.creative', description: '创意展示' },
];

export const PPT_STYLES: PPTStyle[] = [
  { id: 'minimal', nameKey: 'ppt.style.minimal', description: '简洁留白' },
  { id: 'professional', nameKey: 'ppt.style.professional', description: '专业严谨' },
  { id: 'storytelling', nameKey: 'ppt.style.storytelling', description: '故事化叙述' },
];

export const PPT_LAYOUTS: PPTLayout[] = [
  { id: 'content', nameKey: 'ppt.layout.content', icon: '📝', description: '标准内容页' },
  { id: 'two-column', nameKey: 'ppt.layout.twoColumn', icon: '▥', description: '左右双栏' },
  { id: 'image-text', nameKey: 'ppt.layout.imageText', icon: '🖼️', description: '图文混排' },
  { id: 'comparison', nameKey: 'ppt.layout.comparison', icon: '⚖️', description: '对比分析' },
  { id: 'quote', nameKey: 'ppt.layout.quote', icon: '💬', description: '引用名言' },
  { id: 'timeline', nameKey: 'ppt.layout.timeline', icon: '📅', description: '时间线' },
];

export const PPT_COLOR_SCHEMES: PPTColorScheme[] = [
  { id: 'calm-blue', nameKey: 'ppt.color.calmBlue', primary: '#2563EB', secondary: '#3B82F6', accent: '#60A5FA', background: '#F8FAFC', text: '#1E293B' },
  { id: 'vibrant-orange', nameKey: 'ppt.color.vibrantOrange', primary: '#EA580C', secondary: '#F97316', accent: '#FB923C', background: '#FFFBEB', text: '#1C1917' },
  { id: 'tech-gray', nameKey: 'ppt.color.techGray', primary: '#475569', secondary: '#64748B', accent: '#94A3B8', background: '#F1F5F9', text: '#0F172A' },
  { id: 'forest-green', nameKey: 'ppt.color.forestGreen', primary: '#059669', secondary: '#10B981', accent: '#34D399', background: '#F0FDF4', text: '#14532D' },
  { id: 'royal-purple', nameKey: 'ppt.color.royalPurple', primary: '#7C3AED', secondary: '#8B5CF6', accent: '#A78BFA', background: '#FAF5FF', text: '#3B0764' },
  { id: 'rose-red', nameKey: 'ppt.color.roseRed', primary: '#E11D48', secondary: '#F43F5E', accent: '#FB7185', background: '#FFF1F2', text: '#4C0519' },
];

export const PPT_AUDIENCES = [
  { id: 'report', nameKey: 'ppt.audience.report' },
  { id: 'teaching', nameKey: 'ppt.audience.teaching' },
  { id: 'marketing', nameKey: 'ppt.audience.marketing' },
] as const;
