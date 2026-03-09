import { useState, useEffect } from 'react';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/contexts/StudentContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users } from 'lucide-react';

interface ClassOption {
  id: string;
  name: string;
  collegeName: string;
  students: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (names: string[]) => void;
  currentCount?: number;
  onClear?: () => void;
}

export default function ClassRosterPicker({ open, onOpenChange, onSelect, currentCount, onClear }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students: sidebarStudents } = useStudents();
  const [classes, setClasses] = useState<ClassOption[]>([]);

  useEffect(() => {
    if (open && user) loadClasses();
  }, [open, user]);

  const loadClasses = async () => {
    if (!user) return;
    const [{ data: colleges }, { data: cls }, { data: cs }] = await Promise.all([
      supabase.from('colleges').select('id, name').eq('user_id', user.id),
      supabase.from('classes').select('id, name, college_id').eq('user_id', user.id),
      supabase.from('class_students').select('class_id, name').eq('user_id', user.id),
    ]);
    if (!cls) return;
    setClasses(cls.map(c => ({
      id: c.id,
      name: c.name,
      collegeName: colleges?.find(col => col.id === c.college_id)?.name || '',
      students: (cs || []).filter(s => s.class_id === c.id).map(s => s.name),
    })));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('board.selectClass')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('board.selectClassDesc')}</p>
        <div className="space-y-2 mt-2">
          {sidebarStudents.length > 0 && (
            <button
              onClick={() => { onSelect(sidebarStudents.map(s => s.name)); onOpenChange(false); }}
              className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{t('board.useSidebarList')}</span>
                </div>
                <span className="text-xs text-muted-foreground">{sidebarStudents.length} {t('sidebar.persons')}</span>
              </div>
            </button>
          )}

          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => { onSelect(cls.students); onOpenChange(false); }}
              className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              disabled={cls.students.length === 0}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">{cls.name}</span>
                  {cls.collegeName && <span className="text-xs text-muted-foreground ml-2">{cls.collegeName}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{cls.students.length} {t('sidebar.persons')}</span>
              </div>
            </button>
          ))}

          {classes.length === 0 && sidebarStudents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('sidebar.noStudents')}</p>
          )}

          {currentCount && currentCount > 0 && onClear && (
            <button
              onClick={() => { onClear(); onOpenChange(false); }}
              className="w-full text-left p-3 rounded-lg border border-destructive/30 hover:bg-destructive/5 transition-colors"
            >
              <span className="text-sm text-destructive">{t('board.noClass')}</span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
