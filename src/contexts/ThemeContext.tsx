import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ThemeConfig {
  schemeId: string;
  fontFamily: string;
  fontSize: number; // scale: 0.9 ~ 2.0
}

export interface ColorScheme {
  id: string;
  name: string;
  description: string;
  preview: string[]; // 3 preview colors
  vars: Record<string, string>;
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'fresh',
    name: '清新',
    description: '清爽明亮，适合日常教学',
    preview: ['hsl(210, 45%, 55%)', 'hsl(210, 30%, 92%)', 'hsl(210, 15%, 98%)'],
    vars: {
      '--primary': '210 45% 55%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '210 30% 92%',
      '--accent-foreground': '210 45% 40%',
      '--highlight': '210 45% 55%',
      '--highlight-soft': '210 40% 95%',
      '--surface': '210 15% 98%',
      '--border': '210 18% 90%',
      '--ring': '210 45% 55%',
      '--logo-hue-rotate': '100deg',
    },
  },
  {
    id: 'calm',
    name: '沉稳',
    description: '低调沉静，专注严谨',
    preview: ['hsl(220, 30%, 35%)', 'hsl(220, 15%, 90%)', 'hsl(220, 10%, 97%)'],
    vars: {
      '--primary': '220 30% 35%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '220 15% 90%',
      '--accent-foreground': '220 30% 30%',
      '--highlight': '220 30% 35%',
      '--highlight-soft': '220 20% 94%',
      '--surface': '220 10% 97%',
      '--border': '220 12% 88%',
      '--ring': '220 30% 35%',
      '--logo-hue-rotate': '110deg',
    },
  },
  {
    id: 'warm',
    name: '暖阳',
    description: '温暖柔和，活力亲切',
    preview: ['hsl(25, 65%, 52%)', 'hsl(30, 40%, 92%)', 'hsl(35, 25%, 97%)'],
    vars: {
      '--primary': '25 65% 52%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '30 40% 92%',
      '--accent-foreground': '25 55% 38%',
      '--highlight': '25 65% 52%',
      '--highlight-soft': '30 45% 95%',
      '--surface': '35 25% 97%',
      '--border': '30 20% 88%',
      '--ring': '25 65% 52%',
      '--logo-hue-rotate': '275deg',
    },
  },
  {
    id: 'forest',
    name: '森林',
    description: '自然清幽，沉浸宁静',
    preview: ['hsl(155, 35%, 42%)', 'hsl(150, 20%, 91%)', 'hsl(145, 15%, 97%)'],
    vars: {
      '--primary': '155 35% 42%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '150 20% 91%',
      '--accent-foreground': '155 30% 32%',
      '--highlight': '155 35% 42%',
      '--highlight-soft': '150 25% 94%',
      '--surface': '145 15% 97%',
      '--border': '150 15% 88%',
      '--ring': '155 35% 42%',
      '--logo-hue-rotate': '45deg',
    },
  },
  {
    id: 'lavender',
    name: '薰衣草',
    description: '优雅柔美，浪漫轻盈',
    preview: ['hsl(270, 40%, 55%)', 'hsl(265, 25%, 92%)', 'hsl(260, 15%, 97%)'],
    vars: {
      '--primary': '270 40% 55%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '265 25% 92%',
      '--accent-foreground': '270 35% 40%',
      '--highlight': '270 40% 55%',
      '--highlight-soft': '265 30% 95%',
      '--surface': '260 15% 97%',
      '--border': '265 15% 88%',
      '--ring': '270 40% 55%',
      '--logo-hue-rotate': '160deg',
    },
  },
  {
    id: 'rose',
    name: '玫瑰',
    description: '粉嫩温柔，充满活力',
    preview: ['hsl(345, 50%, 55%)', 'hsl(340, 30%, 93%)', 'hsl(335, 20%, 97%)'],
    vars: {
      '--primary': '345 50% 55%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '340 30% 93%',
      '--accent-foreground': '345 45% 40%',
      '--highlight': '345 50% 55%',
      '--highlight-soft': '340 35% 95%',
      '--surface': '335 20% 97%',
      '--border': '340 18% 89%',
      '--ring': '345 50% 55%',
      '--logo-hue-rotate': '235deg',
    },
  },
];

export const FONT_OPTIONS = [
  { id: 'noto', name: 'Noto Sans SC', value: '"Noto Sans SC", system-ui, sans-serif' },
  { id: 'system', name: '系统默认', value: 'system-ui, -apple-system, sans-serif' },
  { id: 'serif', name: '宋体 (衬线)', value: '"Noto Serif SC", "SimSun", serif' },
];

export const FONT_SIZE_MIN = 0.9;
export const FONT_SIZE_MAX = 2.0;
export const FONT_SIZE_DEFAULT = 1.0;

const STORAGE_KEY = 'teachmate_theme';

const defaultConfig: ThemeConfig = { schemeId: 'fresh', fontFamily: 'noto', fontSize: FONT_SIZE_DEFAULT };

function loadConfig(): ThemeConfig {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    if (!d) return defaultConfig;
    const parsed = { ...defaultConfig, ...JSON.parse(d) };
    // Migrate old enum fontSize to numeric
    if (typeof parsed.fontSize === 'string') {
      parsed.fontSize = parsed.fontSize === 'small' ? 0.9 : parsed.fontSize === 'large' ? 1.15 : 1.0;
    }
    return parsed;
  } catch { return defaultConfig; }
}

interface ThemeContextType {
  config: ThemeConfig;
  setScheme: (id: string) => void;
  setFont: (id: string) => void;
  setFontSize: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ThemeConfig>(loadConfig);

  // Apply theme
  useEffect(() => {
    const scheme = COLOR_SCHEMES.find(s => s.id === config.schemeId) || COLOR_SCHEMES[0];
    const root = document.documentElement;

    // Apply color vars
    Object.entries(scheme.vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });

    // Apply font
    const font = FONT_OPTIONS.find(f => f.id === config.fontFamily) || FONT_OPTIONS[0];
    root.style.setProperty('--font-family', font.value);
    document.body.style.fontFamily = font.value;

    // Apply font size (numeric scale)
    const scale = typeof config.fontSize === 'number' ? config.fontSize : 1.0;
    root.style.fontSize = `${scale * 16}px`;

    // Persist
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const setScheme = (id: string) => setConfig(prev => ({ ...prev, schemeId: id }));
  const setFont = (id: string) => setConfig(prev => ({ ...prev, fontFamily: id }));
  const setFontSize = (scale: number) => setConfig(prev => ({ ...prev, fontSize: Math.round(scale * 100) / 100 }));

  return (
    <ThemeContext.Provider value={{ config, setScheme, setFont, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
