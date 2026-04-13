import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit2, RotateCcw, Check, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import type { CardItem } from './types';
import { DEFAULT_CARDS } from './types';

interface Props {
  cards: CardItem[];
  setCards: (cards: CardItem[]) => void;
}

export default function CardManager({ cards, setCards }: Props) {
  const { t } = useLanguage();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ word: '', definition: '', example: '' });

  const startAdd = () => {
    setEditId('__new__');
    setForm({ word: '', definition: '', example: '' });
  };

  const startEdit = (c: CardItem) => {
    setEditId(c.id);
    setForm({ word: c.word, definition: c.definition, example: c.example || '' });
  };

  const save = () => {
    if (!form.word.trim() || !form.definition.trim()) {
      toast.error(t('memory.fillRequired'));
      return;
    }
    if (editId === '__new__') {
      const newCard: CardItem = {
        id: crypto.randomUUID(),
        word: form.word.trim(),
        definition: form.definition.trim(),
        example: form.example.trim() || undefined,
      };
      setCards([...cards, newCard]);
      toast.success(t('memory.added'));
    } else {
      setCards(cards.map(c => c.id === editId ? { ...c, word: form.word.trim(), definition: form.definition.trim(), example: form.example.trim() || undefined } : c));
      toast.success(t('memory.updated'));
    }
    setEditId(null);
    setForm({ word: '', definition: '', example: '' });
  };

  const remove = (id: string) => {
    if (cards.length <= 2) {
      toast.error(t('memory.minCards'));
      return;
    }
    setCards(cards.filter(c => c.id !== id));
    toast.success(t('memory.deleted'));
  };

  const resetDefault = () => {
    setCards([...DEFAULT_CARDS]);
    setEditId(null);
    toast.success(t('memory.resetDone'));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{t('memory.vocabManager')}</h4>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={startAdd} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> {t('memory.add')}
          </Button>
          <Button size="sm" variant="ghost" onClick={resetDefault} className="h-7 text-xs gap-1">
            <RotateCcw className="w-3 h-3" /> {t('memory.resetDefault')}
          </Button>
        </div>
      </div>

      {editId && (
        <div className="bg-accent/50 rounded-lg p-3 space-y-2 border border-border">
          <Input
            placeholder={t('memory.wordPlaceholder')}
            value={form.word}
            onChange={e => setForm(f => ({ ...f, word: e.target.value }))}
            className="h-8 text-sm"
          />
          <Input
            placeholder={t('memory.defPlaceholder')}
            value={form.definition}
            onChange={e => setForm(f => ({ ...f, definition: e.target.value }))}
            className="h-8 text-sm"
          />
          <Textarea
            placeholder={t('memory.examplePlaceholder')}
            value={form.example}
            onChange={e => setForm(f => ({ ...f, example: e.target.value }))}
            className="min-h-[40px] text-sm"
            rows={1}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} className="h-7 text-xs gap-1"><Check className="w-3 h-3" /> {t('memory.save')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditId(null)} className="h-7 text-xs gap-1"><X className="w-3 h-3" /> {t('memory.cancel')}</Button>
          </div>
        </div>
      )}

      <div className="max-h-48 overflow-y-auto space-y-1">
        {cards.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border text-xs">
            <div className="min-w-0 flex-1">
              <span className="font-medium text-foreground">{c.word}</span>
              <span className="text-muted-foreground ml-1.5">— {c.definition}</span>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => startEdit(c)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <Edit2 className="w-3 h-3" />
              </button>
              <button onClick={() => remove(c.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
