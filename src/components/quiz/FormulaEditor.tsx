import { useState } from 'react';
import { Sigma, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FORMULA_LIBRARY } from '@/lib/formula-library';
import { renderLatex } from './MathText';
import MathText from './MathText';
import FormulaPuzzle from './FormulaPuzzle';
import { composeFormula, type FormulaBlock } from '@/lib/formula-blocks';

interface Props {
  /** Receives text already wrapped in $...$ */
  onInsert: (text: string) => void;
  targetLabel?: string;
  defaultSubject?: string;
  onClose?: () => void;
}

/** Inline (non-overlay) formula editor with subject → category → template browsing. */
export default function FormulaEditor({ onInsert, targetLabel, defaultSubject = 'math', onClose }: Props) {
  const [subjectId, setSubjectId] = useState(defaultSubject);
  const subject = FORMULA_LIBRARY.find((s) => s.id === subjectId) ?? FORMULA_LIBRARY[0];
  const [catId, setCatId] = useState(subject.categories[0].id);
  const category = subject.categories.find((c) => c.id === catId) ?? subject.categories[0];
  const [latex, setLatex] = useState('');
  const [mode, setMode] = useState<'puzzle' | 'source'>('puzzle');
  const [blocks, setBlocks] = useState<FormulaBlock[]>([]);
  const changeBlocks = (next: FormulaBlock[]) => { setBlocks(next); setLatex(composeFormula(next)); };
  const clear = () => { setBlocks([]); setLatex(''); };
  const switchMode = (next: 'puzzle' | 'source') => {
    if (next === 'puzzle' && composeFormula(blocks) !== latex) {
      setBlocks(latex.trim() ? [{ id: `source-${Date.now()}`, kind: 'source', label: '自定义', values: [latex] }] : []);
    }
    setMode(next);
  };
  const addTemplate = (value: string) => {
    if (mode === 'source') { setLatex(prev => prev ? `${prev} ${value}` : value); return; }
    changeBlocks([...blocks, { id: `template-${Date.now()}-${Math.random()}`, kind: 'source', label: '模板', values: [value] }]);
  };

  const pickSubject = (id: string) => {
    setSubjectId(id);
    const s = FORMULA_LIBRARY.find((x) => x.id === id);
    if (s) setCatId(s.categories[0].id);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5" data-testid="formula-editor">
      <div className="flex flex-wrap items-center gap-1.5">
        <Sigma className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium text-foreground mr-1">公式编辑器</span>
        {FORMULA_LIBRARY.map((s) => (
          <Button key={s.id} type="button" size="sm" variant={s.id === subjectId ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => pickSubject(s.id)}>{s.name}</Button>
        ))}
        {targetLabel && <span className="text-[11px] text-muted-foreground ml-auto">插入到：{targetLabel}</span>}
        {onClose && <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose} aria-label="关闭公式编辑器"><X className="w-3.5 h-3.5" /></Button>}
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="公式编辑方式">
        <Button type="button" role="tab" aria-selected={mode === 'puzzle'} size="sm" variant={mode === 'puzzle' ? 'default' : 'outline'} onClick={() => switchMode('puzzle')}>公式拼图</Button>
        <Button type="button" role="tab" aria-selected={mode === 'source'} size="sm" variant={mode === 'source' ? 'default' : 'outline'} onClick={() => switchMode('source')}>LaTeX</Button>
      </div>
      {mode === 'puzzle' && <FormulaPuzzle subject={subjectId} blocks={blocks} onChange={changeBlocks} />}

      <div className="flex flex-wrap gap-1">
        {subject.categories.map((c) => (
          <Button key={c.id} type="button" size="sm" variant="outline" onClick={() => setCatId(c.id)}
            className={`h-7 text-[11px] px-2 ${c.id === category.id ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
            {c.name}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
        {category.items.map((it, i) => (
          <Button key={`${category.id}-${i}`} type="button" variant="outline" title={it.latex}
            onClick={() => addTemplate(it.latex)}
            className="h-auto min-w-[2.5rem] max-w-full px-2 py-1 text-sm">
            <span dangerouslySetInnerHTML={{ __html: renderLatex(it.latex) }} />
          </Button>
        ))}
      </div>

      <div className="space-y-1.5">
        {mode === 'source' && <Input aria-label="公式 LaTeX" value={latex} onChange={(e) => setLatex(e.target.value)} placeholder="LaTeX" className="h-8 text-xs font-mono" />}
        <div className="flex flex-wrap items-center gap-2">
          <div aria-label="公式预览" className="w-full min-w-0 min-h-[2rem] rounded border border-dashed border-border bg-background px-2 py-1 text-sm text-foreground">
            {latex.trim() ? <MathText text={`$${latex}$`} /> : <span className="text-xs text-muted-foreground">预览</span>}
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs ml-auto" onClick={clear} disabled={!latex}>清空</Button>
          <Button type="button" size="sm" className="h-8 text-xs" disabled={!latex.trim()} onClick={() => { onInsert(`$${latex.trim()}$`); clear(); }}>插入</Button>
        </div>
      </div>
    </div>
  );
}
