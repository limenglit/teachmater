import { Dices, Users, Zap, LayoutGrid, Wrench, ClipboardCheck, BotMessageSquare, Lightbulb } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export type TabId = 'random' | 'groups' | 'teams' | 'seats' | 'toolkit' | 'checkin';

interface TabItem {
  id: TabId;
  labelKey: string;
  icon: React.ReactNode;
  emoji: string;
  requiresAuth?: boolean;
}

interface ExternalLink {
  labelKey: string;
  icon: React.ReactNode;
  emoji: string;
  url: string;
}

const tabs: TabItem[] = [
  { id: 'random', labelKey: 'tab.random', emoji: '🎲', icon: <Dices className="w-4 h-4" /> },
  { id: 'groups', labelKey: 'tab.groups', emoji: '👥', icon: <Users className="w-4 h-4" /> },
  { id: 'teams', labelKey: 'tab.teams', emoji: '⚡', icon: <Zap className="w-4 h-4" /> },
  { id: 'seats', labelKey: 'tab.seats', emoji: '🏫', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'checkin', labelKey: 'tab.checkin', emoji: '📋', icon: <ClipboardCheck className="w-4 h-4" />, requiresAuth: true },
  { id: 'toolkit', labelKey: 'tab.toolkit', emoji: '🧰', icon: <Wrench className="w-4 h-4" /> },
];

const externalLinks: ExternalLink[] = [
  { labelKey: 'ext.ai', emoji: '🤖', icon: <BotMessageSquare className="w-4 h-4" />, url: 'https://mcuai.lovable.app/' },
  { labelKey: 'ext.idea', emoji: '💡', icon: <Lightbulb className="w-4 h-4" />, url: 'https://ideavas.lovable.app/' },
];

interface Props {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
  isLoggedIn?: boolean;
  userEmail?: string;
}

export default function TabNavigation({ activeTab, onTabChange, isLoggedIn, userEmail }: Props) {
  const { t } = useLanguage();
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
          <span>{t(tab.labelKey)}</span>
        </button>
      ))}

      <div className="w-px h-5 bg-border mx-1 shrink-0" />

      {externalLinks.map(link => {
        const targetUrl = userEmail
          ? `${link.url}?email=${encodeURIComponent(userEmail)}`
          : link.url;
        return (
          <a
            key={link.url}
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={t('ext.tip')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <span>{link.emoji}</span>
            <span>{t(link.labelKey)}</span>
          </a>
        );
      })}
    </nav>
  );
}
