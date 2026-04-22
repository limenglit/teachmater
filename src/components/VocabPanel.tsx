import { useEffect, useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BookOpen, Plus, Loader2, LogIn, Edit2, Trash2, Send, Undo2, Play, Search, Globe2, FolderHeart,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  listMySets, listPlatformSets, deleteSet, submitSet, withdrawSet, audienceLabel,
  type VocabSet, type VocabSetWithCount,
} from '@/lib/vocab-cloud';
import VocabStatusBadge from './vocab/VocabStatusBadge';
import VocabSetWizard from './vocab/VocabSetWizard';
import VocabPlayer from './vocab/VocabPlayer';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type SubTab = 'mine' | 'platform';

export default function VocabPanel() {
  const { user, approvalStatus } = useAuth();
  const navigate = useNavigate();
  const isApproved = !!user && approvalStatus === 'approved';

  const [tab, setTab] = useState<SubTab>(isApproved ? 'mine' : 'platform');
  const [mine, setMine] = useState<VocabSetWithCount[]>([]);
  const [platform, setPlatform] = useState<VocabSetWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<VocabSet | null>(null);
  const [playing, setPlaying] = useState<VocabSet | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<unknown>[] = [
        listPlatformSets().then(r => setPlatform(r)),
      ];
      if (isApproved) tasks.push(listMySets().then(r => setMine(r)));
      else setMine([]);
      await Promise.all(tasks);
    } catch (e: any) {
      toast.error('加载词库失败：' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  }, [isApproved]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDelete = async (s: VocabSet) => {
    try {
      await deleteSet(s.id);
      toast.success('已删除');
      loadAll();
    } catch (e: any) {
      toast.error('删除失败：' + (e.message || ''));
    }
  };

  const handleSubmit = async (s: VocabSet) => {
    try {
      await submitSet(s.id);
      toast.success('已提交，等待管理员审核');
      loadAll();
    } catch (e: any) {
      toast.error('提交失败：' + (e.message || ''));
    }
  };

  const handleWithdraw = async (s: VocabSet) => {
    try {
      await withdrawSet(s.id);
      toast.success('已撤回为私有');
      loadAll();
    } catch (e: any) {
      toast.error('撤回失败：' + (e.message || ''));
    }
  };

  const filtered = useMemo(() => {
    const list = tab === 'mine' ? mine : platform;
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      audienceLabel(s.audience).toLowerCase().includes(q),
    );
  }, [tab, mine, platform, search]);

  // Login prompt for guests trying mine tab
  if (!isApproved && tab === 'mine') {
    setTab('platform');
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">词库中心</h1>
        </div>
        {isApproved ? (
          <Button onClick={() => { setEditing(null); setWizardOpen(true); }} className="gap-1">
            <Plus className="w-4 h-4" /> 创建词库
          </Button>
        ) : (
          <Button variant="outline" onClick={() => navigate('/auth')} className="gap-1">
            <LogIn className="w-4 h-4" /> 登录后创建
          </Button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-2">
        <Button
          size="sm"
          variant={tab === 'platform' ? 'default' : 'ghost'}
          className="gap-1.5 text-xs"
          onClick={() => setTab('platform')}
        >
          <Globe2 className="w-3.5 h-3.5" /> 平台库 ({platform.length})
        </Button>
        {isApproved && (
          <Button
            size="sm"
            variant={tab === 'mine' ? 'default' : 'ghost'}
            className="gap-1.5 text-xs"
            onClick={() => setTab('mine')}
          >
            <FolderHeart className="w-3.5 h-3.5" /> 我的词库 ({mine.length})
          </Button>
        )}
        <div className="ml-auto relative w-48 sm:w-64">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索词库…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> 加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {tab === 'mine' ? '尚未创建词库，点击右上角"创建词库"' : '暂无平台词库'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => (
            <VocabSetCard
              key={s.id}
              set={s}
              isMine={tab === 'mine'}
              onPlay={() => setPlaying(s)}
              onEdit={() => { setEditing(s); setWizardOpen(true); }}
              onDelete={() => handleDelete(s)}
              onSubmit={() => handleSubmit(s)}
              onWithdraw={() => handleWithdraw(s)}
            />
          ))}
        </div>
      )}

      <VocabSetWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        editing={editing}
        onSaved={loadAll}
      />
      {playing && <VocabPlayer set={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

interface CardProps {
  set: VocabSetWithCount;
  isMine: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
}

function VocabSetCard({ set, isMine, onPlay, onEdit, onDelete, onSubmit, onWithdraw }: CardProps) {
  const editable = set.status === 'private' || set.status === 'rejected';
  const canSubmit = set.status === 'private' || set.status === 'rejected';
  const canWithdraw = set.status === 'pending';

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-foreground truncate">{set.title || '未命名'}</h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {audienceLabel(set.audience)}
            </span>
            <VocabStatusBadge status={set.status} isSystem={set.is_system} />
            <span className="text-[10px] text-muted-foreground">{set.card_count} 项</span>
          </div>
        </div>
      </div>

      {set.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{set.description}</p>
      )}

      {set.status === 'rejected' && set.reject_reason && (
        <div className="text-[11px] bg-destructive/10 text-destructive rounded p-2">
          拒绝原因：{set.reject_reason}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pt-1 mt-auto">
        <Button size="sm" onClick={onPlay} className="h-7 text-xs gap-1 flex-1">
          <Play className="w-3 h-3" /> 学习
        </Button>
        {isMine && editable && (
          <Button size="sm" variant="outline" onClick={onEdit} className="h-7 text-xs gap-1">
            <Edit2 className="w-3 h-3" />
          </Button>
        )}
        {isMine && canSubmit && (
          <Button size="sm" variant="outline" onClick={onSubmit} className="h-7 text-xs gap-1">
            <Send className="w-3 h-3" /> 提交
          </Button>
        )}
        {isMine && canWithdraw && (
          <Button size="sm" variant="outline" onClick={onWithdraw} className="h-7 text-xs gap-1">
            <Undo2 className="w-3 h-3" /> 撤回
          </Button>
        )}
        {isMine && !set.is_system && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10">
                <Trash2 className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除词库？</AlertDialogTitle>
                <AlertDialogDescription>
                  将永久删除"{set.title}"及其全部知识点，无法恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
