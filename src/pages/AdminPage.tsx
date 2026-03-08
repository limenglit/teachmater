import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Clock, ArrowLeft, Shield, Loader2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PendingUser {
  user_id: string;
  email: string;
  nickname: string;
  status: string;
  created_at: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchActing, setBatchActing] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    const timer = setTimeout(() => {
      void loadUsers(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [user, navigate]);

  const ensureSessionReady = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session;
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return null;
    return data.session;
  };

  const loadUsers = async (attempt: number) => {
    if (attempt === 0) setLoading(true);
    const session = await ensureSessionReady();
    if (!session) {
      if (attempt < 2) {
        setTimeout(() => { void loadUsers(attempt + 1); }, 800);
        return;
      }
      setLoading(false);
      toast({ title: t('admin.sessionExpired'), description: t('admin.pleaseRelogin'), variant: 'destructive' });
      navigate('/auth');
      return;
    }
    const { data, error } = await supabase.rpc('get_pending_users');
    if (error) {
      const msg = (error.message || '').toLowerCase();
      const transientAuthError = msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('permission');
      if (attempt < 2 && transientAuthError) {
        await supabase.auth.refreshSession();
        setTimeout(() => { void loadUsers(attempt + 1); }, 800);
        return;
      }
      setLoading(false);
      toast({ title: t('admin.noPermission'), description: t('admin.adminOnly'), variant: 'destructive' });
      navigate('/');
      return;
    }
    setUsers((data as PendingUser[]) || []);
    setLoading(false);
  };

  const handleApprove = async (userId: string) => {
    setActing(userId);
    const { error } = await supabase.rpc('approve_user', { p_user_id: userId });
    if (error) {
      toast({ title: t('admin.operationFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('admin.approved') });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, status: 'approved' } : u));
    }
    setActing(null);
  };

  const handleReject = async (userId: string) => {
    setActing(userId);
    const { error } = await supabase.rpc('reject_user', { p_user_id: userId });
    if (error) {
      toast({ title: t('admin.operationFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('admin.rejected') });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, status: 'rejected' } : u));
    }
    setActing(null);
  };

  const toggleSelect = useCallback((userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((userIds: string[]) => {
    setSelected(prev => {
      const allSelected = userIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        userIds.forEach(id => next.delete(id));
      } else {
        userIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, []);

  const handleBatchAction = async (action: 'approve' | 'reject') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBatchActing(true);
    const rpcName = action === 'approve' ? 'approve_user' : 'reject_user';
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    let successCount = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc(rpcName, { p_user_id: id });
      if (!error) successCount++;
    }
    setUsers(prev => prev.map(u => ids.includes(u.user_id) ? { ...u, status: newStatus } : u));
    setSelected(new Set());
    setBatchActing(false);
    const actionLabel = action === 'approve' ? t('admin.approved') : t('admin.rejected');
    toast({ title: t('admin.batchResult').replace('{0}', actionLabel).replace('{1}', String(successCount)) });
  };

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u => u.email.toLowerCase().includes(q) || (u.nickname && u.nickname.toLowerCase().includes(q)));
    }
    if (filter !== 'all') {
      list = list.filter(u => u.status === filter);
    }
    return list;
  }, [users, search, filter]);

  const pendingUsers = filtered.filter(u => u.status === 'pending');
  const approvedUsers = filtered.filter(u => u.status === 'approved');
  const rejectedUsers = filtered.filter(u => u.status === 'rejected');

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning"><Clock className="w-3 h-3" />{t('admin.pending')}</span>;
      case 'approved': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/10 text-success"><CheckCircle2 className="w-3 h-3" />{t('admin.approved')}</span>;
      case 'rejected': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive"><XCircle className="w-3 h-3" />{t('admin.rejected')}</span>;
    }
  };

  const filterLabels: Record<string, string> = {
    all: t('admin.all'),
    pending: t('admin.pending'),
    approved: t('admin.approved'),
    rejected: t('admin.rejected'),
  };

  const renderUserRow = (u: PendingUser) => (
    <div key={u.user_id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Checkbox
          checked={selected.has(u.user_id)}
          onCheckedChange={() => toggleSelect(u.user_id)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{u.email}</span>
            {statusBadge(u.status)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {u.nickname && <span>{u.nickname} · </span>}
            {new Date(u.created_at).toLocaleString()}
          </div>
        </div>
      </div>
      {u.status === 'pending' && (
        <div className="flex gap-1.5 ml-3">
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleApprove(u.user_id)} disabled={acting === u.user_id}>
            <CheckCircle2 className="w-3 h-3" /> {t('admin.approve')}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleReject(u.user_id)} disabled={acting === u.user_id}>
            <XCircle className="w-3 h-3" /> {t('admin.reject')}
          </Button>
        </div>
      )}
      {u.status === 'rejected' && (
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 ml-3" onClick={() => handleApprove(u.user_id)} disabled={acting === u.user_id}>
          <CheckCircle2 className="w-3 h-3" /> {t('admin.changeToApprove')}
        </Button>
      )}
    </div>
  );

  const renderSectionHeader = (userList: PendingUser[]) => {
    const ids = userList.map(u => u.user_id);
    const allSelected = ids.length > 0 && ids.every(id => selected.has(id));
    return (
      <div className="flex items-center gap-2">
        <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(ids)} />
        <span>{t('admin.selectAll')}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">{t('admin.title')}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> {t('admin.back')}
        </Button>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('admin.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(key => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? 'default' : 'outline'}
                className="h-9 text-xs"
                onClick={() => setFilter(key)}
              >
                {filterLabels[key]}
              </Button>
            ))}
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg border border-border">
            <span className="text-sm text-foreground font-medium">{t('admin.selected').replace('{0}', String(selected.size))}</span>
            <div className="flex gap-1.5 ml-auto">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleBatchAction('approve')} disabled={batchActing}>
                {batchActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} {t('admin.batchApprove')}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleBatchAction('reject')} disabled={batchActing}>
                {batchActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} {t('admin.batchReject')}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {pendingUsers.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warning" /> {t('admin.pending')} ({pendingUsers.length})
                  <span className="ml-auto">{renderSectionHeader(pendingUsers)}</span>
                </h2>
                <div className="space-y-2">{pendingUsers.map(renderUserRow)}</div>
              </section>
            )}

            {pendingUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {t('admin.noPending')}
              </div>
            )}

            {approvedUsers.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" /> {t('admin.approved')} ({approvedUsers.length})
                  <span className="ml-auto">{renderSectionHeader(approvedUsers)}</span>
                </h2>
                <div className="space-y-2">{approvedUsers.map(renderUserRow)}</div>
              </section>
            )}

            {rejectedUsers.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" /> {t('admin.rejected')} ({rejectedUsers.length})
                  <span className="ml-auto">{renderSectionHeader(rejectedUsers)}</span>
                </h2>
                <div className="space-y-2">{rejectedUsers.map(renderUserRow)}</div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
