import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit2, RotateCcw, Check, X, Download, Upload, ImagePlus, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import type { CardItem } from './types';
import { DEFAULT_CARDS, fileToDataUrl } from './types';
import { readExcelFile, writeExcelFile } from '@/lib/excel-utils';

interface Props {
  cards: CardItem[];
  setCards: (cards: CardItem[]) => void;
}

export default function CardManager({ cards, setCards }: Props) {
  const { t } = useLanguage();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ word: '', definition: '', example: '', wordImage: '', definitionImage: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const wordImgRef = useRef<HTMLInputElement>(null);
  const defImgRef = useRef<HTMLInputElement>(null);

  const startAdd = () => {
    setEditId('__new__');
    setForm({ word: '', definition: '', example: '', wordImage: '', definitionImage: '' });
  };

  const startEdit = (c: CardItem) => {
    setEditId(c.id);
    setForm({
      word: c.word,
      definition: c.definition,
      example: c.example || '',
      wordImage: c.wordImage || '',
      definitionImage: c.definitionImage || '',
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'wordImage' | 'definitionImage') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('memory.imageOnly'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('memory.imageTooLarge'));
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setForm(f => ({ ...f, [field]: dataUrl }));
    e.target.value = '';
  };

  const save = () => {
    if (!form.word.trim() && !form.wordImage) {
      toast.error(t('memory.fillRequired'));
      return;
    }
    if (!form.definition.trim() && !form.definitionImage) {
      toast.error(t('memory.fillRequired'));
      return;
    }
    const cardData = {
      word: form.word.trim(),
      definition: form.definition.trim(),
      example: form.example.trim() || undefined,
      wordImage: form.wordImage || undefined,
      definitionImage: form.definitionImage || undefined,
    };
    if (editId === '__new__') {
      setCards([...cards, { id: crypto.randomUUID(), ...cardData }]);
      toast.success(t('memory.added'));
    } else {
      setCards(cards.map(c => c.id === editId ? { ...c, ...cardData } : c));
      toast.success(t('memory.updated'));
    }
    setEditId(null);
    setForm({ word: '', definition: '', example: '', wordImage: '', definitionImage: '' });
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

  const downloadTemplate = async () => {
    const header = [t('memory.wordPlaceholder'), t('memory.defPlaceholder'), t('memory.examplePlaceholder')];
    const sample1 = ['Serendipity', '意外发现珍奇事物的本领', 'Finding a $20 bill on the street.'];
    const sample2 = ['Ephemeral', '短暂的，瞬息的', 'The mayfly is an ephemeral creature.'];
    await writeExcelFile(
      [header, sample1, sample2],
      'Template',
      t('memory.templateFileName') + '.xlsx',
      [20, 30, 40],
    );
    toast.success(t('memory.templateDownloaded'));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const rows = await readExcelFile(buf);
      const start = rows.length > 0 && typeof rows[0][0] === 'string' && rows[0][0] === t('memory.wordPlaceholder') ? 1 : 0;
      const imported: CardItem[] = [];
      for (let i = start; i < rows.length; i++) {
        const [word, definition, example] = rows[i];
        const w = String(word ?? '').trim();
        const d = String(definition ?? '').trim();
        if (w && d) {
          imported.push({
            id: crypto.randomUUID(),
            word: w,
            definition: d,
            example: String(example ?? '').trim() || undefined,
          });
        }
      }
      if (imported.length === 0) {
        toast.error(t('memory.importEmpty'));
        return;
      }
      setCards([...cards, ...imported]);
      toast.success(t('memory.importSuccess').replace('{0}', String(imported.length)));
    } catch {
      toast.error(t('memory.importError'));
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const ImagePreview = ({ src, onRemove }: { src: string; onRemove: () => void }) => (
    <div className="relative inline-block">
      <img src={src} alt="" className="h-12 w-12 rounded-md object-cover border border-border" />
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
      >
        <XCircle className="w-3 h-3" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-foreground">{t('memory.vocabManager')}</h4>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={startAdd} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> {t('memory.add')}
          </Button>
          <Button size="sm" variant="outline" onClick={downloadTemplate} className="h-7 text-xs gap-1">
            <Download className="w-3 h-3" /> {t('memory.downloadTemplate')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="h-7 text-xs gap-1">
            <Upload className="w-3 h-3" /> {t('memory.import')}
          </Button>
          <Button size="sm" variant="ghost" onClick={resetDefault} className="h-7 text-xs gap-1">
            <RotateCcw className="w-3 h-3" /> {t('memory.resetDefault')}
          </Button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
      <input ref={wordImgRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'wordImage')} />
      <input ref={defImgRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'definitionImage')} />

      {editId && (
        <div className="bg-accent/50 rounded-lg p-3 space-y-2 border border-border">
          {/* Word / Front */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">{t('memory.frontLabel')}</label>
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('memory.wordPlaceholder')}
                value={form.word}
                onChange={e => setForm(f => ({ ...f, word: e.target.value }))}
                className="h-8 text-sm flex-1"
              />
              <Button size="sm" variant="outline" onClick={() => wordImgRef.current?.click()} className="h-8 text-xs gap-1 shrink-0">
                <ImagePlus className="w-3 h-3" /> {t('memory.addImage')}
              </Button>
            </div>
            {form.wordImage && (
              <ImagePreview src={form.wordImage} onRemove={() => setForm(f => ({ ...f, wordImage: '' }))} />
            )}
          </div>

          {/* Definition / Back */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">{t('memory.backLabel')}</label>
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('memory.defPlaceholder')}
                value={form.definition}
                onChange={e => setForm(f => ({ ...f, definition: e.target.value }))}
                className="h-8 text-sm flex-1"
              />
              <Button size="sm" variant="outline" onClick={() => defImgRef.current?.click()} className="h-8 text-xs gap-1 shrink-0">
                <ImagePlus className="w-3 h-3" /> {t('memory.addImage')}
              </Button>
            </div>
            {form.definitionImage && (
              <ImagePreview src={form.definitionImage} onRemove={() => setForm(f => ({ ...f, definitionImage: '' }))} />
            )}
          </div>

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
            <div className="min-w-0 flex-1 flex items-center gap-2">
              {c.wordImage && <img src={c.wordImage} alt="" className="w-6 h-6 rounded object-cover shrink-0" />}
              <span className="font-medium text-foreground">{c.word || t('memory.imageCard')}</span>
              <span className="text-muted-foreground">—</span>
              {c.definitionImage && <img src={c.definitionImage} alt="" className="w-6 h-6 rounded object-cover shrink-0" />}
              <span className="text-muted-foreground truncate">{c.definition || t('memory.imageCard')}</span>
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
