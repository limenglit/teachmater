import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type LangCode = 'zh' | 'en' | 'ru' | 'ja' | 'ko';

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
];

// Translation keys
const translations: Record<LangCode, Record<string, string>> = {
  zh: {
    'app.title': '互动课堂派',
    'app.subtitle': 'TeachMate |--洛阳理工学院--| limeng@lit.edu.cn',
    'tab.random': '随机选人',
    'tab.groups': '分组',
    'tab.teams': '建队',
    'tab.seats': '座位',
    'tab.checkin': '签到',
    'tab.toolkit': '工具箱',
    'ext.ai': 'AI助手',
    'ext.idea': '思享岛',
    'ext.tip': '与本平台使用同一邮箱即可登录',
    'sidebar.current': '📋 当前名单',
    'sidebar.library': '🏫 班级库',
    'header.login': '登录',
    'header.admin': '用户管理',
    'header.loading': '加载中...',
    'settings.title': '设置',
    'settings.theme': '主题配色',
    'settings.font': '字体',
    'settings.fontSize': '字体大小',
    'settings.nickname': '昵称',
    'settings.save': '保存',
    'settings.saved': '已保存',
    'settings.logout': '退出登录',
  },
  en: {
    'app.title': 'TeachMate',
    'app.subtitle': 'TeachMate |--Luoyang Institute of Technology--| limeng@lit.edu.cn',
    'tab.random': 'Random Pick',
    'tab.groups': 'Groups',
    'tab.teams': 'Teams',
    'tab.seats': 'Seats',
    'tab.checkin': 'Check-in',
    'tab.toolkit': 'Toolkit',
    'ext.ai': 'AI Assistant',
    'ext.idea': 'IdeaVas',
    'ext.tip': 'Log in with the same email as this platform',
    'sidebar.current': '📋 Current List',
    'sidebar.library': '🏫 Class Library',
    'header.login': 'Login',
    'header.admin': 'User Management',
    'header.loading': 'Loading...',
    'settings.title': 'Settings',
    'settings.theme': 'Color Theme',
    'settings.font': 'Font',
    'settings.fontSize': 'Font Size',
    'settings.nickname': 'Nickname',
    'settings.save': 'Save',
    'settings.saved': 'Saved',
    'settings.logout': 'Sign Out',
  },
  ru: {
    'app.title': 'TeachMate',
    'app.subtitle': 'TeachMate |--Лоянский технологический институт--| limeng@lit.edu.cn',
    'tab.random': 'Случайный выбор',
    'tab.groups': 'Группы',
    'tab.teams': 'Команды',
    'tab.seats': 'Места',
    'tab.checkin': 'Отметка',
    'tab.toolkit': 'Инструменты',
    'ext.ai': 'ИИ Помощник',
    'ext.idea': 'IdeaVas',
    'ext.tip': 'Войдите с тем же email, что и на этой платформе',
    'sidebar.current': '📋 Текущий список',
    'sidebar.library': '🏫 Библиотека классов',
    'header.login': 'Войти',
    'header.admin': 'Управление',
    'header.loading': 'Загрузка...',
    'settings.title': 'Настройки',
    'settings.theme': 'Цветовая тема',
    'settings.font': 'Шрифт',
    'settings.fontSize': 'Размер шрифта',
    'settings.nickname': 'Псевдоним',
    'settings.save': 'Сохранить',
    'settings.saved': 'Сохранено',
    'settings.logout': 'Выйти',
  },
  ja: {
    'app.title': 'TeachMate',
    'app.subtitle': 'TeachMate |--洛陽理工学院--| limeng@lit.edu.cn',
    'tab.random': 'ランダム指名',
    'tab.groups': 'グループ',
    'tab.teams': 'チーム',
    'tab.seats': '座席',
    'tab.checkin': '出席確認',
    'tab.toolkit': 'ツールボックス',
    'ext.ai': 'AIアシスタント',
    'ext.idea': 'IdeaVas',
    'ext.tip': 'このプラットフォームと同じメールでログイン',
    'sidebar.current': '📋 現在の名簿',
    'sidebar.library': '🏫 クラスライブラリ',
    'header.login': 'ログイン',
    'header.admin': 'ユーザー管理',
    'header.loading': '読み込み中...',
    'settings.title': '設定',
    'settings.theme': 'カラーテーマ',
    'settings.font': 'フォント',
    'settings.fontSize': 'フォントサイズ',
    'settings.nickname': 'ニックネーム',
    'settings.save': '保存',
    'settings.saved': '保存しました',
    'settings.logout': 'ログアウト',
  },
  ko: {
    'app.title': 'TeachMate',
    'app.subtitle': 'TeachMate |--뤄양 공과대학--| limeng@lit.edu.cn',
    'tab.random': '랜덤 선택',
    'tab.groups': '그룹',
    'tab.teams': '팀',
    'tab.seats': '좌석',
    'tab.checkin': '출석',
    'tab.toolkit': '도구함',
    'ext.ai': 'AI 어시스턴트',
    'ext.idea': 'IdeaVas',
    'ext.tip': '이 플랫폼과 같은 이메일로 로그인하세요',
    'sidebar.current': '📋 현재 명단',
    'sidebar.library': '🏫 학급 라이브러리',
    'header.login': '로그인',
    'header.admin': '사용자 관리',
    'header.loading': '로딩 중...',
    'settings.title': '설정',
    'settings.theme': '색상 테마',
    'settings.font': '글꼴',
    'settings.fontSize': '글꼴 크기',
    'settings.nickname': '닉네임',
    'settings.save': '저장',
    'settings.saved': '저장됨',
    'settings.logout': '로그아웃',
  },
};

interface LanguageContextValue {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

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
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
