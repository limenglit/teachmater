import { useState } from 'react';
import { StudentProvider } from '@/contexts/StudentContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import StudentSidebar from '@/components/StudentSidebar';
import TabNavigation, { TabId } from '@/components/TabNavigation';
import RandomPicker from '@/components/RandomPicker';
import GroupManager from '@/components/GroupManager';
import TeamBuilder from '@/components/TeamBuilder';
import SeatChart from '@/components/SeatChart';
import ToolkitPanel from '@/components/ToolkitPanel';
import SettingsPanel from '@/components/SettingsPanel';
import WeChatBanner from '@/components/WeChatBanner';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>('random');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'random': return <RandomPicker />;
      case 'groups': return <GroupManager />;
      case 'teams': return <TeamBuilder />;
      case 'seats': return <SeatChart />;
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
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">互动课堂派</h1>
              <span className="text-xs sm:text-sm text-muted-foreground font-light hidden sm:inline">TeachMate</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <span className="text-base">📋</span>
              </button>
              <SettingsPanel />
            </div>
          </header>

          {/* Tab Navigation */}
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}
            {/* Sidebar */}
            <div className={`
              fixed lg:relative z-50 lg:z-auto h-full
              transition-transform duration-300 ease-in-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
              <StudentSidebar onClose={() => setSidebarOpen(false)} />
            </div>
            {renderContent()}
          </div>
        </div>
      </StudentProvider>
    </ThemeProvider>
  );
};

export default Index;
