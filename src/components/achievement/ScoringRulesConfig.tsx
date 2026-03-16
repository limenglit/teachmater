import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Settings2, Save, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type ScoringRules, type DimensionKey, DEFAULT_RULES, DIMENSION_KEYS } from './analyticsTypes';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: ScoringRules;
  onRulesChange: (rules: ScoringRules) => void;
}

export default function ScoringRulesConfig({ open, onOpenChange, rules, onRulesChange }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [draft, setDraft] = useState<ScoringRules>(rules);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(rules);
  }, [rules, open]);

  const totalWeight = DIMENSION_KEYS.reduce((s, k) => s + (draft[k].enabled ? draft[k].weight : 0), 0);

  const updateDimension = (key: DimensionKey, field: string, value: unknown) => {
    setDraft(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!user) {
      toast({ title: t('analytics.loginRequired'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('scoring_rules' as any).upsert({
        user_id: user.id,
        rules: draft as any,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }) as any;
      if (error) throw error;
      onRulesChange(draft);
      onOpenChange(false);
      toast({ title: t('analytics.rulesSaved') });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft(DEFAULT_RULES);
  };

  const getDimensionLabel = (key: DimensionKey) => t(`analytics.dim_${key}`);
  const getDimensionDesc = (key: DimensionKey) => t(`analytics.dim_${key}_desc`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            {t('analytics.rulesConfig')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">{t('analytics.rulesDesc')}</p>

          {DIMENSION_KEYS.map(key => (
            <div key={key} className={`p-3 rounded-lg border transition-all ${draft[key].enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <span className="font-medium text-sm text-foreground">{getDimensionLabel(key)}</span>
                  <p className="text-xs text-muted-foreground">{getDimensionDesc(key)}</p>
                </div>
                <Switch
                  checked={draft[key].enabled}
                  onCheckedChange={v => updateDimension(key, 'enabled', v)}
                />
              </div>
              {draft[key].enabled && (
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {key === 'board_quality' ? t('analytics.perLike') : t('analytics.perAction')}
                    <Input
                      type="number"
                      min={0}
                      value={key === 'board_quality' ? (draft[key].points_per_like ?? 1) : (draft[key].points_per ?? 1)}
                      onChange={e => updateDimension(key, key === 'board_quality' ? 'points_per_like' : 'points_per', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 h-7 text-xs text-center"
                    />
                    {t('analytics.pts')}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t('analytics.weight')}
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft[key].weight}
                      onChange={e => updateDimension(key, 'weight', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      className="w-16 h-7 text-xs text-center"
                    />
                    %
                  </label>
                </div>
              )}
            </div>
          ))}

          <div className={`text-sm font-medium text-center py-2 rounded-lg ${totalWeight === 100 ? 'text-green-600 bg-green-50 dark:bg-green-900/10' : 'text-amber-600 bg-amber-50 dark:bg-amber-900/10'}`}>
            {t('analytics.totalWeight')}: {totalWeight}% {totalWeight !== 100 && `(${t('analytics.shouldBe100')})`}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
              <RotateCcw className="w-3 h-3" /> {t('analytics.resetDefault')}
            </Button>
            <Button className="flex-1 gap-1" onClick={handleSave} disabled={saving}>
              <Save className="w-3 h-3" /> {saving ? t('common.loading') : t('analytics.saveRules')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
