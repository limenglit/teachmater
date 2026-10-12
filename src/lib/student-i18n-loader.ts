import type { LangCode } from '@/contexts/language-core';
import zh from './student-i18n/zh';

/** 学生扫码页按需语种：中文随包内置，其余语种只下载命中的那一个小文件并缓存到本机。 */
const SUPPORTED: LangCode[] = ['zh', 'en', 'ru', 'ja', 'ko', 'es'];
const CACHE = 'tm-lang-dict-v1';

export function detectStudentLang(): LangCode {
  try {
    const q = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('app-lang');
    if (q && SUPPORTED.indexOf(q as LangCode) >= 0) return q as LangCode;
    const nav = ((navigator.languages && navigator.languages[0]) || navigator.language || 'zh').toLowerCase().slice(0, 2);
    if (SUPPORTED.indexOf(nav as LangCode) >= 0) return nav as LangCode;
  } catch { /* ignore */ }
  return 'zh';
}

export const ZH_DICT = zh;

export function cachedDict(lang: LangCode): Record<string, string> | null {
  if (lang === 'zh') return zh;
  try {
    const raw = localStorage.getItem(`${CACHE}:${lang}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const loaders: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import('./student-i18n/en'),
  ru: () => import('./student-i18n/ru'),
  ja: () => import('./student-i18n/ja'),
  ko: () => import('./student-i18n/ko'),
  es: () => import('./student-i18n/es'),
};

export async function loadDict(lang: LangCode): Promise<Record<string, string>> {
  if (lang === 'zh' || !loaders[lang]) return zh;
  const d = (await loaders[lang]()).default;
  try { localStorage.setItem(`${CACHE}:${lang}`, JSON.stringify(d)); } catch { /* ignore */ }
  return d;
}
