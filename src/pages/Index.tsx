import { useState } from 'react';
import { StudentProvider } from '@/contexts/StudentContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import StudentSidebar from '@/components/StudentSidebar';
import TabNavigation, { TabId } from '@/components/TabNavigation';
import RandomPicker from '@/components/RandomPicker';
import GroupManager from '@/components/GroupManager';
import TeamBuilder from '@/components/TeamBuilder';
import SeatChart from '@/components/SeatChart';
import ToolkitPanel from '@/components/ToolkitPanel';
import CheckInPanel from '@/components/CheckInPanel';
import SettingsPanel from '@/components/SettingsPanel';
import WeChatBanner from '@/components/WeChatBanner';
import ClassLibrary from '@/components/ClassLibrary';
import { LogIn, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, approvalStatus, isAdmin } = useAuth();
  const isApproved = user && approvalStatus === 'approved';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('random');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'list' | 'library'>('list');

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'checkin') {
      setSidebarCollapsed(true);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'random': return <RandomPicker />;
      case 'groups': return <GroupManager />;
      case 'teams': return <TeamBuilder />;
      case 'seats': return <SeatChart />;
      case 'toolkit': return <ToolkitPanel />;
      case 'checkin': return <CheckInPanel />;
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
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">互动课堂派</h1>
              <span className="text-xs sm:text-sm text-muted-foreground font-light hidden sm:inline">TeachMate|洛阳理工学院|limeng@lit.edu.cn</span>
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
                  title="用户管理"
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
                  title="登录"
                >
                  <LogIn className="w-5 h-5" />
                </button>
              )}
              <SettingsPanel />
            </div>
          </header>

          {/* Tab Navigation */}
          <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} isLoggedIn={!!isApproved} />

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar area */}
            {activeTab !== 'checkin' || isApproved ? (
              <div className={`
                fixed lg:relative z-50 lg:z-auto h-full
                transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              `}>
            {isApproved && sidebarMode === 'library' ? (
                  <div className="h-full flex flex-col w-[500px] lg:w-[560px]">
                    <div className="flex border-b border-border bg-card">
                      <button
                        onClick={() => setSidebarMode('list')}
                        className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        📋 当前名单
                      </button>
                      <button
                        onClick={() => setSidebarMode('library')}
                        className="flex-1 px-3 py-2 text-xs font-medium text-primary border-b-2 border-primary"
                      >
                        🏫 班级库
                      </button>
                    </div>
                    <ClassLibrary />
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    {isApproved && (
                      <div className="flex border-b border-border bg-card">
                        <button
                          onClick={() => setSidebarMode('list')}
                          className="flex-1 px-3 py-2 text-xs font-medium text-primary border-b-2 border-primary"
                        >
                          📋 当前名单
                        </button>
                        <button
                          onClick={() => setSidebarMode('library')}
                          className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          🏫 班级库
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
