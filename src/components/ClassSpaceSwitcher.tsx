import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { setActiveClassId, useActiveClassId } from '@/lib/class-space';

interface ClassRow { id: string; name: string; college_id: string; sort_order: number }
interface CollegeRow { id: string; name: string; sort_order: number }

/** Top-bar class switcher. Signed-in teachers only. */
export default function ClassSpaceSwitcher() {
  const { user } = useAuth();
  const active = useActiveClassId();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [colleges, setColleges] = useState<CollegeRow[]>([]);

  useEffect(() => {
    if (!user) { setClasses([]); return; }
    let cancelled = false;
    (async () => {
      const [c, g] = await Promise.all([
        supabase.from('classes').select('id, name, college_id, sort_order').eq('user_id', user.id),
        supabase.from('colleges').select('id, name, sort_order').eq('user_id', user.id),
      ]);
      if (cancelled) return;
      const list = (c.data || []) as ClassRow[];
      setClasses(list);
      setColleges((g.data || []) as CollegeRow[]);
      if (active && !list.some(x => x.id === active)) setActiveClassId(null);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!user) return null;

  const groups = [...colleges]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(g => ({ g, items: classes.filter(c => c.college_id === g.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }))
    .filter(x => x.items.length > 0);

  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
      <span className="hidden sm:inline">班级</span>
      <select
        aria-label="切换当前班级"
        value={active ?? ''}
        onChange={e => setActiveClassId(e.target.value || null)}
        className="h-8 max-w-[140px] rounded-md border border-border bg-background px-2 text-xs text-foreground"
      >
        <option value="">未分班</option>
        {groups.map(({ g, items }) => (
          <optgroup key={g.id} label={g.name}>
            {items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
