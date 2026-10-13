import { Suspense, useState, useCallback, useEffect } from 'react';
import { MiniToaster } from '@/components/student-ui';
import { LanguageCoreContext, type LangCode } from '@/contexts/language-core';
import { detectStudentLang, cachedDict, loadDict, ZH_DICT } from '@/lib/student-i18n-loader';
import { lazyRetry } from '@/lib/lazy-retry';

/**
 * 学生扫码签到专用的精简应用：不加载教师端、登录、全站设置、大词典和弹窗组件库；
 * 按手机界面语言只下载一种小词典，弱网和旧手机也能快速打开。
 */
const CheckInPage = lazyRetry(() => import('./pages/CheckInPage'));
const SeatCheckinPage = lazyRetry(() => import('./pages/SeatCheckinPage'));

const Loading = () => (
  <div className="flex items-center justify-center min-h-[100dvh] text-muted-foreground">加载中…</div>
);

export default function StudentApp() {
  const [lang, setLangState] = useState<LangCode>(detectStudentLang);
  const [dict, setDict] = useState<Record<string, string>>(() => cachedDict(lang) || ZH_DICT);
  useEffect(() => {
    let alive = true;
    loadDict(lang).then((d) => { if (alive) setDict(d); }, () => {});
    return () => { alive = false; };
  }, [lang]);
  const setLang = useCallback((c: LangCode) => setLangState(c), []);
  const t = useCallback((k: string) => dict[k] ?? ZH_DICT[k] ?? k, [dict]);
  return (
    <LanguageCoreContext.Provider value={{ lang, setLang, t }}>
      <MiniToaster />
      <Suspense fallback={<Loading />}>
        {window.location.pathname.toLowerCase().indexOf('/seat-checkin/') === 0 ? <SeatCheckinPage /> : <CheckInPage />}
      </Suspense>
    </LanguageCoreContext.Provider>
  );
}
