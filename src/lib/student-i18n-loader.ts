import type { LangCode } from '@/contexts/language-core';

/**
 * 学生扫码页按需语种：按「页面 × 语言」只下载命中的一个小词典文件（1–3KB），
 * 下载后缓存到本机，下次扫码直接使用。
 */
const SUPPORTED: LangCode[] = ['zh', 'en', 'ru', 'ja', 'ko', 'es'];
const CACHE = 'tm-lang-dict-v2';
export type DictGroup = 'checkin' | 'seat' | 'seatResult';
type Dict = Record<string, string>;

export function detectStudentLang(): LangCode {
  try {
    const q = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('app-lang');
    if (q && SUPPORTED.indexOf(q as LangCode) >= 0) return q as LangCode;
    // 微信内置浏览器把界面语言写在 UA 的 Language/xx_XX 里，比系统语言更准确。
    const wx = /Language\/([a-zA-Z]{2})/.exec(navigator.userAgent || '');
    if (wx && SUPPORTED.indexOf(wx[1].toLowerCase() as LangCode) >= 0) return wx[1].toLowerCase() as LangCode;
    const nav = ((navigator.languages && navigator.languages[0]) || navigator.language || 'zh').toLowerCase().slice(0, 2);
    if (SUPPORTED.indexOf(nav as LangCode) >= 0) return nav as LangCode;
  } catch { /* ignore */ }
  return 'zh';
}

export function cachedDict(group: DictGroup, lang: LangCode): Dict | null {
  try {
    const raw = localStorage.getItem(`${CACHE}:${group}:${lang}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const loaders: Record<string, () => Promise<{ default: Dict }>> = {
  'checkin-zh': () => import('./student-i18n/checkin-zh'),
  'checkin-en': () => import('./student-i18n/checkin-en'),
  'checkin-ru': () => import('./student-i18n/checkin-ru'),
  'checkin-ja': () => import('./student-i18n/checkin-ja'),
  'checkin-ko': () => import('./student-i18n/checkin-ko'),
  'checkin-es': () => import('./student-i18n/checkin-es'),
  'seat-zh': () => import('./student-i18n/seat-zh'),
  'seat-en': () => import('./student-i18n/seat-en'),
  'seat-ru': () => import('./student-i18n/seat-ru'),
  'seat-ja': () => import('./student-i18n/seat-ja'),
  'seat-ko': () => import('./student-i18n/seat-ko'),
  'seat-es': () => import('./student-i18n/seat-es'),
  'seatResult-zh': () => import('./student-i18n/seatResult-zh'),
  'seatResult-en': () => import('./student-i18n/seatResult-en'),
  'seatResult-ru': () => import('./student-i18n/seatResult-ru'),
  'seatResult-ja': () => import('./student-i18n/seatResult-ja'),
  'seatResult-ko': () => import('./student-i18n/seatResult-ko'),
  'seatResult-es': () => import('./student-i18n/seatResult-es'),
};

export async function loadDict(group: DictGroup, lang: LangCode): Promise<Dict> {
  const load = loaders[`${group}-${lang}`] || loaders[`${group}-zh`];
  const d = (await load()).default;
  try { localStorage.setItem(`${CACHE}:${group}:${lang}`, JSON.stringify(d)); } catch { /* ignore */ }
  return d;
}
