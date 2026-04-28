import { useEffect, useState } from 'react';
import { Brain, Puzzle, Layers, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MatchGame from '@/components/toolkit/memory-aid/MatchGame';
import FlashCard from '@/components/toolkit/memory-aid/FlashCard';
import { loadCards, toCardItems, type VocabSet } from '@/lib/vocab-cloud';
import type { CardItem } from '@/components/toolkit/memory-aid/types';
import { toast } from 'sonner';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  set: VocabSet;
  onClose: () => void;
}

export default function VocabPlayer({ set, onClose }: Props) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'match' | 'flash'>('match');
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCards(set.id)
      .then(rows => {
        if (cancelled) return;
        const items = toCardItems(rows);
        if (items.length < 2) {
          toast.error(t('vp.minTwoToStart'));
          onClose();
          return;
        }
        setCards(items);
      })
      .catch(e => {
        toast.error(t('vp.loadFailed') + e.message);
        onClose();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [set.id, onClose, t]);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-sm text-foreground truncate">{set.title}</span>
          <span className="text-xs text-muted-foreground shrink-0">{tFormat(t('vp.knowledgeCount'), cards.length)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={mode === 'match' ? 'default' : 'outline'}
            onClick={() => setMode('match')}
            className="h-7 text-xs gap-1"
          >
            <Puzzle className="w-3 h-3" /> {t('vp.matchMode')}
          </Button>
          <Button
            size="sm"
            variant={mode === 'flash' ? 'default' : 'outline'}
            onClick={() => setMode('flash')}
            className="h-7 text-xs gap-1"
          >
            <Layers className="w-3 h-3" /> {t('vp.flashMode')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs gap-1">
            <X className="w-3.5 h-3.5" /> {t('vp.close')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="text-center text-muted-foreground py-12 text-sm">{t('vp.loading')}</div>
          ) : cards.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">{t('vp.empty')}</div>
          ) : mode === 'match' ? (
            <MatchGame cards={cards} />
          ) : (
            <FlashCard cards={cards} />
          )}
        </div>
      </div>
    </div>
  );
}
