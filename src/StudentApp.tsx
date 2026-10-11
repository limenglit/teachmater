import { Suspense, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { LanguageCoreContext, type LangCode } from '@/contexts/language-core';
import { STUDENT_I18N } from '@/lib/student-i18n';
import { lazyRetry } from '@/lib/lazy-retry';

/**
 * 学生扫码签到专用的精简应用：不加载教师端首页、登录、全站设置和大词典，
 * 手机只需下载签到所需的少量代码，弱网和旧手机也能快速打开。
 */
const CheckInPage = lazyRetry(() => import('./pages/CheckInPage'));
const SeatCheckinPage = lazyRetry(() => import('./pages/SeatCheckinPage'));

const Loading = () => (
  <div className="flex items-center justify-center min-h-[100dvh] text-muted-foreground">加载中…</div>
);

function pickLang(): LangCode {
  try {
    const q = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('app-lang');
    return q === 'en' ? 'en' : 'zh';
  } catch { return 'zh'; }
}

export default function StudentApp() {
  const [lang, setLangState] = useState<LangCode>(pickLang);
  const setLang = useCallback((c: LangCode) => setLangState(c), []);
  const t = useCallback((k: string) => {
    const d = lang === 'en' ? STUDENT_I18N.en : STUDENT_I18N.zh;
    return d[k] ?? STUDENT_I18N.zh[k] ?? k;
  }, [lang]);
  return (
    <LanguageCoreContext.Provider value={{ lang, setLang, t }}>
      <Toaster />
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/checkin/:sessionId" element={<CheckInPage />} />
            <Route path="/seat-checkin/:sessionId" element={<SeatCheckinPage />} />
            <Route path="*" element={<CheckInPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LanguageCoreContext.Provider>
  );
}
