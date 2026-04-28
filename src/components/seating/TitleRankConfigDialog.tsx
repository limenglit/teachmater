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
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  value: string;
  onSave: (value: string) => void;
  sceneLabel?: string;
}

export default function TitleRankConfigDialog({ value, onSave, sceneLabel }: Props) {
  const { t } = useLanguage();
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
        <SlidersHorizontal className="w-4 h-4" /> {t('seat.titleRank.button')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('seat.titleRank.title')}</DialogTitle>
            <DialogDescription>
              {sceneLabel ? tFormat(t('seat.titleRank.descPrefix'), sceneLabel) : ''}{t('seat.titleRank.desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {TITLE_RANK_PRESETS.map(preset => (
                <Button key={preset.id} type="button" variant="outline" className="h-8 text-xs" onClick={() => setDraft(preset.content)}>
                  {tFormat(t('seat.titleRank.preset'), preset.label)}
                </Button>
              ))}
            </div>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              placeholder={t('seat.titleRank.placeholder')}
            />
            <div className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p>{t('seat.titleRank.previewTitle')}</p>
              <p className="mt-1 break-words">
                {previewRules.length > 0
                  ? previewRules.slice(0, 12).map(rule => `${rule.keyword}:${rule.score}`).join('  |  ')
                  : t('seat.titleRank.previewEmpty')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(DEFAULT_TITLE_RANK_RULE_TEXT)}>{t('seat.titleRank.restore')}</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('seat.titleRank.cancel')}</Button>
            <Button onClick={save}>{t('seat.titleRank.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
