import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Trash2, RotateCcw, ArrowRight } from 'lucide-react';
import {
  PracticeItem, getPracticeList, removeFromPracticeList, clearPracticeList,
  isPracticeAnswerCorrect,
} from '@/lib/practice-list';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const TYPE_LABEL: Record<PracticeItem['type'], string> = {
  single: '单选', multi: '多选', tf: '判断', short: '简答',
};

export default function PracticeRunner({ open, onOpenChange }: Props) {
  const [list, setList] = useState<PracticeItem[]>([]);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [response, setResponse] = useState('');
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setList(getPracticeList());
    setStarted(false); setIdx(0); setResponse(''); setChecked(false); setResults({});
  }, [open]);

  useEffect(() => {
    const sync = () => setList(getPracticeList());
    window.addEventListener('practice-list-changed', sync);
    return () => window.removeEventListener('practice-list-changed', sync);
  }, []);

  const current = list[idx];
  const correctCount = useMemo(() => Object.values(results).filter(Boolean).length, [results]);
  const done = started && idx >= list.length;

  const toggleLetter = (letter: string) => {
    if (checked) return;
    if (current.type === 'multi') {
      const set = new Set(response.split(''));
      set.has(letter) ? set.delete(letter) : set.add(letter);
      setResponse([...set].sort().join(''));
    } else {
      setResponse(letter);
    }
  };

  const check = () => {
    if (!current) return;
    setChecked(true);
    setResults(prev => ({ ...prev, [current.id]: isPracticeAnswerCorrect(current, response) }));
  };

  const next = () => { setIdx(i => i + 1); setResponse(''); setChecked(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>我的练习清单</DialogTitle>
          <DialogDescription>
            {started ? `共 ${list.length} 题，已答对 ${correctCount} 题` : `已收藏 ${list.length} 道练习题`}
          </DialogDescription>
        </DialogHeader>

        {list.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            练习清单还是空的，先在「可直接练习的题目」里加入题目吧。
          </p>
        )}

        {/* 清单模式 */}
        {!started && list.length > 0 && (
          <div className="space-y-2">
            {list.map((it, i) => (
              <div key={it.id} className="p-3 rounded-md border border-border bg-card flex items-start gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm text-foreground">{i + 1}. {it.question}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[it.type]}</Badge>
                    {it.knowledgePoint && <Badge variant="outline" className="text-[10px]">{it.knowledgePoint}</Badge>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                  onClick={() => removeFromPracticeList(it.id)} aria-label="移除题目">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-border">
              <Button size="sm" variant="ghost" onClick={() => clearPracticeList()}>清空清单</Button>
              <Button size="sm" onClick={() => { setStarted(true); setIdx(0); setResponse(''); setChecked(false); setResults({}); }}>
                开始练习
              </Button>
            </div>
          </div>
        )}

        {/* 答题模式 */}
        {started && current && (
          <div className="space-y-3">
            <Progress value={(idx / list.length) * 100} className="h-1.5" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>第 {idx + 1} / {list.length} 题</span>
              <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[current.type]}</Badge>
            </div>
            <p className="text-sm font-medium text-foreground">{current.question}</p>

            {current.options.length > 0 ? (
              <div className="space-y-1.5">
                {current.options.map((o, j) => {
                  const letter = String.fromCharCode(65 + j);
                  const selected = response.includes(letter);
                  return (
                    <button key={j} type="button" onClick={() => toggleLetter(letter)}
                      className={`w-full text-left text-sm p-2.5 rounded-md border transition-colors ${
                        selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/50'
                      }`}>
                      <span className="font-medium mr-1.5">{letter}.</span>{o}
                    </button>
                  );
                })}
              </div>
            ) : (
              <Textarea value={response} onChange={e => setResponse(e.target.value)}
                placeholder="输入你的答案…" disabled={checked} rows={3} />
            )}

            {checked && (
              <div className="p-3 rounded-md bg-muted/40 border border-border space-y-1">
                <p className={`text-sm flex items-center gap-1.5 ${results[current.id] ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {results[current.id] ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {results[current.id] ? '回答正确' : `回答错误，正确答案：${current.answer || '—'}`}
                </p>
                {current.explanation && <p className="text-xs text-muted-foreground leading-relaxed">解析：{current.explanation}</p>}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              {!checked
                ? <Button size="sm" onClick={check} disabled={!response.trim()}>提交答案</Button>
                : <Button size="sm" onClick={next} className="gap-1">
                    {idx + 1 >= list.length ? '查看结果' : '下一题'} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>}
            </div>
          </div>
        )}

        {/* 结果页 */}
        {done && (
          <div className="space-y-3 text-center py-6">
            <p className="text-2xl font-semibold text-foreground">{correctCount} / {list.length}</p>
            <p className="text-sm text-muted-foreground">
              正确率 {list.length ? Math.round((correctCount / list.length) * 100) : 0}%
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" className="gap-1"
                onClick={() => { setStarted(false); setIdx(0); setResults({}); }}>
                <RotateCcw className="w-3.5 h-3.5" /> 返回清单
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>完成</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
