import { create } from 'zustand';

export type Ratio = '16:9' | '4:3';
export type Style =
  | 'icon'
  | 'minimalist'
  | 'corporate'
  | 'creative'
  | 'hand-drawn'
  | 'dark-neon'
  | 'editorial'
  | 'infographic';
export type PaletteId =
  | 'calm-blue'
  | 'energetic-orange'
  | 'tech-gray'
  | 'green-growth'
  | 'dark-navy'
  | 'warm-beige'
  | 'custom';
export type FontPairId =
  | 'noto-sc'
  | 'inter-source'
  | 'playfair-source'
  | 'space-grotesk-dm'
  | 'caveat-noto'
  | 'jb-mono';
export type TransitionId = 'none' | 'fade' | 'slide' | 'zoom';
export type ModelId = 'deepseek/deepseek-chat' | 'google/gemini-2.5-flash';
export type SlideType =
  | 'title'
  | 'toc'
  | 'content'
  | 'two-column'
  | 'image-text'
  | 'comparison'
  | 'quote'
  | 'timeline'
  | 'conclusion';

export interface CustomColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface CoursewareConfig {
  ratio: Ratio;
  style: Style;
  palette: PaletteId;
  customColors: CustomColors;
  fontPair: FontPairId;
  transition: TransitionId;
  showPageNumbers: boolean;
  pageNumberPosition: 'left' | 'center' | 'right';
  footer: string;
  iconDensity: 'low' | 'med' | 'high';
  model: ModelId;
}

export interface Slide {
  id: string;
  type: SlideType;
  title: string;
  bullets?: string[];
  leftTitle?: string;
  leftBullets?: string[];
  rightTitle?: string;
  rightBullets?: string[];
  quoteText?: string;
  quoteAuthor?: string;
  timelineItems?: { year: string; text: string }[];
  icon?: string;
  speakerNotes?: string;
}

export interface Outline {
  title: string;
  subtitle?: string;
  slides: Slide[];
}

export type Step = 1 | 2 | 3;

interface LoadingState {
  outline: boolean;
  html: boolean;
  export: 'pdf' | 'pptx' | null;
}

interface CoursewareState {
  step: Step;
  topic: string;
  audience: string;
  language: string;
  slideCountHint: number;
  config: CoursewareConfig;
  outline: Outline | null;
  html: string;
  loading: LoadingState;
  error?: string;
  setStep: (step: Step) => void;
  setTopic: (v: string) => void;
  setAudience: (v: string) => void;
  setLanguage: (v: string) => void;
  setSlideCountHint: (v: number) => void;
  patchConfig: (patch: Partial<CoursewareConfig>) => void;
  patchCustomColors: (patch: Partial<CustomColors>) => void;
  setOutline: (o: Outline | null) => void;
  setHtml: (s: string) => void;
  setLoading: (patch: Partial<LoadingState>) => void;
  setError: (msg?: string) => void;
  reset: () => void;
}

const defaultConfig: CoursewareConfig = {
  ratio: '16:9',
  style: 'icon',
  palette: 'calm-blue',
  customColors: { primary: '#2563eb', secondary: '#64748b', accent: '#06b6d4' },
  fontPair: 'noto-sc',
  transition: 'fade',
  showPageNumbers: true,
  pageNumberPosition: 'right',
  footer: '',
  iconDensity: 'med',
  model: 'deepseek/deepseek-chat',
};

export const useCoursewareStore = create<CoursewareState>((set) => ({
  step: 1,
  topic: '',
  audience: '',
  language: 'zh-CN',
  slideCountHint: 10,
  config: defaultConfig,
  outline: null,
  html: '',
  loading: { outline: false, html: false, export: null },
  error: undefined,
  setStep: (step) => set({ step }),
  setTopic: (topic) => set({ topic }),
  setAudience: (audience) => set({ audience }),
  setLanguage: (language) => set({ language }),
  setSlideCountHint: (slideCountHint) => set({ slideCountHint }),
  patchConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  patchCustomColors: (patch) =>
    set((s) => ({ config: { ...s.config, customColors: { ...s.config.customColors, ...patch } } })),
  setOutline: (outline) => set({ outline }),
  setHtml: (html) => set({ html }),
  setLoading: (patch) => set((s) => ({ loading: { ...s.loading, ...patch } })),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      step: 1,
      topic: '',
      audience: '',
      slideCountHint: 10,
      config: defaultConfig,
      outline: null,
      html: '',
      loading: { outline: false, html: false, export: null },
      error: undefined,
    }),
}));
