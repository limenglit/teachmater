import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Clock, ArrowLeft, Shield, Loader2 } from 'lucide-react';
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
  const navigate = useNavigate();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    loadUsers();
  }, [user]);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_pending_users');
    if (error) {
      toast({ title: '无权限访问', description: '仅管理员可查看', variant: 'destructive' });
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
      toast({ title: '操作失败', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '已批准' });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, status: 'approved' } : u));
    }
    setActing(null);
  };

  const handleReject = async (userId: string) => {
    setActing(userId);
    const { error } = await supabase.rpc('reject_user', { p_user_id: userId });
    if (error) {
      toast({ title: '操作失败', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '已拒绝' });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, status: 'rejected' } : u));
    }
    setActing(null);
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved');
  const rejectedUsers = users.filter(u => u.status === 'rejected');

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning"><Clock className="w-3 h-3" />待审批</span>;
      case 'approved': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/10 text-success"><CheckCircle2 className="w-3 h-3" />已批准</span>;
      case 'rejected': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive"><XCircle className="w-3 h-3" />已拒绝</span>;
    }
  };

  const renderUserRow = (u: PendingUser) => (
    <div key={u.user_id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
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
      {u.status === 'pending' && (
        <div className="flex gap-1.5 ml-3">
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => handleApprove(u.user_id)}
            disabled={acting === u.user_id}
          >
            <CheckCircle2 className="w-3 h-3" /> 批准
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => handleReject(u.user_id)}
            disabled={acting === u.user_id}
          >
            <XCircle className="w-3 h-3" /> 拒绝
          </Button>
        </div>
      )}
      {u.status === 'rejected' && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 ml-3"
          onClick={() => handleApprove(u.user_id)}
          disabled={acting === u.user_id}
        >
          <CheckCircle2 className="w-3 h-3" /> 改为批准
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">用户管理</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> 返回
        </Button>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {pendingUsers.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warning" /> 待审批 ({pendingUsers.length})
                </h2>
                <div className="space-y-2">{pendingUsers.map(renderUserRow)}</div>
              </section>
            )}

            {pendingUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无待审批用户
              </div>
            )}

            {approvedUsers.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" /> 已批准 ({approvedUsers.length})
                </h2>
                <div className="space-y-2">{approvedUsers.map(renderUserRow)}</div>
              </section>
            )}

            {rejectedUsers.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" /> 已拒绝 ({rejectedUsers.length})
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
