import { useLanguage } from '@/contexts/LanguageContext';
import type { BoardCard } from '@/components/BoardPanel';
import BoardCardItem from './BoardCardItem';

interface Props {
  cards: BoardCard[];
  panels: string[];
  onManage: (id: string, action: 'pin' | 'unpin' | 'delete') => void;
  onLike: (id: string) => void;
  isCreator: boolean;
  isCloud?: boolean;
}

export default function BoardStoryboardView({ cards, panels, onManage, onLike, isCreator, isCloud }: Props) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      {panels.map((panel, index) => {
        const panelCards = cards.filter(c => c.column_id === panel);
        return (
          <section key={panel} className="rounded-xl border border-border bg-card/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm sm:text-base font-semibold text-foreground">
                {t('board.storyPanel')} {index + 1}: {panel}
              </h4>
              <span className="text-xs text-muted-foreground">{panelCards.length}</span>
            </div>

            {panelCards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                {t('board.storyPanelHint')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {panelCards.map(card => (
                  <BoardCardItem
                    key={card.id}
                    card={card}
                    onManage={onManage}
                    onLike={onLike}
                    isCreator={isCreator}
                    isCloud={isCloud}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {cards.filter(c => !panels.includes(c.column_id)).length > 0 && (
        <section className="rounded-xl border border-border bg-muted/20 p-4">
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">{t('board.unassignedCards')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {cards.filter(c => !panels.includes(c.column_id)).map(card => (
              <BoardCardItem
                key={card.id}
                card={card}
                onManage={onManage}
                onLike={onLike}
                isCreator={isCreator}
                isCloud={isCloud}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
