import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, Settings2 } from 'lucide-react';
import type { SystemConfig, FeatureFlags } from '@/contexts/FeatureConfigContext';
import { setSystemRequireSeatAssignmentBeforeCheckin } from '@/lib/seat-checkin-policy';

const FEATURE_KEYS: { key: keyof Omit<FeatureFlags, 'ai_daily_limit'>; emoji: string; labelKey: string }[] = [
  { key: 'random', emoji: '🎲', labelKey: 'tab.random' },
  { key: 'teamwork', emoji: '👥', labelKey: 'tab.teamwork' },
  { key: 'seats', emoji: '🏫', labelKey: 'tab.seats' },
  { key: 'board', emoji: '🎨', labelKey: 'tab.board' },
  { key: 'quiz', emoji: '📝', labelKey: 'tab.quiz' },
  { key: 'sketch', emoji: '✏️', labelKey: 'tab.sketch' },
  { key: 'ppt', emoji: '📊', labelKey: 'tab.ppt' },
  { key: 'visual', emoji: '📐', labelKey: 'tab.visual' },
  { key: 'achieve', emoji: '🏆', labelKey: 'tab.achieve' },
  { key: 'toolkit', emoji: '🧰', labelKey: 'tab.toolkit' },
];

const DEFAULT_CONFIG: SystemConfig = {
  guest: {
    random: true, teamwork: true, seats: true, board: true, quiz: true,
    sketch: true, ppt: true, visual: true, achieve: true, toolkit: true,
    ai_daily_limit: 5,
  },
  registered: {
    random: true, teamwork: true, seats: true, board: true, quiz: true,
    sketch: true, ppt: true, visual: true, achieve: true, toolkit: true,
    ai_daily_limit: -1,
  },
  checkinPolicy: {
    require_seat_assignment_before_checkin: true,
  },
};

export default function AdminConfigPanel() {
  const { t } = useLanguage();
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    void loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_config' as any)
      .select('*')
      .limit(1)
      .single();
    if (!error && data) {
      const d = data as any;
      setConfigId(d.id);
      if (d.config && typeof d.config === 'object') {
        setConfig({
          guest: { ...DEFAULT_CONFIG.guest, ...d.config.guest },
          registered: { ...DEFAULT_CONFIG.registered, ...d.config.registered },
          checkinPolicy: {
            ...DEFAULT_CONFIG.checkinPolicy,
            ...((d.config as any).checkinPolicy || {}),
          },
        });
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!configId) return;
    setSaving(true);
    const { error } = await supabase
      .from('system_config' as any)
      .update({ config, updated_at: new Date().toISOString() } as any)
      .eq('id', configId);
    setSaving(false);
    if (error) {
      toast({ title: t('sysconfig.saveFailed'), description: error.message, variant: 'destructive' });
    } else {
      setSystemRequireSeatAssignmentBeforeCheckin(config.checkinPolicy.require_seat_assignment_before_checkin);
      toast({ title: t('sysconfig.saved') });
    }
  };

  const toggleSeatCheckinPolicy = () => {
    setConfig(prev => ({
      ...prev,
      checkinPolicy: {
        ...prev.checkinPolicy,
        require_seat_assignment_before_checkin: !prev.checkinPolicy.require_seat_assignment_before_checkin,
      },
    }));
  };

  const toggleFeature = (userType: 'guest' | 'registered', key: keyof Omit<FeatureFlags, 'ai_daily_limit'>) => {
    setConfig(prev => ({
      ...prev,
      [userType]: { ...prev[userType], [key]: !prev[userType][key] },
    }));
  };

  const setAILimit = (userType: 'guest' | 'registered', value: number) => {
    setConfig(prev => ({
      ...prev,
      [userType]: { ...prev[userType], ai_daily_limit: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderUserTypeSection = (userType: 'guest' | 'registered', label: string) => (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        {userType === 'guest' ? '👤' : '✅'} {label}
      </h3>

      {/* Feature toggles */}
      <div className="space-y-2 mb-4">
        <p className="text-xs text-muted-foreground font-medium">{t('sysconfig.featureAccess')}</p>
        <div className="grid grid-cols-2 gap-2">
          {FEATURE_KEYS.map(({ key, emoji, labelKey }) => (
            <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
              <span className="text-xs flex items-center gap-1.5">
                <span>{emoji}</span>
                <span>{t(labelKey)}</span>
              </span>
              <Switch
                checked={config[userType][key]}
                onCheckedChange={() => toggleFeature(userType, key)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* AI limit */}
      <div className="flex items-center gap-3 p-2 rounded-lg bg-surface border border-border">
        <span className="text-xs flex items-center gap-1.5 flex-1">
          <span>🤖</span>
          <span>{t('sysconfig.aiLimit')}</span>
        </span>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={config[userType].ai_daily_limit}
            onChange={e => setAILimit(userType, parseInt(e.target.value) || 0)}
            className="w-20 h-7 text-xs text-center"
            min={-1}
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {config[userType].ai_daily_limit === -1 ? t('sysconfig.unlimited') : t('sysconfig.perDay')}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          {t('sysconfig.title')}
        </h2>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {t('sysconfig.save')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('sysconfig.desc')}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderUserTypeSection('guest', t('sysconfig.guest'))}
        {renderUserTypeSection('registered', t('sysconfig.registered'))}
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">签到策略</h3>
        <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
          <div className="text-xs">
            <p className="font-medium text-foreground">签到前需完成排座</p>
            <p className="text-muted-foreground mt-0.5">缺省开启。关闭后可无需排座直接发起签到。</p>
          </div>
          <Switch
            checked={config.checkinPolicy.require_seat_assignment_before_checkin}
            onCheckedChange={toggleSeatCheckinPolicy}
          />
        </div>
      </div>
    </div>
  );
}
