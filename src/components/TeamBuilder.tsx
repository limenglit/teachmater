import { useState, useCallback, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Shuffle, Crown, GripVertical, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import ExportButtons from '@/components/ExportButtons';
import TeamworkHistory from '@/components/TeamworkHistory';
import { toast } from 'sonner';

interface TeamMember { id: string; name: string; isCaptain: boolean }
interface Team { id: string; name: string; members: TeamMember[] }

const TEAM_NAMES_ZH = ['一','二','三','四','五','六','七','八','九','十'];

export default function TeamBuilder() {
  const { students } = useStudents();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [membersPerTeam, setMembersPerTeam] = useState(4);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dragItem, setDragItem] = useState<{ teamId: string; memberIdx: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ teamId: string; memberIdx: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const autoTeam = useCallback(() => {
    if (students.length === 0) return;
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const teamCount = Math.ceil(shuffled.length / membersPerTeam);
    const newTeams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
      id: `t_${i}`,
      name: t('team.namePrefix').replace('{0}', TEAM_NAMES_ZH[i] || String(i + 1)),
      members: [],
    }));
    shuffled.forEach((s, i) => {
      const teamIdx = Math.floor(i / membersPerTeam);
      if (teamIdx < newTeams.length) newTeams[teamIdx].members.push({ ...s, isCaptain: false });
    });
    setTeams(newTeams);
  }, [students, membersPerTeam, t]);

  const toggleCaptain = (teamId: string, memberId: string) => {
    setTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      return { ...t, members: t.members.map(m => ({ ...m, isCaptain: m.id === memberId ? !m.isCaptain : false })) };
    }));
  };

  const updateTeamName = (teamId: string, name: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name } : t));
  };

  const handleDragStart = (teamId: string, memberIdx: number) => { setDragItem({ teamId, memberIdx }); };
  const handleDragOver = (e: React.DragEvent, teamId: string, memberIdx: number) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ teamId, memberIdx }); };
  const handleDragOverTeam = (e: React.DragEvent, teamId: string) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const team = teams.find(t => t.id === teamId); if (team) setDropTarget({ teamId, memberIdx: team.members.length }); };

  const handleDrop = (e: React.DragEvent, targetTeamId: string, targetIdx: number) => {
    e.preventDefault();
    if (!dragItem) return;
    setTeams(prev => {
      const next = prev.map(t => ({ ...t, members: [...t.members] }));
      const srcTeam = next.find(t => t.id === dragItem.teamId)!;
      const dstTeam = next.find(t => t.id === targetTeamId)!;
      const [moved] = srcTeam.members.splice(dragItem.memberIdx, 1);
      let insertIdx = targetIdx;
      if (dragItem.teamId === targetTeamId && dragItem.memberIdx < targetIdx) { insertIdx = Math.max(0, insertIdx - 1); }
      dstTeam.members.splice(insertIdx, 0, moved);
      return next;
    });
    setDragItem(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => { setDragItem(null); setDropTarget(null); };
  const printRef = useRef<HTMLDivElement>(null);

  const handleRestore = (data: any[]) => {
    setTeams(data as Team[]);
  };

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t('team.title')}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('team.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {user && <TeamworkHistory type="teams" onRestore={handleRestore} />}
            {teams.length > 0 && (
              <ExportButtons targetRef={printRef} filename={t('team.exportName')} />
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('team.perTeam')}
              <Input type="number" min={2} max={10} value={membersPerTeam}
                onChange={e => setMembersPerTeam(Math.max(2, Math.min(10, Number(e.target.value))))}
                className="w-16 h-8 text-center" />
            </label>
            <Button onClick={autoTeam} className="gap-2">
              <Shuffle className="w-4 h-4" /> {t('team.autoTeam')}
            </Button>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">{t('team.emptyTitle')}</p>
            <p className="text-sm">{t('team.emptyDesc')}</p>
          </div>
        ) : (
          <div ref={printRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            <AnimatePresence>
              {teams.map((team, ti) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ti * 0.05 }}
                  className="bg-card rounded-xl border border-border shadow-card p-4"
                  onDragOver={e => handleDragOverTeam(e, team.id)}
                  onDrop={e => handleDrop(e, team.id, team.members.length)}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Input value={team.name} onChange={e => updateTeamName(team.id, e.target.value)}
                      className="h-7 text-sm font-semibold border-none shadow-none px-0 focus-visible:ring-0" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{team.members.length}{t('random.persons')}</span>
                  </div>
                  <div className="space-y-0.5 min-h-[2rem]">
                    {team.members.map((member, mi) => {
                      const isOver = dropTarget?.teamId === team.id && dropTarget?.memberIdx === mi;
                      const isDragging = dragItem?.teamId === team.id && dragItem?.memberIdx === mi;
                      return (
                        <div key={member.id}>
                          {isOver && <div className="h-0.5 bg-primary rounded-full mx-2 my-0.5" />}
                          <div
                            draggable
                            onDragStart={() => handleDragStart(team.id, mi)}
                            onDragOver={e => handleDragOver(e, team.id, mi)}
                            onDrop={e => { e.stopPropagation(); handleDrop(e, team.id, mi); }}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-1 py-1.5 px-2 rounded-lg hover:bg-muted transition-all cursor-grab active:cursor-grabbing group
                              ${isDragging ? 'opacity-30 scale-95' : 'opacity-100'}`}
                          >
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                            <span className="flex-1 text-sm text-foreground">{member.name}</span>
                            <button onClick={() => toggleCaptain(team.id, member.id)}
                              className={`transition-all ${member.isCaptain ? 'text-warning opacity-100' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'}`}>
                              <Crown className="w-4 h-4" fill={member.isCaptain ? 'currentColor' : 'none'} />
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
