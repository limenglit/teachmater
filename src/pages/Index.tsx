import { useState } from 'react';
import { StudentProvider } from '@/contexts/StudentContext';
import StudentSidebar from '@/components/StudentSidebar';
import TabNavigation, { TabId } from '@/components/TabNavigation';
import RandomPicker from '@/components/RandomPicker';
import GroupManager from '@/components/GroupManager';
import TeamBuilder from '@/components/TeamBuilder';
import SeatChart from '@/components/SeatChart';
import ToolkitPanel from '@/components/ToolkitPanel';
import { Settings } from 'lucide-react';

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
    <StudentProvider>
      <div className="flex flex-col h-screen bg-surface overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground tracking-tight">互动课堂派</h1>
            <span className="text-sm text-muted-foreground font-light">TeachMate</span>
          </div>
          <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <Settings className="w-5 h-5" />
          </button>
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
  );
};

export default Index;
