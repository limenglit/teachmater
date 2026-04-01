import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, Search, Cpu } from 'lucide-react';

interface UserWithLimit {
  user_id: string;
  email: string;
  nickname: string;
  status: string;
  daily_limit: number | null;
}

export default function AdminAIQuotaPanel() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserWithLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchLimit, setBatchLimit] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState<string>('');

  useEffect(() => { void loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_get_users_with_limits' as any);
    if (!error && data) {
      setUsers((data as any) as UserWithLimit[]);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => u.email.toLowerCase().includes(q) || (u.nickname && u.nickname.toLowerCase().includes(q)));
  }, [users, search]);

  const toggleSelect = useCallback((uid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const ids = filtered.map(u => u.user_id);
      const allSelected = ids.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }, [filtered]);

  const handleBatchSet = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) { toast({ title: t('admin.aiQuota.selectUsers'), variant: 'destructive' }); return; }
    const limit = parseInt(batchLimit);
    if (isNaN(limit)) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_set_ai_limits' as any, { p_user_ids: ids, p_daily_limit: limit } as any);
    setSaving(false);
    if (error) {
      toast({ title: t('admin.aiQuota.setFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('admin.aiQuota.setSuccess') });
      setUsers(prev => prev.map(u => ids.includes(u.user_id) ? { ...u, daily_limit: limit } : u));
      setSelected(new Set());
      setBatchLimit('');
    }
  };

  const handleIndividualSet = async (userId: string) => {
    const limit = parseInt(editLimit);
    if (isNaN(limit)) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_set_ai_limits' as any, { p_user_ids: [userId], p_daily_limit: limit } as any);
    setSaving(false);
    if (error) {
      toast({ title: t('admin.aiQuota.setFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('admin.aiQuota.setSuccess') });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, daily_limit: limit } : u));
      setEditingUser(null);
    }
  };

  const handleResetUser = async (userId: string) => {
    setSaving(true);
    const { error } = await supabase.from('user_ai_limits' as any).delete().eq('user_id', userId);
    setSaving(false);
    if (!error) {
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, daily_limit: null } : u));
      toast({ title: t('admin.aiQuota.setSuccess') });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">{t('admin.aiQuota.title')}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.aiQuota.desc')}</p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('admin.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg border border-border">
          <span className="text-sm text-foreground font-medium">{t('admin.selected').replace('{0}', String(selected.size))}</span>
          <div className="flex gap-2 ml-auto items-center">
            <Input
              type="number" min={-1} value={batchLimit}
              onChange={e => setBatchLimit(e.target.value)}
              placeholder={t('admin.aiQuota.inputLimit')}
              className="w-32 h-7 text-xs"
            />
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleBatchSet} disabled={saving || !batchLimit}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {t('admin.aiQuota.apply')}
            </Button>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Checkbox checked={filtered.length > 0 && filtered.every(u => selected.has(u.user_id))} onCheckedChange={toggleAll} />
          <span className="text-xs text-muted-foreground">{t('admin.selectAll')}</span>
        </div>
        {filtered.map(u => (
          <div key={u.user_id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Checkbox checked={selected.has(u.user_id)} onCheckedChange={() => toggleSelect(u.user_id)} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">{u.email}</span>
                {u.nickname && <span className="text-xs text-muted-foreground">{u.nickname}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3">
              {editingUser === u.user_id ? (
                <>
                  <Input
                    type="number" min={-1} value={editLimit}
                    onChange={e => setEditLimit(e.target.value)}
                    className="w-20 h-7 text-xs text-center"
                    autoFocus
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleIndividualSet(u.user_id)} disabled={saving}>
                    {t('admin.aiQuota.apply')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingUser(null)}>✕</Button>
                </>
              ) : (
                <>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.daily_limit != null ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {u.daily_limit != null ? (u.daily_limit === -1 ? t('sysconfig.unlimited') : `${u.daily_limit} ${t('sysconfig.perDay')}`) : t('admin.aiQuota.noLimit')}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingUser(u.user_id); setEditLimit(String(u.daily_limit ?? '')); }}>
                    {t('admin.aiQuota.individual')}
                  </Button>
                  {u.daily_limit != null && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleResetUser(u.user_id)}>
                      {t('admin.aiQuota.reset')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
