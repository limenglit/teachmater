import { Dices, Users, LayoutGrid, Wrench, BotMessageSquare, PenBox, FileQuestion, Pencil, Presentation, ImageIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatureConfig } from '@/contexts/FeatureConfigContext';

export type TabId = 'random' | 'teamwork' | 'seats' | 'board' | 'quiz' | 'sketch' | 'ppt' | 'visual' | 'achieve' | 'toolkit';

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
  { id: 'teamwork', labelKey: 'tab.teamwork', emoji: '👥', icon: <Users className="w-4 h-4" /> },
  { id: 'seats', labelKey: 'tab.seats', emoji: '🏫', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'board', labelKey: 'tab.board', emoji: '🎨', icon: <PenBox className="w-4 h-4" /> },
  { id: 'quiz', labelKey: 'tab.quiz', emoji: '📝', icon: <FileQuestion className="w-4 h-4" /> },
  { id: 'sketch', labelKey: 'tab.sketch', emoji: '✏️', icon: <Pencil className="w-4 h-4" /> },
  { id: 'ppt', labelKey: 'tab.ppt', emoji: '📊', icon: <Presentation className="w-4 h-4" /> },
  { id: 'visual', labelKey: 'tab.visual', emoji: '📐', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'achieve', labelKey: 'tab.achieve', emoji: '🏆', icon: <Dices className="w-4 h-4" /> },
  { id: 'toolkit', labelKey: 'tab.toolkit', emoji: '🧰', icon: <Wrench className="w-4 h-4" /> },
];

const externalLinks: ExternalLink[] = [
  { labelKey: 'ext.ai', emoji: '🤖', icon: <BotMessageSquare className="w-4 h-4" />, url: 'https://mcuai.lovable.app/' },
];

interface Props {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
  isLoggedIn?: boolean;
  userEmail?: string;
}

export default function TabNavigation({ activeTab, onTabChange, isLoggedIn, userEmail }: Props) {
  const { t } = useLanguage();
  const { isFeatureVisible } = useFeatureConfig();
  const visibleTabs = tabs.filter(tab => (!tab.requiresAuth || isLoggedIn) && isFeatureVisible(tab.id));

  return (
    <nav className="flex items-center gap-0.5 px-2 sm:px-4 py-2 border-b border-border bg-card overflow-x-auto scrollbar-hide">
      {visibleTabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0
            ${activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
        >
          <span className="text-sm">{tab.emoji}</span>
          <span>{t(tab.labelKey)}</span>
        </button>
      ))}

      <div className="w-px h-4 bg-border mx-1.5 shrink-0" />

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
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60"
          >
            <span className="text-sm">{link.emoji}</span>
            <span>{t(link.labelKey)}</span>
          </a>
        );
      })}
    </nav>
  );
}
