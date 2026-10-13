import { Suspense, useState, useCallback, useEffect } from 'react';
import { MiniToaster } from '@/components/student-ui';
import { LanguageCoreContext, type LangCode } from '@/contexts/language-core';
import { detectStudentLang, cachedDict, loadDict, type DictGroup } from '@/lib/student-i18n-loader';
import { lazyRetry } from '@/lib/lazy-retry';

/**
 * 学生扫码签到专用的精简应用：不加载教师端、路由库、登录、全站设置、大词典和弹窗组件库；
 * 每个页面自带极小样式表，按手机界面语言只下载该页面的一种小词典。
 */
const isSeat = window.location.pathname.toLowerCase().indexOf('/seat-checkin/') === 0;
const GROUP: DictGroup = isSeat ? 'seat' : 'checkin';
const Page = isSeat
  ? lazyRetry(() => import('./pages/SeatCheckinPage'))
  : lazyRetry(() => import('./pages/CheckInPage'));

const Loading = () => (
  <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>加载中… Loading</div>
);

export default function StudentApp() {
  const [lang, setLangState] = useState<LangCode>(detectStudentLang);
  const [dict, setDict] = useState<Record<string, string> | null>(() => cachedDict(GROUP, lang));
  useEffect(() => {
    let alive = true;
    loadDict(GROUP, lang).then((d) => { if (alive) setDict(d); }, () => { if (alive) setDict((x) => x || {}); });
    return () => { alive = false; };
  }, [lang]);
  const setLang = useCallback((c: LangCode) => setLangState(c), []);
  const t = useCallback((k: string) => (dict && dict[k]) ?? k, [dict]);
  if (!dict) return <Loading />;
  return (
    <LanguageCoreContext.Provider value={{ lang, setLang, t }}>
      <MiniToaster />
      <Suspense fallback={<Loading />}>
        <Page />
      </Suspense>
    </LanguageCoreContext.Provider>
  );
}
