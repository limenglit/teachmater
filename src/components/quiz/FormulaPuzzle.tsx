import { useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, closestCenter, pointerWithin, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MathText from './MathText';
import { MATH_BLOCKS, CHEM_BLOCKS, blockLatex, blockFields, type FormulaBlock, type BlockTemplate } from '@/lib/formula-blocks';

function PaletteBlock({ template, index, add }: { template: BlockTemplate; index: number; add: (t: BlockTemplate) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette-${index}`, data: { template } });
  return <div ref={setNodeRef} className={`inline-flex items-center border border-border rounded-md bg-background ${isDragging ? 'opacity-40' : ''}`}>
    <Button type="button" size="icon" variant="ghost" className="h-9 w-7 touch-none" {...attributes} {...listeners} aria-label={`拖动${template.label}公式块`} title={`拖动${template.label}`}><GripVertical className="h-3.5 w-3.5" /></Button>
    <Button type="button" variant="ghost" className="h-auto min-h-9 px-2 text-sm" onClick={() => add(template)} aria-label={`添加${template.label}公式块`} title={template.label}>
      <MathText text={`$${blockLatex(template)}$`} />
    </Button>
  </div>;
}

function PuzzleBlock({ block, selected, select }: { block: FormulaBlock; selected: boolean; select: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`flex items-center max-w-full rounded-md border bg-background ${selected ? 'border-primary ring-1 ring-primary/30' : 'border-border'} ${isDragging ? 'opacity-40' : ''}`} data-formula-block={block.id}>
    <Button type="button" variant="ghost" size="icon" className="h-10 w-7 shrink-0 touch-none" {...attributes} {...listeners} aria-label={`重排${block.label}公式块`} title="拖动重排"><GripVertical className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" className="h-auto min-h-10 min-w-0 whitespace-normal px-2" aria-pressed={selected} aria-label={`编辑${block.label}公式块`} onClick={select}>
      <MathText text={`$${blockLatex(block)}$`} />
    </Button>
  </div>;
}

function PuzzleTray({ blocks, selected, select }: { blocks: FormulaBlock[]; selected: string | null; select: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'formula-tray' });
  return <div ref={setNodeRef} aria-label="公式拼图区" className={`flex flex-wrap items-center gap-2 min-h-20 p-3 border border-dashed rounded-md ${isOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}>
    <SortableContext items={blocks.map(b => b.id)} strategy={rectSortingStrategy}>
      {blocks.map(b => <PuzzleBlock key={b.id} block={b} selected={selected === b.id} select={() => select(b.id)} />)}
    </SortableContext>
    {!blocks.length && <span className="text-sm text-muted-foreground">公式拼图区</span>}
  </div>;
}

export default function FormulaPuzzle({ subject, blocks, onChange }: { subject: string; blocks: FormulaBlock[]; onChange: (blocks: FormulaBlock[]) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const templates = subject === 'chem' ? CHEM_BLOCKS : MATH_BLOCKS;
  const current = blocks.find(b => b.id === selected);
  const currentIndex = blocks.findIndex(b => b.id === selected);
  const add = (template: BlockTemplate, index = blocks.length) => {
    const block: FormulaBlock = { id: `block-${Date.now()}-${Math.random().toString(36).slice(2)}`, kind: template.kind, label: template.label, values: [...template.values] };
    const next = [...blocks]; next.splice(index, 0, block); onChange(next); setSelected(block.id);
  };
  const finishDrag = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const targetIndex = blocks.findIndex(b => b.id === over.id);
    const template = active.data.current?.template as BlockTemplate | undefined;
    if (template) { add(template, targetIndex < 0 ? blocks.length : targetIndex); return; }
    const from = blocks.findIndex(b => b.id === active.id);
    if (from < 0) return;
    onChange(arrayMove(blocks, from, targetIndex < 0 ? blocks.length - 1 : targetIndex));
  };
  return <div className="space-y-2.5" data-testid="formula-puzzle">
    <DndContext sensors={sensors} collisionDetection={args => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)} onDragEnd={finishDrag}>
      <div className="flex flex-wrap gap-1.5">{templates.map((t, i) => <PaletteBlock key={`${subject}-${i}`} template={t} index={i} add={add} />)}</div>
      <PuzzleTray blocks={blocks} selected={selected} select={setSelected} />
    </DndContext>
    {current && <div className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
      {blockFields(current).map((label, i) => <label key={i} className="flex-1 min-w-[120px] text-xs text-muted-foreground space-y-1">
        <span>{label}</span><Input aria-label={label} value={current.values[i] ?? ''} className="h-9 font-mono" onChange={e => onChange(blocks.map(b => b.id === current.id ? { ...b, values: b.values.map((v, j) => j === i ? e.target.value : v) } : b))} />
      </label>)}
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="前移公式块" title="前移" disabled={currentIndex <= 0} onClick={() => onChange(arrayMove(blocks, currentIndex, currentIndex - 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="后移公式块" title="后移" disabled={currentIndex >= blocks.length - 1} onClick={() => onChange(arrayMove(blocks, currentIndex, currentIndex + 1))}><ChevronRight className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" aria-label="删除公式块" title="删除" onClick={() => { onChange(blocks.filter(b => b.id !== current.id)); setSelected(null); }}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>}
  </div>;
}