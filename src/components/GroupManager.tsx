import { useState, useCallback, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Shuffle, Star, GripVertical, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import ExportButtons from '@/components/ExportButtons';
import TeamworkHistory from '@/components/TeamworkHistory';
import { toast } from 'sonner';

interface GroupMember { id: string; name: string; isLeader: boolean }
interface Group { id: string; name: string; members: GroupMember[] }

const GROUP_NAMES_ZH = ['一','二','三','四','五','六','七','八','九','十'];

export default function GroupManager() {
  const { students } = useStudents();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [groupCount, setGroupCount] = useState(4);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dragItem, setDragItem] = useState<{ groupId: string; memberIdx: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ groupId: string; memberIdx: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const autoGroup = useCallback(() => {
    if (students.length === 0) return;
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const newGroups: Group[] = Array.from({ length: groupCount }, (_, i) => ({
      id: `g_${i}`,
      name: t('group.namePrefix').replace('{0}', GROUP_NAMES_ZH[i] || String(i + 1)),
      members: [],
    }));
    shuffled.forEach((s, i) => {
      newGroups[i % groupCount].members.push({ ...s, isLeader: false });
    });
    setGroups(newGroups);
  }, [students, groupCount, t]);

  const toggleLeader = (groupId: string, memberId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, members: g.members.map(m => ({ ...m, isLeader: m.id === memberId ? !m.isLeader : false })) };
    }));
  };

  const updateGroupName = (groupId: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
  };

  const handleDragStart = (groupId: string, memberIdx: number) => { setDragItem({ groupId, memberIdx }); };
  const handleDragOver = (e: React.DragEvent, groupId: string, memberIdx: number) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ groupId, memberIdx }); };
  const handleDragOverGroup = (e: React.DragEvent, groupId: string) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const group = groups.find(g => g.id === groupId); if (group) setDropTarget({ groupId, memberIdx: group.members.length }); };

  const handleDrop = (e: React.DragEvent, targetGroupId: string, targetIdx: number) => {
    e.preventDefault();
    if (!dragItem) return;
    setGroups(prev => {
      const next = prev.map(g => ({ ...g, members: [...g.members] }));
      const srcGroup = next.find(g => g.id === dragItem.groupId)!;
      const dstGroup = next.find(g => g.id === targetGroupId)!;
      const [moved] = srcGroup.members.splice(dragItem.memberIdx, 1);
      let insertIdx = targetIdx;
      if (dragItem.groupId === targetGroupId && dragItem.memberIdx < targetIdx) { insertIdx = Math.max(0, insertIdx - 1); }
      dstGroup.members.splice(insertIdx, 0, moved);
      return next;
    });
    setDragItem(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => { setDragItem(null); setDropTarget(null); };
  const printRef = useRef<HTMLDivElement>(null);

  const handleSave = async () => {
    if (!user || groups.length === 0) return;
    setSaving(true);
    try {
      const studentCount = groups.reduce((sum, g) => sum + g.members.length, 0);
      const title = `${groups.length}${t('teamwork.groupsCount')} · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const { error } = await supabase.from('teamwork_history').insert([{
        user_id: user.id, type: 'groups' as const, title, data: groups as any, student_count: studentCount,
      }]);
      if (error) throw error;
      toast.success(t('teamwork.saved'));
    } catch (err) {
      toast.error(t('teamwork.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = (data: any[]) => {
    setGroups(data as Group[]);
  };

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t('group.title')}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('group.subtitle').replace('{0}', String(students.length))}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {user && <TeamworkHistory type="groups" onRestore={handleRestore} />}
            {groups.length > 0 && (
              <>
                {user && (
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">{saving ? t('common.loading') : t('teamwork.save')}</span>
                  </Button>
                )}
                <ExportButtons targetRef={printRef} filename={t('group.exportName')} />
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('group.count')}
              <Input type="number" min={2} max={10} value={groupCount}
                onChange={e => setGroupCount(Math.max(2, Math.min(10, Number(e.target.value))))}
                className="w-16 h-8 text-center" />
            </label>
            <Button onClick={autoGroup} className="gap-2">
              <Shuffle className="w-4 h-4" /> {t('group.autoGroup')}
            </Button>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">{t('group.emptyTitle')}</p>
            <p className="text-sm">{t('group.emptyDesc')}</p>
          </div>
        ) : (
          <div ref={printRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            <AnimatePresence>
              {groups.map((group, gi) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.05 }}
                  className="bg-card rounded-xl border border-border shadow-card p-4"
                  onDragOver={e => handleDragOverGroup(e, group.id)}
                  onDrop={e => handleDrop(e, group.id, group.members.length)}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Input value={group.name} onChange={e => updateGroupName(group.id, e.target.value)}
                      className="h-7 text-sm font-semibold border-none shadow-none px-0 focus-visible:ring-0" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{group.members.length}{t('random.persons')}</span>
                  </div>
                  <div className="space-y-0.5 min-h-[2rem]">
                    {group.members.map((member, mi) => {
                      const isOver = dropTarget?.groupId === group.id && dropTarget?.memberIdx === mi;
                      const isDragging = dragItem?.groupId === group.id && dragItem?.memberIdx === mi;
                      return (
                        <div key={member.id}>
                          {isOver && <div className="h-0.5 bg-primary rounded-full mx-2 my-0.5" />}
                          <div
                            draggable
                            onDragStart={() => handleDragStart(group.id, mi)}
                            onDragOver={e => handleDragOver(e, group.id, mi)}
                            onDrop={e => { e.stopPropagation(); handleDrop(e, group.id, mi); }}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-1 py-1.5 px-2 rounded-lg hover:bg-muted transition-all cursor-grab active:cursor-grabbing group
                              ${isDragging ? 'opacity-30 scale-95' : 'opacity-100'}`}
                          >
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                            <span className="flex-1 text-sm text-foreground">{member.name}</span>
                            <button onClick={() => toggleLeader(group.id, member.id)}
                              className={`transition-all ${member.isLeader ? 'text-warning opacity-100' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'}`}>
                              <Star className="w-4 h-4" fill={member.isLeader ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
