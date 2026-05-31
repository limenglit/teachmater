import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, Search, FileText } from 'lucide-react';

interface UserWithPageLimit {
  user_id: string;
  email: string;
  nickname: string;
  status: string;
  page_limit: number | null;
  pages_used: number;
}

export default function AdminPagesQuotaPanel() {
  const [users, setUsers] = useState<UserWithPageLimit[]>([]);
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
    const { data, error } = await supabase.rpc('admin_get_users_with_page_limits' as any);
    if (error) {
      toast({ title: '加载失败', description: error.message, variant: 'destructive' });
    } else {
      setUsers(((data as any) || []) as UserWithPageLimit[]);
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

  const applyLimit = async (ids: string[], limit: number) => {
    setSaving(true);
    const { error } = await supabase.rpc('admin_set_page_limits' as any, { p_user_ids: ids, p_page_limit: limit } as any);
    setSaving(false);
    if (error) {
      toast({ title: '设置失败', description: error.message, variant: 'destructive' });
      return false;
    }
    setUsers(prev => prev.map(u => ids.includes(u.user_id) ? { ...u, page_limit: limit } : u));
    toast({ title: '已更新' });
    return true;
  };

  const handleBatchSet = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) { toast({ title: '请先选择用户', variant: 'destructive' }); return; }
    const limit = parseInt(batchLimit);
    if (isNaN(limit)) return;
    const ok = await applyLimit(ids, limit);
    if (ok) { setSelected(new Set()); setBatchLimit(''); }
  };

  const handleIndividualSet = async (userId: string) => {
    const limit = parseInt(editLimit);
    if (isNaN(limit)) return;
    const ok = await applyLimit([userId], limit);
    if (ok) setEditingUser(null);
  };

  const handleResetUser = async (userId: string) => {
    setSaving(true);
    const { error } = await supabase.from('user_page_limits' as any).delete().eq('user_id', userId);
    setSaving(false);
    if (!error) {
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, page_limit: null } : u));
      toast({ title: '已恢复默认' });
    } else {
      toast({ title: '操作失败', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const formatLimit = (l: number | null) => {
    if (l == null) return '默认（5 个）';
    if (l === -1) return '不限';
    return `${l} 个`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Page 发布数量配置</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        每位注册用户默认可发布 5 个页面。可单独或批量调整：输入 -1 表示不限制，输入 0 表示禁止发布新页面。
      </p>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input placeholder="搜索邮箱或昵称" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg border border-border">
          <span className="text-sm text-foreground font-medium">已选 {selected.size} 人</span>
          <div className="flex gap-2 ml-auto items-center">
            <Input
              type="number" min={-1} value={batchLimit}
              onChange={e => setBatchLimit(e.target.value)}
              placeholder="数量上限"
              className="w-32 h-7 text-xs"
            />
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleBatchSet} disabled={saving || batchLimit === ''}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              批量应用
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Checkbox checked={filtered.length > 0 && filtered.every(u => selected.has(u.user_id))} onCheckedChange={toggleAll} />
          <span className="text-xs text-muted-foreground">全选当前列表</span>
        </div>
        {filtered.map(u => (
          <div key={u.user_id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Checkbox checked={selected.has(u.user_id)} onCheckedChange={() => toggleSelect(u.user_id)} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">{u.email}</span>
                <span className="text-xs text-muted-foreground">
                  {u.nickname ? `${u.nickname} · ` : ''}已发布 {u.pages_used} 个
                </span>
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
                    应用
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingUser(null)}>✕</Button>
                </>
              ) : (
                <>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.page_limit != null ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {formatLimit(u.page_limit)}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingUser(u.user_id); setEditLimit(String(u.page_limit ?? '')); }}>
                    设置
                  </Button>
                  {u.page_limit != null && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleResetUser(u.user_id)}>
                      恢复默认
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
