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

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>('random');

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
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground tracking-tight">互动课堂派</h1>
              <span className="text-sm text-muted-foreground font-light">TeachMate</span>
            </div>
            <SettingsPanel />
          </header>

          {/* Tab Navigation */}
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden">
            <StudentSidebar />
            {renderContent()}
          </div>
        </div>
      </StudentProvider>
    </ThemeProvider>
  );
};

export default Index;
