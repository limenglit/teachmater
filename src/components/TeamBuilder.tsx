import { useState, useCallback, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { Shuffle, Crown, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import ExportButtons from '@/components/ExportButtons';

interface TeamMember { id: string; name: string; isCaptain: boolean }
interface Team { id: string; name: string; members: TeamMember[] }

export default function TeamBuilder() {
  const { students } = useStudents();
  const [membersPerTeam, setMembersPerTeam] = useState(4);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dragItem, setDragItem] = useState<{ teamId: string; memberIdx: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ teamId: string; memberIdx: number } | null>(null);

  const autoTeam = useCallback(() => {
    if (students.length === 0) return;
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const teamCount = Math.ceil(shuffled.length / membersPerTeam);
    const newTeams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
      id: `t_${i}`,
      name: `第${['一','二','三','四','五','六','七','八','九','十'][i] || i + 1}队`,
      members: [],
    }));
    shuffled.forEach((s, i) => {
      const teamIdx = Math.floor(i / membersPerTeam);
      if (teamIdx < newTeams.length) newTeams[teamIdx].members.push({ ...s, isCaptain: false });
    });
    setTeams(newTeams);
  }, [students, membersPerTeam]);

  const toggleCaptain = (teamId: string, memberId: string) => {
    setTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      return { ...t, members: t.members.map(m => ({ ...m, isCaptain: m.id === memberId ? !m.isCaptain : false })) };
    }));
  };

  const updateTeamName = (teamId: string, name: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name } : t));
  };

  const handleDragStart = (teamId: string, memberIdx: number) => {
    setDragItem({ teamId, memberIdx });
  };

  const handleDragOver = (e: React.DragEvent, teamId: string, memberIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ teamId, memberIdx });
  };

  const handleDragOverTeam = (e: React.DragEvent, teamId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const team = teams.find(t => t.id === teamId);
    if (team) setDropTarget({ teamId, memberIdx: team.members.length });
  };

  const handleDrop = (e: React.DragEvent, targetTeamId: string, targetIdx: number) => {
    e.preventDefault();
    if (!dragItem) return;

    setTeams(prev => {
      const next = prev.map(t => ({ ...t, members: [...t.members] }));
      const srcTeam = next.find(t => t.id === dragItem.teamId)!;
      const dstTeam = next.find(t => t.id === targetTeamId)!;
      const [moved] = srcTeam.members.splice(dragItem.memberIdx, 1);
      let insertIdx = targetIdx;
      if (dragItem.teamId === targetTeamId && dragItem.memberIdx < targetIdx) {
        insertIdx = Math.max(0, insertIdx - 1);
      }
      dstTeam.members.splice(insertIdx, 0, moved);
      return next;
    });

    setDragItem(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDropTarget(null);
  };

  const printRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">建队</h2>
            <p className="text-sm text-muted-foreground mt-1">按每队人数自动建队，可拖拽调整</p>
          </div>
          <div className="flex items-center gap-3">
            {teams.length > 0 && <ExportButtons targetRef={printRef} filename="建队结果" />}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              每队人数
              <Input type="number" min={2} max={10} value={membersPerTeam}
                onChange={e => setMembersPerTeam(Math.max(2, Math.min(10, Number(e.target.value))))}
                className="w-16 h-8 text-center" />
            </label>
            <Button onClick={autoTeam} className="gap-2">
              <Shuffle className="w-4 h-4" /> 自动建队
            </Button>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动建队」开始组队</p>
            <p className="text-sm">设定每队人数后随机分配，支持拖拽调整</p>
          </div>
        ) : (
          <div ref={printRef} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{team.members.length}人</span>
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
