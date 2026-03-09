import { useState } from 'react';
import { StudentProvider } from '@/contexts/StudentContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import StudentSidebar from '@/components/StudentSidebar';
import TabNavigation, { TabId } from '@/components/TabNavigation';
import RandomPicker from '@/components/RandomPicker';
import TeamworkPanel from '@/components/TeamworkPanel';
import SeatChart from '@/components/SeatChart';
import ToolkitPanel from '@/components/ToolkitPanel';
import BoardPanel from '@/components/BoardPanel';
import QuizPanel from '@/components/QuizPanel';
import AchievementPanel from '@/components/AchievementPanel';
import SettingsPanel from '@/components/SettingsPanel';
import WeChatBanner from '@/components/WeChatBanner';
import ClassLibrary from '@/components/ClassLibrary';
import LanguageSelector from '@/components/LanguageSelector';
import StoryboardPanel from '@/components/StoryboardPanel';
import PPTPanel from '@/components/PPTPanel';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, approvalStatus, isAdmin } = useAuth();
  const { t } = useLanguage();
  const isApproved = user && approvalStatus === 'approved';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('random');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'list' | 'library'>('list');

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    // Auto-collapse sidebar when switching tabs for cleaner UI
    setSidebarCollapsed(true);
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
      case 'achieve': return <AchievementPanel />;
      case 'toolkit': return <ToolkitPanel />;
    }
  };
  return (
    <ThemeProvider>
      <StudentProvider>
        <div className="flex flex-col h-screen bg-surface overflow-hidden">
          <WeChatBanner />

          {/* Header */}
          <header className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 bg-card border-b border-border">
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">{t('app.title')}</h1>
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
          <div className="flex flex-1 overflow-hidden relative">
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
            {isApproved && sidebarMode === 'library' ? (
                  <div className="h-full min-h-0 flex flex-col w-[500px] lg:w-[560px]">
                    <div className="flex border-b border-border bg-card">
                      <button
                        onClick={() => setSidebarMode('list')}
                        className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {t('sidebar.current')}
                      </button>
                      <button
                        onClick={() => setSidebarMode('library')}
                        className="flex-1 px-3 py-2 text-xs font-medium text-primary border-b-2 border-primary"
                      >
                        {t('sidebar.library')}
                      </button>
                    </div>
                    <ClassLibrary />
                  </div>
                ) : (
                  <div className="h-full min-h-0 flex flex-col">
                    {isApproved && (
                      <div className="flex border-b border-border bg-card">
                        <button
                          onClick={() => setSidebarMode('list')}
                          className="flex-1 px-3 py-2 text-xs font-medium text-primary border-b-2 border-primary"
                        >
                          {t('sidebar.current')}
                        </button>
                        <button
                          onClick={() => setSidebarMode('library')}
                          className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {t('sidebar.library')}
                        </button>
                      </div>
                    )}
                    <StudentSidebar
                      onClose={() => setSidebarOpen(false)}
                      collapsed={sidebarCollapsed}
                      onToggleCollapse={() => setSidebarCollapsed(c => !c)}
                    />
                  </div>
                )}
              </div>
            ) : null}

            {renderContent()}
          </div>
        </div>
      </StudentProvider>
    </ThemeProvider>
  );
};

export default Index;
