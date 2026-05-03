import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Trash2, FileCheck, ArrowLeft, Edit3, Shuffle, Download, Copy, ChevronUp, ChevronDown,
  FileText, HelpCircle, CheckCircle2, ListChecks, ToggleLeft, Eye, GripVertical, ChevronRight,
} from 'lucide-react';
import type {
  QuizQuestion, QuizPaper, PaperQuestion, PaperTemplate, TemplateRule, QuestionType,
} from './quizTypes';
import { getLocalPapers, saveLocalPapers } from './quizTypes';
import {
  addQuestionToPaper as addQToPaper,
  removeFromPaper as removeQFromPaper,
  movePaperQuestion,
  updatePaperQuestionScore,
  computePaperTotalScore,
  autoGeneratePaper,
  computeAutoTotalScore,
  deleteLocalPaper,
  duplicateLocalPaper,
} from '@/lib/quiz-utils';
import { writeExcelFile } from '@/lib/excel-utils';
import jsPDF from 'jspdf';

interface Props {
  papers: QuizPaper[];
  setPapers: (ps: QuizPaper[]) => void;
  questions: QuizQuestion[]; // full question bank for paper assembly
  isGuest: boolean;
  /** When set (non-empty), pre-populate a new paper draft and switch to create view. Cleared via onSeedConsumed. */
  seedQuestions?: QuizQuestion[];
  seedTitle?: string;
  onSeedConsumed?: () => void;
}

export default function QuizPaperBank({ papers, setPapers, questions, isGuest, seedQuestions, seedTitle, onSeedConsumed }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [view, setView] = useState<'list' | 'create' | 'edit' | 'auto'>('list');
  const [editPaper, setEditPaper] = useState<QuizPaper | null>(null);

  // Create/edit form
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [paperQs, setPaperQs] = useState<PaperQuestion[]>([]);
  const [totalScore, setTotalScore] = useState(100);
  const [isTemplate, setIsTemplate] = useState(false);

  // Auto-generate form
  const [autoRules, setAutoRules] = useState<TemplateRule[]>([
    { type: 'single', count: 10, score_each: 3 },
    { type: 'multi', count: 5, score_each: 4 },
    { type: 'tf', count: 5, score_each: 2 },
    { type: 'short', count: 2, score_each: 10 },
  ]);
  const [autoTitle, setAutoTitle] = useState('');
  const [autoTags, setAutoTags] = useState('');

  // Question picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerType, setPickerType] = useState('all');

  // Paper preview drawer (auto-opens after generation/seeding)
  const [showPreview, setShowPreview] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  const toggleAnswer = (key: string) => setExpandedAnswers(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const formatAnswer = (q: QuizQuestion): string => {
    if (q.type === 'tf') {
      const v = String(q.correct_answer);
      return v === 'true' || v === 'T' || v === '1' ? '✓' : '✗';
    }
    if (Array.isArray(q.correct_answer)) return q.correct_answer.join(', ');
    return String(q.correct_answer ?? '');
  };

  const reorderPaperQs = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= paperQs.length || to >= paperQs.length) return;
    const arr = [...paperQs];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setPaperQs(arr.map((pq, i) => ({ ...pq, order: i })));
  };

  const onRowDragStart = (i: number) => (e: React.DragEvent) => {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(i)); } catch {}
  };
  const onRowDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== i) setDragOverIdx(i);
  };
  const onRowDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIdx ?? parseInt(e.dataTransfer.getData('text/plain'));
    if (!Number.isNaN(from)) reorderPaperQs(from, i);
    setDragIdx(null); setDragOverIdx(null);
  };
  const onRowDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };


  const availableForPicker = useMemo(() => {
    const usedIds = new Set(paperQs.map(pq => pq.question_id));
    return questions.filter(q => {
      if (usedIds.has(q.id)) return false;
      if (pickerType !== 'all' && q.type !== pickerType) return false;
      if (pickerSearch.trim() && !q.content.toLowerCase().includes(pickerSearch.toLowerCase())) return false;
      return true;
    });
  }, [questions, paperQs, pickerType, pickerSearch]);

  const autoTotalScore = computeAutoTotalScore(autoRules);

  const resetForm = () => {
    setTitle(''); setDesc(''); setPaperQs([]); setTotalScore(100); setIsTemplate(false); setEditPaper(null);
  };

  // Consume seedQuestions: pre-populate a new paper from the question bank's filtered selection
  useEffect(() => {
    if (!seedQuestions || seedQuestions.length === 0) return;
    resetForm();
    setTitle(seedTitle || '');
    setPaperQs(seedQuestions.map((q, i) => {
      const score = q.type === 'short' ? 10 : q.type === 'multi' ? 4 : q.type === 'tf' ? 2 : 3;
      return { question_id: q.id, question: q, score, order: i };
    }));
    setView('create');
    setShowPreview(true);
    onSeedConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedQuestions]);

  const openCreate = () => { resetForm(); setView('create'); };

  const openEdit = (p: QuizPaper) => {
    setEditPaper(p); setTitle(p.title); setDesc(p.description);
    setPaperQs(p.questions); setTotalScore(p.total_score); setIsTemplate(p.is_template);
    setView('edit');
  };

  const addQuestionToPaperHandler = (q: QuizQuestion) => {
    setPaperQs(prev => addQToPaper(prev, q));
  };

  const removeFromPaper = (idx: number) => {
    setPaperQs(prev => removeQFromPaper(prev, idx));
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setPaperQs(movePaperQuestion(paperQs, idx, dir));
  };

  const updateScore = (idx: number, score: number) => {
    setPaperQs(updatePaperQuestionScore(paperQs, idx, score));
  };

  const currentTotalScore = computePaperTotalScore(paperQs);

  const savePaper = async () => {
    if (!title.trim()) { toast({ title: t('quiz.paper.needTitle'), variant: 'destructive' }); return; }
    if (paperQs.length === 0) { toast({ title: t('quiz.paper.needQuestions'), variant: 'destructive' }); return; }

    const paperData = {
      title: title.trim(), description: desc.trim(),
      questions: paperQs, total_score: currentTotalScore, is_template: isTemplate,
    };

    if (isGuest) {
      const paper: QuizPaper = {
        id: editPaper?.id || crypto.randomUUID(), user_id: 'local',
        ...paperData, template: null,
        created_at: editPaper?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      let updated: QuizPaper[];
      if (editPaper) updated = papers.map(p => p.id === editPaper.id ? paper : p);
      else updated = [paper, ...papers];
      setPapers(updated); saveLocalPapers(updated);
    } else {
      if (editPaper) {
        await supabase.from('quiz_papers').update({
          ...paperData, updated_at: new Date().toISOString(),
        } as any).eq('id', editPaper.id);
      } else {
        await supabase.from('quiz_papers').insert({
          user_id: user!.id, ...paperData,
        } as any);
      }
      const { data } = await supabase.from('quiz_papers').select('*').eq('user_id', user!.id).order('updated_at', { ascending: false }) as any;
      if (data) setPapers(data);
    }
    toast({ title: t('quiz.saved') });
    resetForm(); setView('list');
  };

  const deletePaper = async (id: string) => {
    if (isGuest) {
      const updated = deleteLocalPaper(papers, id);
      setPapers(updated); saveLocalPapers(updated);
    } else {
      await supabase.from('quiz_papers').delete().eq('id', id) as any;
      setPapers(deleteLocalPaper(papers, id));
    }
  };

  const duplicatePaperHandler = async (p: QuizPaper) => {
    if (isGuest) {
      const updated = duplicateLocalPaper(papers, p);
      setPapers(updated); saveLocalPapers(updated);
    } else {
      const newPaper = { ...p, id: crypto.randomUUID(), title: p.title + ' (copy)', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await supabase.from('quiz_papers').insert({ ...newPaper, user_id: user!.id } as any);
      const { data } = await supabase.from('quiz_papers').select('*').eq('user_id', user!.id).order('updated_at', { ascending: false }) as any;
      if (data) setPapers(data);
    }
    toast({ title: t('quiz.paper.duplicated') });
  };

  // Auto-generate
  const generatePaper = () => {
    const { questions: result, warnings } = autoGeneratePaper(questions, autoRules, autoTags);
    warnings.forEach(w => {
      toast({ title: `${t('quiz.paper.insufficientQuestions')} (${w})`, variant: 'destructive' });
    });
    if (result.length === 0) { toast({ title: t('quiz.paper.noMatchingQuestions'), variant: 'destructive' }); return; }

    setTitle(autoTitle.trim() || t('quiz.paper.autoTitle'));
    setDesc('');
    setPaperQs(result);
    setTotalScore(computePaperTotalScore(result));
    setView('create');
    setShowPreview(true);
    toast({ title: `${t('quiz.paper.generated')} ${result.length} ${t('quiz.imp.questionsUnit')}` });
  };

  const exportPaperExcel = (p: QuizPaper) => {
    const qs = (p.questions as PaperQuestion[]);
    const rows = qs.map((pq, i) => [
      i + 1, pq.question.type === 'single' ? '单选' : pq.question.type === 'multi' ? '多选' : pq.question.type === 'tf' ? '判断' : '简答',
      pq.question.content,
      ...(['A', 'B', 'C', 'D'].map((_, oi) => pq.question.options[oi] || '')),
      Array.isArray(pq.question.correct_answer) ? pq.question.correct_answer.join(',') : pq.question.correct_answer,
      pq.score,
    ]);
    const headers = ['序号', '题型', '题目', '选项A', '选项B', '选项C', '选项D', '答案', '分值'];
    writeExcelFile(
      [headers, ...rows],
      p.title.slice(0, 30),
      `${p.title}.xlsx`,
      [5, 6, 40, 15, 15, 15, 15, 8, 5]
    );
  };

  const exportPaperPDF = (p: QuizPaper) => {
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text(p.title, 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${t('quiz.paper.totalScore')}: ${p.total_score}`, 105, 28, { align: 'center' });
    let y = 40;
    const qs = (p.questions as PaperQuestion[]);
    doc.setFontSize(11);
    qs.forEach((pq, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${i + 1}. (${pq.score}pts) ${pq.question.content}`, 15, y, { maxWidth: 175 });
      y += 8;
      if (pq.question.options.length > 0) {
        pq.question.options.forEach((opt, oi) => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(`   ${String.fromCharCode(65 + oi)}. ${opt}`, 20, y);
          y += 6;
        });
      }
      y += 4;
    });
    doc.save(`${p.title}.pdf`);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'single': return <CheckCircle2 className="w-3 h-3 text-primary" />;
      case 'multi': return <ListChecks className="w-3 h-3 text-accent-foreground" />;
      case 'tf': return <ToggleLeft className="w-3 h-3 text-green-600" />;
      case 'short': return <FileText className="w-3 h-3 text-orange-500" />;
      default: return <HelpCircle className="w-3 h-3" />;
    }
  };

  // Auto-generate view
  if (view === 'auto') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={() => setView('list')} className="gap-1 text-xs">← {t('board.back')}</Button>
          <h3 className="font-semibold text-foreground">{t('quiz.paper.autoGenerate')}</h3>
        </div>
        <div className="max-w-lg space-y-3">
          <Input value={autoTitle} onChange={e => setAutoTitle(e.target.value)} placeholder={t('quiz.paper.paperTitle')} className="h-8 text-sm" />
          <Input value={autoTags} onChange={e => setAutoTags(e.target.value)} placeholder={t('quiz.paper.filterByTags')} className="h-8 text-sm" />
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">{t('quiz.paper.rules')}</label>
            {autoRules.map((rule, i) => {
              const poolCount = questions.filter(q => q.type === rule.type).length;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-12 text-muted-foreground">{t('quiz.' + rule.type)}</span>
                  <Input type="number" min={0} max={poolCount} value={rule.count}
                    onChange={e => { const r = [...autoRules]; r[i] = { ...r[i], count: parseInt(e.target.value) || 0 }; setAutoRules(r); }}
                    className="h-7 w-16 text-xs text-center" />
                  <span className="text-muted-foreground">{t('quiz.imp.questionsUnit')}</span>
                  <span className="text-muted-foreground">×</span>
                  <Input type="number" min={1} value={rule.score_each}
                    onChange={e => { const r = [...autoRules]; r[i] = { ...r[i], score_each: parseInt(e.target.value) || 1 }; setAutoRules(r); }}
                    className="h-7 w-16 text-xs text-center" />
                  <span className="text-muted-foreground">{t('quiz.paper.points')}</span>
                  <span className="text-muted-foreground ml-auto">({poolCount}{t('quiz.paper.available')})</span>
                </div>
              );
            })}
            <div className="text-sm font-medium text-foreground pt-1">{t('quiz.paper.totalScore')}: {autoTotalScore}</div>
          </div>
          <Button size="sm" onClick={generatePaper} className="gap-1"><Shuffle className="w-3.5 h-3.5" /> {t('quiz.paper.generate')}</Button>
        </div>
      </div>
    );
  }

  // Create/Edit view
  if (view === 'create' || view === 'edit') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={() => { setView('list'); resetForm(); }} className="gap-1 text-xs">← {t('board.back')}</Button>
          <h3 className="font-semibold text-foreground">{view === 'edit' ? t('quiz.paper.editPaper') : t('quiz.paper.createPaper')}</h3>
        </div>
        <div className="space-y-3">
          <div className="flex gap-3">
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('quiz.paper.paperTitle')} className="h-8 text-sm flex-1" />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={isTemplate} onCheckedChange={v => setIsTemplate(!!v)} />
              {t('quiz.paper.saveAsTemplate')}
            </label>
          </div>
          <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('quiz.paper.description')} rows={2} className="text-sm" />

          {/* Paper questions */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">{t('quiz.paper.paperQuestions')} ({paperQs.length}) · {currentTotalScore}{t('quiz.paper.points')}</span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowPreview(true)} disabled={paperQs.length === 0}>
                <Eye className="w-3 h-3" /> {t('quiz.paper.preview') || '预览'}
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowPicker(true)}>
                <Plus className="w-3 h-3" /> {t('quiz.paper.addFromBank')}
              </Button>
            </div>
          </div>

          {paperQs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
              <p className="text-xs">{t('quiz.paper.emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {paperQs.map((pq, i) => (
                <div key={pq.question_id + '-' + i}
                  draggable
                  onDragStart={onRowDragStart(i)}
                  onDragOver={onRowDragOver(i)}
                  onDrop={onRowDrop(i)}
                  onDragEnd={onRowDragEnd}
                  className={`flex items-center gap-2 p-2 rounded-md border bg-card text-xs group transition-colors ${
                    dragOverIdx === i && dragIdx !== i ? 'border-primary border-dashed bg-primary/5' : 'border-border'
                  } ${dragIdx === i ? 'opacity-50' : ''}`}>
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                  <span className="text-muted-foreground font-mono w-5">{i + 1}</span>
                  {typeIcon(pq.question.type)}
                  <span className="flex-1 truncate text-foreground">{pq.question.content}</span>
                  <Input type="number" min={1} value={pq.score} onChange={e => updateScore(i, parseInt(e.target.value) || 1)}
                    className="h-6 w-12 text-center text-xs" />
                  <span className="text-muted-foreground">{t('quiz.paper.points')}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveQuestion(i, -1)} disabled={i === 0}><ChevronUp className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveQuestion(i, 1)} disabled={i === paperQs.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeFromPaper(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={savePaper} className="gap-1"><FileCheck className="w-3.5 h-3.5" /> {t('quiz.save')}</Button>
            <Button variant="outline" size="sm" onClick={() => { setView('list'); resetForm(); }}>{t('quiz.cancel')}</Button>
          </div>
        </div>

        {/* Question picker dialog */}
        <Dialog open={showPicker} onOpenChange={setShowPicker}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader><DialogTitle>{t('quiz.paper.pickQuestions')}</DialogTitle></DialogHeader>
            <div className="flex gap-2 mb-2">
              <Input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder={t('quiz.searchPlaceholder')} className="h-8 text-xs flex-1" />
              <Select value={pickerType} onValueChange={setPickerType}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('quiz.allTypes')}</SelectItem>
                  <SelectItem value="single">{t('quiz.single')}</SelectItem>
                  <SelectItem value="multi">{t('quiz.multi')}</SelectItem>
                  <SelectItem value="tf">{t('quiz.tf')}</SelectItem>
                  <SelectItem value="short">{t('quiz.short')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 overflow-auto space-y-1">
              {availableForPicker.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">{t('quiz.paper.noAvailable')}</p>
              ) : availableForPicker.map(q => (
                <div key={q.id} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/50 cursor-pointer text-xs"
                  onClick={() => addQuestionToPaperHandler(q)}>
                  {typeIcon(q.type)}
                  <span className="flex-1 truncate text-foreground">{q.content}</span>
                  <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Paper preview drawer */}
        <Sheet open={showPreview} onOpenChange={setShowPreview}>
          <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle className="text-base">{t('quiz.paper.preview') || '试卷预览'}</SheetTitle>
              <SheetDescription className="text-xs">
                {paperQs.length} {t('quiz.imp.questionsUnit')} · {t('quiz.paper.totalScore')}: {currentTotalScore}{t('quiz.paper.points')}
              </SheetDescription>
            </SheetHeader>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{t('quiz.paper.paperTitle')}</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('quiz.paper.paperTitle')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                {paperQs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">{t('quiz.paper.emptyHint')}</p>
                ) : paperQs.map((pq, i) => (
                  <div key={pq.question_id + '-pv-' + i}
                    draggable
                    onDragStart={onRowDragStart(i)}
                    onDragOver={onRowDragOver(i)}
                    onDrop={onRowDrop(i)}
                    onDragEnd={onRowDragEnd}
                    className={`flex items-start gap-2 p-2.5 rounded-md border bg-card text-xs transition-colors ${
                      dragOverIdx === i && dragIdx !== i ? 'border-primary border-dashed bg-primary/5' : 'border-border'
                    } ${dragIdx === i ? 'opacity-50' : ''}`}>
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 mt-0.5" />
                    <span className="text-muted-foreground font-mono w-6 pt-0.5">{i + 1}.</span>
                    <div className="shrink-0 pt-0.5">{typeIcon(pq.question.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground line-clamp-2">{pq.question.content}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Input type="number" min={1} value={pq.score}
                        onChange={e => updateScore(i, parseInt(e.target.value) || 1)}
                        className="h-7 w-14 text-center text-xs" />
                      <span className="text-muted-foreground text-[10px]">{t('quiz.paper.points')}</span>
                      <div className="flex flex-col">
                        <Button variant="ghost" size="sm" className="h-4 w-5 p-0" onClick={() => moveQuestion(i, -1)} disabled={i === 0}><ChevronUp className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-4 w-5 p-0" onClick={() => moveQuestion(i, 1)} disabled={i === paperQs.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFromPaper(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-border flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{t('quiz.paper.totalScore')}: <span className="font-semibold text-foreground">{currentTotalScore}</span></span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>{t('quiz.cancel')}</Button>
                <Button size="sm" onClick={() => { setShowPreview(false); savePaper(); }} className="gap-1">
                  <FileCheck className="w-3.5 h-3.5" /> {t('quiz.save')}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{papers.length} {t('quiz.paper.papersCount')}</span>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setView('auto')}>
            <Shuffle className="w-3 h-3" /> {t('quiz.paper.autoGenerate')}
          </Button>
          <Button size="sm" className="text-xs h-7 gap-1" onClick={openCreate}>
            <Plus className="w-3 h-3" /> {t('quiz.paper.createPaper')}
          </Button>
        </div>
      </div>

      {papers.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <FileCheck className="w-10 h-10 mx-auto mb-3 text-primary/20" />
          <p className="text-sm font-medium text-foreground mb-1">{t('quiz.paper.noPapers')}</p>
          <p className="text-xs mb-3">{t('quiz.paper.noPapersHint')}</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" onClick={() => setView('auto')} className="gap-1"><Shuffle className="w-3.5 h-3.5" /> {t('quiz.paper.autoGenerate')}</Button>
            <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-3.5 h-3.5" /> {t('quiz.paper.createPaper')}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {papers.map(p => {
            const qs = (p.questions as PaperQuestion[]);
            return (
              <div key={p.id} className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{p.title}</span>
                    {p.is_template && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{t('quiz.paper.template')}</span>}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEdit(p)} title={t('quiz.editQuestion')}>
                      <Edit3 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => duplicatePaperHandler(p)} title={t('quiz.paper.duplicate')}>
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => exportPaperExcel(p)} title="Excel">
                      <Download className="w-3 h-3 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => exportPaperPDF(p)} title="PDF">
                      <FileText className="w-3 h-3 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => deletePaper(p.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{qs.length} {t('quiz.imp.questionsUnit')}</span>
                  <span>{p.total_score} {t('quiz.paper.points')}</span>
                  <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                </div>
                {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
