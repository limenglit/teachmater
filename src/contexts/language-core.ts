import { createContext, useContext } from 'react';

/**
 * 语言上下文的「轻量核心」：只有上下文对象和 hook，不含任何翻译词典。
 * 学生扫码页从这里取 useLanguage，避免把全站 6 种语言的大词典（约 800KB）
 * 下载到学生手机上。完整词典由 LanguageContext.tsx 的 LanguageProvider 注入。
 */
export type LangCode = 'zh' | 'en' | 'ru' | 'ja' | 'ko' | 'es';

export interface LanguageContextValue {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: string) => string;
}

export const LanguageCoreContext = createContext<LanguageContextValue | null>(null);

const keyFallback: LanguageContextValue = { lang: 'zh', setLang: () => {}, t: (k) => k };

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageCoreContext) || keyFallback;
}

export function tFormat(template: string, ...args: (string | number)[]): string {
  return args.reduce<string>((str, arg, i) => str.replace(`{${i}}`, String(arg)), template);
}
