import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Trash2, Star, Search, Filter, Edit3, CheckCircle2, XCircle,
  HelpCircle, ListChecks, ToggleLeft, FileText, FolderPlus, Folder, ChevronRight
} from 'lucide-react';
import QuizImporter from './QuizImporter';
import type {
  QuizQuestion, QuizCategory, QuestionType,
} from './quizTypes';
import {
  getLocalQuestions, saveLocalQuestions,
  getLocalCategories, saveLocalCategories,
} from './quizTypes';
import {
  filterQuestions,
  addLocalQuestion,
  updateLocalQuestion,
  deleteLocalQuestion,
  toggleStarQuestion,
} from '@/lib/quiz-utils';

interface Props {
  questions: QuizQuestion[];
  setQuestions: (qs: QuizQuestion[]) => void;
  categories: QuizCategory[];
  setCategories: (cs: QuizCategory[]) => void;
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  onStartSession: () => void;
  sessionTitle: string;
  setSessionTitle: (s: string) => void;
  isGuest: boolean;
}

export default function QuizQuestionBank({
  questions, setQuestions, categories, setCategories,
  selectedIds, setSelectedIds, onStartSession,
  sessionTitle, setSessionTitle, isGuest,
}: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
  const [editQ, setEditQ] = useState<QuizQuestion | null>(null);

  // Form state
  const [qType, setQType] = useState<QuestionType>('single');
  const [qContent, setQContent] = useState('');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState<string | string[]>('A');
  const [qTags, setQTags] = useState('');
  const [qCategoryId, setQCategoryId] = useState<string>('');

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [filterStarred, setFilterStarred] = useState(false);

  // Category management
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const filteredQuestions = useMemo(() => {
    return filterQuestions(questions, {
      type: filterType,
      categoryId: filterCategoryId,
      starred: filterStarred,
      search: searchText,
    });
  }, [questions, filterType, filterCategoryId, filterStarred, searchText]);

  const resetForm = () => {
    setQType('single'); setQContent(''); setQOptions(['', '', '', '']);
    setQCorrect('A'); setQTags(''); setQCategoryId('');
  };

  const openEdit = (q: QuizQuestion) => {
    setEditQ(q);
    setQType(q.type);
    setQContent(q.content);
    setQOptions(q.type === 'tf' || q.type === 'short' ? ['', '', '', ''] : [...q.options, '', '', '', ''].slice(0, Math.max(q.options.length, 4)));
    setQCorrect(q.correct_answer);
    setQTags(q.tags);
    setQCategoryId(q.category_id || '');
    setView('edit');
  };

  const saveQuestion = async () => {
    if (!qContent.trim()) return;
    const opts = qType === 'tf' ? ['正确', '错误'] : qType === 'short' ? [] : qOptions.filter(o => o.trim());
    if ((qType === 'single' || qType === 'multi') && opts.length < 2) {
      toast({ title: t('quiz.needOptions'), variant: 'destructive' }); return;
    }

    if (isGuest) {
      const qData = {
        type: qType, content: qContent.trim(), options: opts,
        correct_answer: qCorrect, tags: qTags.trim(),
        category_id: qCategoryId || null, is_starred: editQ?.is_starred || false,
      };
      let updated: QuizQuestion[];
      if (view === 'edit' && editQ) {
        updated = updateLocalQuestion(questions, editQ.id, qData);
      } else {
        updated = addLocalQuestion(questions, qData as any);
      }
      setQuestions(updated);
      saveLocalQuestions(updated);
      toast({ title: t('quiz.saved') });
    } else {
      if (view === 'edit' && editQ) {
        const { error } = await supabase.from('quiz_questions').update({
          type: qType, content: qContent.trim(), options: opts,
          correct_answer: qCorrect, tags: qTags.trim(),
          category_id: qCategoryId || null,
        } as any).eq('id', editQ.id);
        if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
      } else {
        const { error } = await supabase.from('quiz_questions').insert({
          user_id: user!.id, type: qType, content: qContent.trim(), options: opts,
          correct_answer: qCorrect, tags: qTags.trim(), category_id: qCategoryId || null,
        } as any);
        if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
      }
      toast({ title: t('quiz.saved') });
      // Reload
      const { data } = await supabase.from('quiz_questions').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }) as any;
      if (data) setQuestions(data);
    }
    resetForm(); setEditQ(null); setView('list');
  };

  const deleteQuestion = async (id: string) => {
    if (isGuest) {
      const updated = questions.filter(q => q.id !== id);
      setQuestions(updated); saveLocalQuestions(updated);
    } else {
      await supabase.from('quiz_questions').delete().eq('id', id) as any;
      setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const toggleStar = async (q: QuizQuestion) => {
    const newVal = !q.is_starred;
    if (isGuest) {
      const updated = questions.map(x => x.id === q.id ? { ...x, is_starred: newVal } : x);
      setQuestions(updated); saveLocalQuestions(updated);
    } else {
      await supabase.from('quiz_questions').update({ is_starred: newVal } as any).eq('id', q.id);
      setQuestions(questions.map(x => x.id === q.id ? { ...x, is_starred: newVal } : x));
    }
  };

  const handleImport = async (imported: { type: QuestionType; content: string; options: string[]; correct_answer: string | string[]; tags: string }[]) => {
    if (isGuest) {
      const newQs = imported.map(q => ({
        id: crypto.randomUUID(), user_id: 'local', ...q,
        category_id: null, is_starred: false, created_at: new Date().toISOString(),
      }));
      const updated = [...newQs, ...questions];
      setQuestions(updated); saveLocalQuestions(updated);
    } else {
      const rows = imported.map(q => ({ user_id: user!.id, ...q }));
      const { error } = await supabase.from('quiz_questions').insert(rows as any);
      if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
      const { data } = await supabase.from('quiz_questions').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }) as any;
      if (data) setQuestions(data);
    }
  };

  // Category management
  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    if (isGuest) {
      const cat: QuizCategory = {
        id: crypto.randomUUID(), user_id: 'local', name: newCategoryName.trim(),
        parent_id: null, sort_order: categories.length, created_at: new Date().toISOString(),
      };
      const updated = [...categories, cat];
      setCategories(updated); saveLocalCategories(updated);
    } else {
      const { error } = await supabase.from('quiz_categories').insert({
        user_id: user!.id, name: newCategoryName.trim(), sort_order: categories.length,
      } as any);
      if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
      const { data } = await supabase.from('quiz_categories').select('*').eq('user_id', user!.id).order('sort_order') as any;
      if (data) setCategories(data);
    }
    setNewCategoryName('');
  };

  const deleteCategory = async (id: string) => {
    if (isGuest) {
      setCategories(categories.filter(c => c.id !== id)); saveLocalCategories(categories.filter(c => c.id !== id));
      const updated = questions.map(q => q.category_id === id ? { ...q, category_id: null } : q);
      setQuestions(updated); saveLocalQuestions(updated);
    } else {
      await supabase.from('quiz_categories').delete().eq('id', id) as any;
      setCategories(categories.filter(c => c.id !== id));
      // category_id will be set to null by FK ON DELETE SET NULL
      setQuestions(questions.map(q => q.category_id === id ? { ...q, category_id: null } : q));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredQuestions.length)
      setSelectedIds(new Set());
    else
      setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'single': return <CheckCircle2 className="w-3.5 h-3.5 text-primary" />;
      case 'multi': return <ListChecks className="w-3.5 h-3.5 text-accent-foreground" />;
      case 'tf': return <ToggleLeft className="w-3.5 h-3.5 text-green-600" />;
      case 'short': return <FileText className="w-3.5 h-3.5 text-orange-500" />;
      default: return <HelpCircle className="w-3.5 h-3.5" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'single': return t('quiz.single');
      case 'multi': return t('quiz.multi');
      case 'tf': return t('quiz.tf');
      case 'short': return t('quiz.short');
      default: return type;
    }
  };

  const getCategoryName = (id: string | null | undefined) => {
    if (!id) return '';
    return categories.find(c => c.id === id)?.name || '';
  };

  // Add/Edit form
  if (view === 'add' || view === 'edit') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={() => { setView('list'); resetForm(); setEditQ(null); }} className="gap-1 text-xs">
            ← {t('board.back')}
          </Button>
          <h3 className="font-semibold text-foreground">{view === 'edit' ? t('quiz.editQuestion') : t('quiz.addQuestion')}</h3>
        </div>

        <div className="space-y-3 max-w-2xl">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-foreground mb-1 block">{t('quiz.questionType')}</label>
              <Select value={qType} onValueChange={v => {
                setQType(v as QuestionType);
                if (v === 'tf') setQCorrect('A');
                else if (v === 'multi') setQCorrect([]);
                else setQCorrect('A');
              }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{t('quiz.single')}</SelectItem>
                  <SelectItem value="multi">{t('quiz.multi')}</SelectItem>
                  <SelectItem value="tf">{t('quiz.tf')}</SelectItem>
                  <SelectItem value="short">{t('quiz.short')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {categories.length > 0 && (
              <div className="flex-1">
                <label className="text-xs font-medium text-foreground mb-1 block">{t('quiz.category')}</label>
                <Select value={qCategoryId || 'none'} onValueChange={v => setQCategoryId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('quiz.noCategory')}</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">{t('quiz.questionContent')}</label>
            <Textarea value={qContent} onChange={e => setQContent(e.target.value)} placeholder={t('quiz.questionPlaceholder')} rows={3} />
          </div>

          {(qType === 'single' || qType === 'multi') && (
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">{t('quiz.options')}</label>
              <div className="space-y-1.5">
                {qOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-4">{String.fromCharCode(65 + i)}</span>
                    <Input value={opt} onChange={e => { const n = [...qOptions]; n[i] = e.target.value; setQOptions(n); }}
                      placeholder={`${t('quiz.option')} ${String.fromCharCode(65 + i)}`} className="flex-1 h-8 text-sm" />
                    {i >= 2 && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setQOptions(qOptions.filter((_, j) => j !== i))}>
                      <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>}
                  </div>
                ))}
                {qOptions.length < 6 && (
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setQOptions([...qOptions, ''])}>
                    <Plus className="w-3 h-3 mr-1" /> {t('quiz.addOption')}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">{t('quiz.correctAnswer')}</label>
            {qType === 'single' && (
              <div className="flex gap-1.5">
                {qOptions.filter(o => o.trim()).map((_, i) => {
                  const letter = String.fromCharCode(65 + i);
                  return <Button key={i} variant={qCorrect === letter ? 'default' : 'outline'} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setQCorrect(letter)}>{letter}</Button>;
                })}
              </div>
            )}
            {qType === 'multi' && (
              <div className="flex gap-1.5">
                {qOptions.filter(o => o.trim()).map((_, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const sel = Array.isArray(qCorrect) && qCorrect.includes(letter);
                  return <Button key={i} variant={sel ? 'default' : 'outline'} size="sm" className="h-7 w-7 p-0 text-xs"
                    onClick={() => { const arr = Array.isArray(qCorrect) ? [...qCorrect] : []; if (sel) setQCorrect(arr.filter(x => x !== letter)); else setQCorrect([...arr, letter].sort()); }}>{letter}</Button>;
                })}
              </div>
            )}
            {qType === 'tf' && (
              <div className="flex gap-2">
                <Button variant={qCorrect === 'A' ? 'default' : 'outline'} size="sm" onClick={() => setQCorrect('A')}>✅ {t('quiz.true')}</Button>
                <Button variant={qCorrect === 'B' ? 'default' : 'outline'} size="sm" onClick={() => setQCorrect('B')}>❌ {t('quiz.false')}</Button>
              </div>
            )}
            {qType === 'short' && <Input value={typeof qCorrect === 'string' ? qCorrect : ''} onChange={e => setQCorrect(e.target.value)} placeholder={t('quiz.referenceAnswer')} className="h-8" />}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">{t('quiz.tags')}</label>
            <Input value={qTags} onChange={e => setQTags(e.target.value)} placeholder={t('quiz.tagsPlaceholder')} className="h-8" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={saveQuestion} className="gap-1"><Plus className="w-3.5 h-3.5" /> {t('quiz.save')}</Button>
            <Button variant="outline" size="sm" onClick={() => { setView('list'); resetForm(); setEditQ(null); }}>{t('quiz.cancel')}</Button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder={t('quiz.searchPlaceholder')} className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('quiz.allTypes')}</SelectItem>
            <SelectItem value="single">{t('quiz.single')}</SelectItem>
            <SelectItem value="multi">{t('quiz.multi')}</SelectItem>
            <SelectItem value="tf">{t('quiz.tf')}</SelectItem>
            <SelectItem value="short">{t('quiz.short')}</SelectItem>
          </SelectContent>
        </Select>
        {categories.length > 0 && (
          <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('quiz.allCategories')}</SelectItem>
              <SelectItem value="">{t('quiz.uncategorized')}</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant={filterStarred ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0"
          onClick={() => setFilterStarred(!filterStarred)} title={t('quiz.starredOnly')}>
          <Star className={`w-3.5 h-3.5 ${filterStarred ? 'fill-current' : ''}`} />
        </Button>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filteredQuestions.length}/{questions.length} {t('quiz.imp.questionsUnit')}
        </span>
        <div className="flex gap-1.5">
          {filteredQuestions.length > 0 && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectAll}>
              {selectedIds.size === filteredQuestions.length ? t('quiz.deselectAll') : t('quiz.selectAll')}
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowCategoryDialog(true)}>
            <Folder className="w-3 h-3" /> {t('quiz.manageCategories')}
          </Button>
          <QuizImporter onImport={handleImport} />
          <Button size="sm" className="text-xs h-7 gap-1" onClick={() => { resetForm(); setView('add'); }}>
            <Plus className="w-3 h-3" /> {t('quiz.addQuestion')}
          </Button>
        </div>
      </div>

      {/* Question list */}
      {filteredQuestions.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <HelpCircle className="w-10 h-10 mx-auto mb-3 text-primary/20" />
          <p className="text-sm font-medium text-foreground mb-1">{t('quiz.noQuestions')}</p>
          <p className="text-xs mb-3">{t('quiz.noQuestionsHint')}</p>
          <Button size="sm" onClick={() => setView('add')} className="gap-1"><Plus className="w-3.5 h-3.5" /> {t('quiz.addQuestion')}</Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredQuestions.map(q => (
            <div key={q.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer group ${selectedIds.has(q.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
              onClick={() => toggleSelect(q.id)}
            >
              <Checkbox checked={selectedIds.has(q.id)} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {typeIcon(q.type)}
                  <span className="text-[10px] text-muted-foreground">{typeLabel(q.type)}</span>
                  {q.tags && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{q.tags}</span>}
                  {q.category_id && <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded flex items-center gap-0.5"><Folder className="w-2.5 h-2.5" />{getCategoryName(q.category_id)}</span>}
                </div>
                <p className="text-sm text-foreground line-clamp-2">{q.content}</p>
                {q.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {q.options.map((o: string, i: number) => {
                      const letter = String.fromCharCode(65 + i);
                      const isCorrect = Array.isArray(q.correct_answer) ? q.correct_answer.includes(letter) : q.correct_answer === letter;
                      return <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${isCorrect ? 'bg-green-100 text-green-700 font-medium' : 'bg-muted text-muted-foreground'}`}>{letter}. {o}</span>;
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); toggleStar(q); }}>
                  <Star className={`w-3.5 h-3.5 ${q.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); openEdit(q); }}>
                  <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); deleteQuestion(q.id); }}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session launch bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 bg-card border border-border rounded-xl p-3 shadow-lg flex items-center gap-3">
          <span className="text-sm text-foreground font-medium">{t('quiz.selected')}: {selectedIds.size}</span>
          <Input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)}
            placeholder={t('quiz.sessionTitle')} className="flex-1 h-8 text-sm" />
          <Button size="sm" onClick={onStartSession} disabled={isGuest} className="gap-1 shrink-0"
            title={isGuest ? t('quiz.loginToPublish') : ''}>
            {t('quiz.startSession')}
          </Button>
        </div>
      )}

      {/* Category management dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('quiz.manageCategories')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                placeholder={t('quiz.newCategoryName')} className="h-8 flex-1 text-sm"
                onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <Button size="sm" className="h-8" onClick={addCategory} disabled={!newCategoryName.trim()}>
                <FolderPlus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('quiz.noCategories')}</p>
            ) : (
              <div className="space-y-1">
                {categories.map(c => {
                  const count = questions.filter(q => q.category_id === c.id).length;
                  return (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 group">
                      <div className="flex items-center gap-2">
                        <Folder className="w-3.5 h-3.5 text-primary" />
                        <span className="text-sm text-foreground">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">({count})</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteCategory(c.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
