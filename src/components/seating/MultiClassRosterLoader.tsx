import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Users, Loader2 } from 'lucide-react';
import {
  buildStudentsFromClasses,
  combinedClassLabel,
  type ClassRosterSelection,
} from '@/lib/seat-roster-merge';
import { setActiveClassName } from '@/lib/class-context';

interface ClassEntry extends ClassRosterSelection {
  id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Load one or several classes (across colleges / schools) into the workspace
 * roster used by the seat scenes. Supports append (merge multiple classes into
 * one seating plan) or replace, with optional 姓名+学号 de-duplication.
 */
export default function MultiClassRosterLoader({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { students, appendStudents, replaceStudents } = useStudents();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [dedupe, setDedupe] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: colleges }, { data: cls }, { data: cs }] = await Promise.all([
        supabase.from('colleges').select('id, name').eq('user_id', user.id),
        supabase.from('classes').select('id, name, college_id').eq('user_id', user.id),
        supabase
          .from('class_students')
          .select('class_id, name, student_number')
          .eq('user_id', user.id)
          .limit(20000),
      ]);
      if (cancelled) return;
      setClasses(
        (cls || []).map(c => ({
          id: c.id,
          className: c.name,
          collegeName: colleges?.find(col => col.id === c.college_id)?.name || '',
          students: (cs || [])
            .filter(s => s.class_id === c.id)
            .map(s => ({ name: s.name, studentNumber: s.student_number })),
        })),
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  const grouped = useMemo(() => {
    const map = new Map<string, ClassEntry[]>();
    classes.forEach(c => {
      const key = c.collegeName || t('seat.roster.noCollege');
      map.set(key, [...(map.get(key) || []), c]);
    });
    return Array.from(map.entries());
  }, [classes, t]);

  const selected = classes.filter(c => selectedIds.includes(c.id));
  const selectedCount = selected.reduce((sum, c) => sum + c.students.length, 0);

  const toggle = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const confirm = () => {
    if (selected.length === 0) {
      toast.error(t('seat.roster.pickAtLeastOne'));
      return;
    }
    const incoming = buildStudentsFromClasses(selected, { dedupe });
    const result = importMode === 'replace' ? replaceStudents(incoming) : appendStudents(incoming);
    setActiveClassName(combinedClassLabel(selected));
    toast.success(
      `${t('seat.roster.loaded')}: +${result.added} / ${t('sidebar.persons')} ${result.total}`,
    );
    setSelectedIds([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('seat.roster.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('seat.roster.desc')}</p>

        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={importMode === 'append'}
              onChange={() => setImportMode('append')}
            />
            <span>{t('seat.roster.append')} {students.length})</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={importMode === 'replace'}
              onChange={() => setImportMode('replace')}
            />
            <span>{t('seat.roster.replace')}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={dedupe} onCheckedChange={v => setDedupe(!!v)} />
            <span>{t('seat.roster.dedupe')}</span>
          </label>
        </div>

        <div className="space-y-3 mt-3">
          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {!loading && grouped.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('sidebar.noStudents')}</p>
          )}
          {grouped.map(([collegeName, items]) => (
            <div key={collegeName}>
              <div className="text-xs font-medium text-muted-foreground mb-1">{collegeName}</div>
              <div className="space-y-1.5">
                {items.map(cls => (
                  <label
                    key={cls.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.includes(cls.id)}
                        onCheckedChange={() => toggle(cls.id)}
                      />
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm text-foreground">{cls.className}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cls.students.length} {t('sidebar.persons')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 mt-4">
          <span className="text-xs text-muted-foreground">
            {t('seat.roster.selectedSummary')
              .replace('{classes}', String(selected.length))
              .replace('{count}', String(selectedCount))}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={confirm}>{t('seat.roster.confirm')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
