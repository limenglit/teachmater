import { useState } from 'react';
import { Brain, Puzzle, Layers, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { DEFAULT_CARDS, type CardItem } from './memory-aid/types';
import MatchGame from './memory-aid/MatchGame';
import FlashCard from './memory-aid/FlashCard';
import CardManager from './memory-aid/CardManager';

type Mode = 'match' | 'flash' | null;

export default function MemoryAidTool() {
  const { t } = useLanguage();
  const [cards, setCards] = useState<CardItem[]>([...DEFAULT_CARDS]);
  const [mode, setMode] = useState<Mode>(null);
  const [showManager, setShowManager] = useState(false);

  const closeFullscreen = () => {
    setMode(null);
    setShowManager(false);
  };

  // Fullscreen overlay
  if (mode) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">{t('memory.title')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={mode === 'match' ? 'default' : 'outline'}
              onClick={() => setMode('match')}
              className="h-7 text-xs gap-1"
            >
              <Puzzle className="w-3 h-3" /> {t('memory.matchMode')}
            </Button>
            <Button
              size="sm"
              variant={mode === 'flash' ? 'default' : 'outline'}
              onClick={() => setMode('flash')}
              className="h-7 text-xs gap-1"
            >
              <Layers className="w-3 h-3" /> {t('memory.flashMode')}
            </Button>
            <Button size="sm" variant="ghost" onClick={closeFullscreen} className="h-7 text-xs gap-1">
              <X className="w-3.5 h-3.5" /> ESC
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-2xl mx-auto">
            {mode === 'match' ? <MatchGame cards={cards} /> : <FlashCard cards={cards} />}
          </div>
        </div>

        {/* Vocab manager at bottom */}
        <div className="border-t border-border shrink-0 px-4 py-2 max-h-[40vh] overflow-auto">
          <button
            onClick={() => setShowManager(s => !s)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {showManager ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {t('memory.vocabManager')} ({cards.length} {t('memory.items')})
          </button>
          {showManager && (
            <div className="mt-2 max-w-2xl mx-auto">
              <CardManager cards={cards} setCards={setCards} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Collapsed card in toolkit
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Brain className="w-4 h-4" /> {t('memory.title')}
      </h3>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode('match')}
          className="flex-1 h-9 text-xs gap-1"
        >
          <Puzzle className="w-3.5 h-3.5" /> {t('memory.matchMode')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode('flash')}
          className="flex-1 h-9 text-xs gap-1"
        >
          <Layers className="w-3.5 h-3.5" /> {t('memory.flashMode')}
        </Button>
      </div>
    </div>
  );
}
