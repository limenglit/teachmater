import { useMemo, useState } from 'react';
import { Sigma, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FORMULA_LIBRARY } from '@/lib/formula-library';
import { renderLatex } from './MathText';

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

  const preview = useMemo(() => (latex.trim() ? renderLatex(latex) : ''), [latex]);

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

      <div className="flex flex-wrap gap-1">
        {subject.categories.map((c) => (
          <button key={c.id} type="button" onClick={() => setCatId(c.id)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${c.id === category.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
        {category.items.map((it, i) => (
          <button key={`${category.id}-${i}`} type="button" title={it.latex}
            onClick={() => setLatex((prev) => (prev ? `${prev} ${it.latex}` : it.latex))}
            className="min-w-[2.5rem] px-2 py-1 rounded border border-border bg-background hover:border-primary text-sm text-foreground">
            <span dangerouslySetInnerHTML={{ __html: renderLatex(it.latex) }} />
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Input value={latex} onChange={(e) => setLatex(e.target.value)} placeholder="点击上方模板，或直接输入 LaTeX，如 \frac{1}{2}mv^{2}" className="h-8 text-xs font-mono" />
        <div className="flex items-center gap-2">
          <div className="flex-1 min-h-[2rem] rounded border border-dashed border-border bg-background px-2 py-1 overflow-x-auto text-sm text-foreground">
            {preview ? <span dangerouslySetInnerHTML={{ __html: preview }} /> : <span className="text-xs text-muted-foreground">预览</span>}
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setLatex('')} disabled={!latex}>清空</Button>
          <Button type="button" size="sm" className="h-8 text-xs" disabled={!latex.trim()} onClick={() => { onInsert(`$${latex.trim()}$`); setLatex(''); }}>插入</Button>
        </div>
      </div>
    </div>
  );
}
