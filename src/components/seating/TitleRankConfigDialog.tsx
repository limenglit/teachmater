import { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_TITLE_RANK_RULE_TEXT, parseTitleRankRules, TITLE_RANK_PRESETS } from '@/lib/title-rank';

interface Props {
  value: string;
  onSave: (value: string) => void;
  sceneLabel?: string;
}

export default function TitleRankConfigDialog({ value, onSave, sceneLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const previewRules = useMemo(() => parseTitleRankRules(draft), [draft]);

  const openDialog = () => {
    setDraft(value);
    setOpen(true);
  };

  const save = () => {
    onSave(draft.trim() ? draft : DEFAULT_TITLE_RANK_RULE_TEXT);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" onClick={openDialog} className="gap-2">
        <SlidersHorizontal className="w-4 h-4" /> 职务级别映射
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>配置职务级别映射</DialogTitle>
            <DialogDescription>
              {sceneLabel ? `当前场景：${sceneLabel}。` : ''}支持层级写法（局长 &gt; 处长 &gt; 科长）和分值写法（主任=85）。保存后会立即影响自动排座。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {TITLE_RANK_PRESETS.map(preset => (
                <Button key={preset.id} type="button" variant="outline" className="h-8 text-xs" onClick={() => setDraft(preset.content)}>
                  套用预设: {preset.label}
                </Button>
              ))}
            </div>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              placeholder="局长 > 处长 > 科长"
            />
            <div className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p>预览（按分值从高到低）：</p>
              <p className="mt-1 break-words">
                {previewRules.length > 0
                  ? previewRules.slice(0, 12).map(rule => `${rule.keyword}:${rule.score}`).join('  |  ')
                  : '暂无有效规则，保存后会使用默认规则。'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(DEFAULT_TITLE_RANK_RULE_TEXT)}>恢复默认</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>保存并生效</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
