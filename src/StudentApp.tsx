import { Suspense, useState, useCallback, useEffect, type ReactNode } from 'react';
import { MiniToaster } from '@/components/student-ui';
import { LanguageCoreContext, type LangCode } from '@/contexts/language-core';
import { detectStudentLang, cachedDict, loadDict, type DictGroup } from '@/lib/student-i18n-loader';
import { BootPlaceholder } from '@/components/boot-placeholder';

/**
 * 学生扫码签到专用的精简外壳：不加载教师端、登录、全站设置、大词典和弹窗组件库；
 * 每个页面自带极小样式表，按手机界面语言只下载该页面的一种小词典。
 */
const currentGroup = (): DictGroup =>
  typeof window !== 'undefined' && window.location.pathname.toLowerCase().indexOf('/seat-checkin/') === 0 ? 'seat' : 'checkin';

export default function StudentApp({ children }: { children: ReactNode }) {
  const [group] = useState<DictGroup>(currentGroup);
  const [lang, setLangState] = useState<LangCode>(detectStudentLang);
  const [dict, setDict] = useState<Record<string, string> | null>(() => cachedDict(group, lang));
  useEffect(() => {
    let alive = true;
    loadDict(group, lang).then((d) => { if (alive) setDict(d); }, () => { if (alive) setDict((x) => x || {}); });
    return () => { alive = false; };
  }, [group, lang]);
  const setLang = useCallback((c: LangCode) => setLangState(c), []);
  const t = useCallback(
    (k: string) => (dict && dict[k]) ?? (lang === 'zh' ? k : (cachedDict(group, 'zh') || {})[k] ?? k),
    [dict, lang, group],
  );
  if (!dict) return <BootPlaceholder />;
  return (
    <LanguageCoreContext.Provider value={{ lang, setLang, t }}>
      <MiniToaster />
      <Suspense fallback={<BootPlaceholder />}>{children}</Suspense>
    </LanguageCoreContext.Provider>
  );
}
