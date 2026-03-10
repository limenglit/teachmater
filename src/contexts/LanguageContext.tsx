import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { translations } from './translations';

export type LangCode = 'zh' | 'en' | 'ru' | 'ja' | 'ko' | 'es';

export interface LangOption {
  code: LangCode;
  label: string;
  flag: string;
}

export const LANGUAGES: LangOption[] = [
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

// Helper: replace {0}, {1}, etc. in translated strings
export function tFormat(template: string, ...args: (string | number)[]): string {
  return args.reduce<string>((str, arg, i) => str.replace(`{${i}}`, String(arg)), template);
}

interface LanguageContextValue {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: string) => string;
}

const fallbackLanguageContext: LanguageContextValue = {
  lang: 'zh',
  setLang: () => {},
  t: (key: string) => translations.zh?.[key] ?? key,
};

const LanguageContext = createContext<LanguageContextValue>(fallbackLanguageContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    const saved = localStorage.getItem('app-lang');
    return (saved as LangCode) || 'zh';
  });

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    localStorage.setItem('app-lang', code);
  }, []);

  const t = useCallback((key: string) => {
    return translations[lang]?.[key] ?? translations['zh']?.[key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
