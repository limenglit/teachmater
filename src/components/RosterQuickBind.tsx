import { Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface RosterQuickBindProps {
  linkedCount: number;
  sidebarCount: number;
  onOpenRoster: () => void;
  onUseSidebar: () => void;
  className?: string;
}

export default function RosterQuickBind({
  linkedCount,
  sidebarCount,
  onOpenRoster,
  onUseSidebar,
  className,
}: RosterQuickBindProps) {
  const { t } = useLanguage();

  return (
    <div className={className || 'space-y-2'}>
      <Button
        variant={linkedCount > 0 ? 'default' : 'outline'}
        size="sm"
        className="gap-1.5"
        onClick={onOpenRoster}
      >
        <Users className="w-3.5 h-3.5" />
        {linkedCount > 0
          ? `${t('board.classLinked')}(${linkedCount}${t('sidebar.persons')})`
          : t('board.selectClass')}
      </Button>

      {linkedCount === 0 && sidebarCount > 0 && (
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onUseSidebar}>
          {t('board.useSidebarList')}({sidebarCount}{t('sidebar.persons')})
        </Button>
      )}
    </div>
  );
}
