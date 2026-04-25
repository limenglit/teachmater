import { useEffect, useRef, useState, Suspense } from 'react';
import { StudentProvider } from '@/contexts/StudentContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import StudentSidebar from '@/components/StudentSidebar';
import TabNavigation, { TabId } from '@/components/TabNavigation';
import RandomPicker from '@/components/RandomPicker';
import SettingsPanel from '@/components/SettingsPanel';
import WeChatBanner from '@/components/WeChatBanner';
import ClassLibrary from '@/components/ClassLibrary';
import LanguageSelector from '@/components/LanguageSelector';
import { lazyRetry } from '@/lib/lazy-retry';
// Lazy-load heavy non-default tab panels to improve LCP on the landing route.
// The default 'random' tab uses RandomPicker (eager) so first paint is unaffected.
const TeamworkPanel = lazyRetry(() => import('@/components/TeamworkPanel'));
const SeatChart = lazyRetry(() => import('@/components/SeatChart'));
const ToolkitPanel = lazyRetry(() => import('@/components/ToolkitPanel'));
const BoardPanel = lazyRetry(() => import('@/components/BoardPanel'));
const QuizPanel = lazyRetry(() => import('@/components/QuizPanel'));
const AchievementPanel = lazyRetry(() => import('@/components/AchievementPanel'));
const TeacherCommunity = lazyRetry(() => import('@/components/TeacherCommunity'));
const StoryboardPanel = lazyRetry(() => import('@/components/StoryboardPanel'));
const PPTPanel = lazyRetry(() => import('@/components/PPTPanel'));
const VisualizationPanel = lazyRetry(() => import('@/components/VisualizationPanel'));
const VocabPanel = lazyRetry(() => import('@/components/VocabPanel'));
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PanelFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[300px] text-sm text-muted-foreground">
    <div className="w-6 h-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
  </div>
);

const Index = () => {
  const { user, approvalStatus, isAdmin } = useAuth();
  const { t } = useLanguage();
  const isApproved = user && approvalStatus === 'approved';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('random');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'list' | 'library'>('list');
  const [sidebarModeTransitioning, setSidebarModeTransitioning] = useState(false);
  const [sidebarModeEntering, setSidebarModeEntering] = useState(false);
  const [sidebarTransitionDirection, setSidebarTransitionDirection] = useState<'to-library' | 'to-list'>('to-library');
  const modeTimerRef = useRef<number | null>(null);
  const enterFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (modeTimerRef.current !== null) {
        window.clearTimeout(modeTimerRef.current);
      }
      if (enterFrameRef.current !== null) {
        window.cancelAnimationFrame(enterFrameRef.current);
      }
    };
  }, []);

  const switchSidebarMode = (nextMode: 'list' | 'library') => {
    if (sidebarMode === nextMode) return;

    if (modeTimerRef.current !== null) {
      window.clearTimeout(modeTimerRef.current);
    }
    if (enterFrameRef.current !== null) {
      window.cancelAnimationFrame(enterFrameRef.current);
    }

    setSidebarTransitionDirection(nextMode === 'library' ? 'to-library' : 'to-list');

    setSidebarModeTransitioning(true);
    modeTimerRef.current = window.setTimeout(() => {
      setSidebarMode(nextMode);
      setSidebarModeEntering(true);

      enterFrameRef.current = window.requestAnimationFrame(() => {
        setSidebarModeEntering(false);
        enterFrameRef.current = null;
      });

      setSidebarModeTransitioning(false);
      modeTimerRef.current = null;
    }, 150);
  };

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    // Keep collapse state stable across tabs; only normalize mode for consistency.
    setSidebarMode('list');
    setSidebarModeTransitioning(false);
    setSidebarModeEntering(false);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'random': return <RandomPicker />;
      case 'teamwork': return <TeamworkPanel />;
      case 'seats': return <SeatChart />;
      case 'board': return <BoardPanel />;
      case 'quiz': return <QuizPanel />;
      case 'sketch': return <StoryboardPanel />;
      case 'ppt': return <PPTPanel />;
      case 'visual': return <VisualizationPanel />;
      case 'achieve': return <AchievementPanel />;
      case 'community': return <TeacherCommunity />;
      case 'vocab': return <VocabPanel />;
      case 'toolkit': return <ToolkitPanel />;
    }
  };
  return (
    <ThemeProvider>
      <StudentProvider>
        <div className="flex flex-col h-[100dvh] bg-surface overflow-hidden">
          <WeChatBanner />

          {/* Header */}
          <header className="flex items-center justify-between px-3 sm:px-4 py-0 bg-card border-b border-border">
            <div className="flex items-center gap-2 sm:gap-3">
              <picture>
                <source srcSet="/logo.webp" type="image/webp" />
                <img src="/logo.png" alt="教创搭子" width="160" height="56" decoding="async" fetchPriority="high" className="h-14 w-auto transition-[filter] duration-300" style={{ filter: 'hue-rotate(var(--logo-hue-rotate, 0deg))' }} />
              </picture>
              <span className="text-xs sm:text-sm text-muted-foreground font-light hidden sm:inline">{t('app.subtitle')}</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <span className="text-base">📋</span>
              </button>
              {/* Auth button */}
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  title={t('header.admin')}
                >
                  🛡️
                </button>
              )}
              {user ? (
                <span className="text-xs text-muted-foreground hidden sm:inline mr-1 truncate max-w-[120px]">
                  {user.email}
                </span>
              ) : (
                <button
                  onClick={() => navigate('/auth')}
                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  title={t('header.login')}
                >
                  <LogIn className="w-5 h-5" />
                </button>
              )}
              <SettingsPanel />
              <LanguageSelector />
            </div>
          </header>

          {/* Tab Navigation */}
          <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} isLoggedIn={!!isApproved} userEmail={user?.email} />

          {/* Main Content */}
          <div className="flex flex-1 min-h-0 overflow-hidden relative">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar area */}
            {true ? (
              <div className={`
                fixed lg:relative z-50 lg:z-auto h-full min-h-0
                transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              `}>
                <div
                  className={`h-full min-h-0 flex flex-col transition-all duration-150 ease-out will-change-transform ${
                    sidebarModeTransitioning
                      ? sidebarTransitionDirection === 'to-library'
                        ? 'opacity-0 -translate-x-2'
                        : 'opacity-0 translate-x-2'
                      : sidebarModeEntering
                        ? sidebarTransitionDirection === 'to-library'
                          ? 'opacity-0 translate-x-2'
                          : 'opacity-0 -translate-x-2'
                        : 'opacity-100 translate-x-0'
                  }`}
                >
                  {isApproved && sidebarMode === 'library' ? (
                    <div className="h-full min-h-0 flex flex-col w-[min(100vw,500px)] max-w-[100vw] lg:w-[560px] lg:max-w-[560px]">
                      <ClassLibrary onBackToList={() => switchSidebarMode('list')} />
                    </div>
                  ) : (
                    <StudentSidebar
                      onClose={() => setSidebarOpen(false)}
                      collapsed={sidebarCollapsed}
                      onToggleCollapse={() => setSidebarCollapsed(c => !c)}
                      onOpenLibrary={isApproved ? () => switchSidebarMode('library') : undefined}
                    />
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden transition-[width] duration-150 ease-out">
              {/* 积分面板后，工具箱前插入社区 */}
              <Suspense fallback={<PanelFallback />}>{renderContent()}</Suspense>
            </div>
          </div>
        </div>
      </StudentProvider>
    </ThemeProvider>
  );
};

export default Index;
