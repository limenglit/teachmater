import { useState } from 'react';
import { Brain, Puzzle, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { DEFAULT_CARDS, type CardItem } from './memory-aid/types';
import MatchGame from './memory-aid/MatchGame';
import FlashCard from './memory-aid/FlashCard';
import CardManager from './memory-aid/CardManager';

type Mode = 'match' | 'flash';

export default function MemoryAidTool() {
  const { t } = useLanguage();
  const [cards, setCards] = useState<CardItem[]>([...DEFAULT_CARDS]);
  const [mode, setMode] = useState<Mode>('match');
  const [showManager, setShowManager] = useState(false);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Brain className="w-4 h-4" /> {t('memory.title')}
      </h3>

      {/* Mode switcher */}
      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant={mode === 'match' ? 'default' : 'outline'}
          onClick={() => setMode('match')}
          className="flex-1 h-8 text-xs gap-1"
        >
          <Puzzle className="w-3.5 h-3.5" /> {t('memory.matchMode')}
        </Button>
        <Button
          size="sm"
          variant={mode === 'flash' ? 'default' : 'outline'}
          onClick={() => setMode('flash')}
          className="flex-1 h-8 text-xs gap-1"
        >
          <Layers className="w-3.5 h-3.5" /> {t('memory.flashMode')}
        </Button>
      </div>

      {/* Game area */}
      {mode === 'match' ? <MatchGame cards={cards} /> : <FlashCard cards={cards} />}

      {/* Vocab manager toggle */}
      <div className="mt-4 border-t border-border pt-3">
        <button
          onClick={() => setShowManager(s => !s)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {showManager ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {t('memory.vocabManager')} ({cards.length} {t('memory.items')})
        </button>
        {showManager && (
          <div className="mt-3">
            <CardManager cards={cards} setCards={setCards} />
          </div>
        )}
      </div>
    </div>
  );
}
