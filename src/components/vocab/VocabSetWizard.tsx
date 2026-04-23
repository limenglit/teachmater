import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2, ChevronLeft, ChevronRight, Check, Loader2, Sparkles } from 'lucide-react';
import { AUDIENCE_OPTIONS, createSet, loadCards, updateSet, type VocabAudience, type VocabSet } from '@/lib/vocab-cloud';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: VocabSet | null; // null = create mode
  onSaved?: () => void;
}

interface CardDraft {
  word: string;
  definition: string;
  example: string;
}

const EMPTY_CARD: CardDraft = { word: '', definition: '', example: '' };

export default function VocabSetWizard({ open, onOpenChange, editing, onSaved }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState<VocabAudience>('university');
  const [description, setDescription] = useState('');
  const [cards, setCards] = useState<CardDraft[]>([{ ...EMPTY_CARD }, { ...EMPTY_CARD }]);
  const [publishMode, setPublishMode] = useState<'private' | 'submit'>('private');
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(10);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'append' | 'replace'>('append');

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSaving(false);
    if (editing) {
      setTitle(editing.title);
      setAudience(editing.audience);
      setDescription(editing.description);
      setPublishMode(editing.status === 'private' ? 'private' : 'submit');
      setLoadingEdit(true);
      loadCards(editing.id)
        .then(rows => {
          setCards(
            rows.length
              ? rows.map(r => ({ word: r.word, definition: r.definition, example: r.example || '' }))
              : [{ ...EMPTY_CARD }, { ...EMPTY_CARD }],
          );
        })
        .catch(e => toast.error('加载失败：' + e.message))
        .finally(() => setLoadingEdit(false));
    } else {
      setTitle('');
      setAudience('university');
      setDescription('');
      setCards([{ ...EMPTY_CARD }, { ...EMPTY_CARD }]);
      setPublishMode('private');
    }
  }, [open, editing]);

  const updateCard = (i: number, patch: Partial<CardDraft>) => {
    setCards(arr => arr.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  const addCard = () => setCards(arr => [...arr, { ...EMPTY_CARD }]);
  const removeCard = (i: number) => {
    if (cards.length <= 2) {
      toast.error('至少需要 2 个知识点');
      return;
    }
    setCards(arr => arr.filter((_, idx) => idx !== i));
  };

  const validStep1 = title.trim().length > 0;
  const validCards = cards.filter(c => c.word.trim() && c.definition.trim());
  const validStep2 = validCards.length >= 2;

  const handleAIGenerate = async () => {
    const topic = aiTopic.trim() || title.trim();
    if (!topic) {
      toast.error('请输入要生成的主题（或先填写词库名称）');
      return;
    }
    setAiLoading(true);
    try {
      const audienceLabel = AUDIENCE_OPTIONS.find(o => o.value === audience)?.label;
      const { data, error } = await supabase.functions.invoke('generate-vocab-cards', {
        body: { topic, count: aiCount, audience: audienceLabel },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const generated = ((data as any)?.cards || []) as { word: string; definition: string; example?: string }[];
      if (!generated.length) throw new Error('未返回任何卡片');
      const newCards: CardDraft[] = generated.map(c => ({
        word: c.word, definition: c.definition, example: c.example || '',
      }));
      if (aiMode === 'replace') {
        setCards(newCards);
      } else {
        // Append, dropping any leading empty placeholders
        const filtered = cards.filter(c => c.word.trim() || c.definition.trim());
        setCards([...filtered, ...newCards]);
      }
      toast.success(`已生成 ${newCards.length} 张卡片`);
    } catch (e: any) {
      toast.error('AI 生成失败：' + (e?.message || ''));
    } finally {
      setAiLoading(false);
    }
  };

  const next = () => {
    if (step === 1 && !validStep1) {
      toast.error('请填写词库名称');
      return;
    }
    if (step === 2 && !validStep2) {
      toast.error('至少需要 2 条完整知识点（单词 + 定义）');
      return;
    }
    setStep(s => Math.min(3, s + 1));
  };
  const prev = () => setStep(s => Math.max(1, s - 1));

  const handleSave = async () => {
    if (!validStep1 || !validStep2) {
      toast.error('信息不完整');
      return;
    }
    setSaving(true);
    try {
      const cleanCards = validCards.map(c => ({
        word: c.word.trim(),
        definition: c.definition.trim(),
        example: c.example.trim() || undefined,
      }));
      if (editing) {
        await updateSet(editing.id, { title: title.trim(), audience, description: description.trim() }, cleanCards);
        if (publishMode === 'submit' && editing.status !== 'pending' && editing.status !== 'approved') {
          const { submitSet } = await import('@/lib/vocab-cloud');
          await submitSet(editing.id);
        }
        toast.success('词库已更新');
      } else {
        await createSet({
          title: title.trim(),
          audience,
          description: description.trim(),
          cards: cleanCards,
          submit: publishMode === 'submit',
          authorName: user?.email?.split('@')[0] || '',
        });
        toast.success(publishMode === 'submit' ? '词库已创建并提交审核' : '词库已创建（私有）');
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('保存失败：' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑词库' : '创建词库'}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : step > s
                      ? 'bg-success/20 text-success'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-px ${step > s ? 'bg-success' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {loadingEdit ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> 加载中…
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <Label>词库名称 *</Label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="例如：八年级物理-牛顿定律"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>适用对象 *</Label>
                  <Select value={audience} onValueChange={v => setAudience(v as VocabAudience)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>简短描述</Label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="可选。介绍该词库的内容、适用场景等"
                    rows={3}
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">至少 2 个知识点（已填 {validCards.length}）</span>
                  <Button size="sm" variant="outline" onClick={addCard} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> 添加
                  </Button>
                </div>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {cards.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-accent/40 border border-border">
                      <span className="text-xs text-muted-foreground w-5 mt-2 text-center">{i + 1}</span>
                      <div className="flex-1 space-y-1.5">
                        <Input
                          placeholder="单词 / 术语"
                          value={c.word}
                          onChange={e => updateCard(i, { word: e.target.value })}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="定义 / 释义"
                          value={c.definition}
                          onChange={e => updateCard(i, { definition: e.target.value })}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="例句（可选）"
                          value={c.example}
                          onChange={e => updateCard(i, { example: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => removeCard(i)}
                        className="p-1 mt-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <Label>发布选项</Label>
                <RadioGroup value={publishMode} onValueChange={v => setPublishMode(v as 'private' | 'submit')}>
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-border">
                    <RadioGroupItem value="private" id="r-private" className="mt-1" />
                    <label htmlFor="r-private" className="flex-1 cursor-pointer">
                      <div className="text-sm font-medium text-foreground">私有（仅自己可见）</div>
                      <div className="text-xs text-muted-foreground mt-0.5">保存后仅在"我的词库"中可见，可随时编辑或之后再发布</div>
                    </label>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-border">
                    <RadioGroupItem value="submit" id="r-submit" className="mt-1" />
                    <label htmlFor="r-submit" className="flex-1 cursor-pointer">
                      <div className="text-sm font-medium text-foreground">提交发布（进入待审核）</div>
                      <div className="text-xs text-muted-foreground mt-0.5">发布后需管理员审核，审核通过后所有用户可见并可调用</div>
                    </label>
                  </div>
                </RadioGroup>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
                  概要：<span className="text-foreground font-medium">{title || '未命名'}</span> ·
                  {AUDIENCE_OPTIONS.find(o => o.value === audience)?.label} ·
                  {validCards.length} 个知识点
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" onClick={prev} disabled={step === 1 || saving} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> 上一步
          </Button>
          {step < 3 ? (
            <Button onClick={next} className="gap-1">
              下一步 <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editing ? '保存修改' : '完成创建'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
