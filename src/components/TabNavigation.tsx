import { Dices, Users, Zap, LayoutGrid, Wrench, ClipboardCheck, BotMessageSquare, Lightbulb } from 'lucide-react';

export type TabId = 'random' | 'groups' | 'teams' | 'seats' | 'toolkit' | 'checkin';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  emoji: string;
  requiresAuth?: boolean;
}

interface ExternalLink {
  label: string;
  icon: React.ReactNode;
  emoji: string;
  url: string;
}

const tabs: TabItem[] = [
  { id: 'random', label: '随机选人', emoji: '🎲', icon: <Dices className="w-4 h-4" /> },
  { id: 'groups', label: '分组', emoji: '👥', icon: <Users className="w-4 h-4" /> },
  { id: 'teams', label: '建队', emoji: '⚡', icon: <Zap className="w-4 h-4" /> },
  { id: 'seats', label: '座位', emoji: '🏫', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'checkin', label: '签到', emoji: '📋', icon: <ClipboardCheck className="w-4 h-4" />, requiresAuth: true },
  { id: 'toolkit', label: '工具箱', emoji: '🧰', icon: <Wrench className="w-4 h-4" /> },
];

const externalLinks: ExternalLink[] = [
  { label: 'AI助手', emoji: '🤖', icon: <BotMessageSquare className="w-4 h-4" />, url: 'https://mcuai.lovable.app/' },
  { label: '思享岛', emoji: '💡', icon: <Lightbulb className="w-4 h-4" />, url: 'https://ideavas.lovable.app/' },
];

interface Props {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
  isLoggedIn?: boolean;
  userEmail?: string;
}

export default function TabNavigation({ activeTab, onTabChange, isLoggedIn, userEmail }: Props) {
  const visibleTabs = tabs.filter(t => !t.requiresAuth || isLoggedIn);

  return (
    <nav className="flex items-center gap-1 px-3 sm:px-6 py-2 sm:py-3 border-b border-border bg-card overflow-x-auto scrollbar-hide">
      {visibleTabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0
            ${activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-soft'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
        >
          <span>{tab.emoji}</span>
          <span>{tab.label}</span>
        </button>
      ))}

      <div className="w-px h-5 bg-border mx-1 shrink-0" />

      {externalLinks.map(link => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <span>{link.emoji}</span>
          <span>{link.label}</span>
        </a>
      ))}
    </nav>
  );
}
