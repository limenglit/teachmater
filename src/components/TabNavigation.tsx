import { Dices, Users, Zap, LayoutGrid, Wrench } from 'lucide-react';

export type TabId = 'random' | 'groups' | 'teams' | 'seats' | 'toolkit';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  emoji: string;
}

const tabs: TabItem[] = [
  { id: 'random', label: '随机选人', emoji: '🎲', icon: <Dices className="w-4 h-4" /> },
  { id: 'groups', label: '分组', emoji: '👥', icon: <Users className="w-4 h-4" /> },
  { id: 'teams', label: '建队', emoji: '⚡', icon: <Zap className="w-4 h-4" /> },
  { id: 'seats', label: '座位', emoji: '🏫', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'toolkit', label: '工具箱', emoji: '🧰', icon: <Wrench className="w-4 h-4" /> },
];

interface Props {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}

export default function TabNavigation({ activeTab, onTabChange }: Props) {
  return (
    <nav className="flex items-center gap-1 px-6 py-3 border-b border-border bg-card">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-soft'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
        >
          <span>{tab.emoji}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
