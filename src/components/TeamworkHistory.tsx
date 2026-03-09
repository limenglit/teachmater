import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { History, Trash2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface HistoryItem {
  id: string;
  title: string;
  type: 'groups' | 'teams';
  data: any[];
  student_count: number;
  created_at: string;
}

interface Props {
  type: 'groups' | 'teams';
  onRestore: (data: any[]) => void;
}

export default function TeamworkHistory({ type, onRestore }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teamwork_history')
        .select('*')
        .eq('type', type)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setHistory((data || []) as HistoryItem[]);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchHistory();
    }
  }, [open, user, type]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('teamwork_history')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setHistory(prev => prev.filter(h => h.id !== id));
      toast.success(t('teamwork.historyDeleted'));
    } catch (err) {
      toast.error(t('teamwork.historyDeleteFailed'));
    }
  };

  const handleRestore = (item: HistoryItem) => {
    onRestore(item.data);
    setOpen(false);
    toast.success(t('teamwork.historyRestored'));
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">{t('teamwork.history')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {t('teamwork.historyTitle')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto -mx-6 px-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('teamwork.noHistory')}
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.data.length} {type === 'groups' ? t('teamwork.groupsCount') : t('teamwork.teamsCount')} · {item.student_count} {t('common.persons')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRestore(item)}
                      title={t('teamwork.restore')}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
