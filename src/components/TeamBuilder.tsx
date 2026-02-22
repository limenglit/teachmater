import { useState, useCallback } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { Shuffle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

interface Team {
  id: string;
  name: string;
  members: { id: string; name: string; isCaptain: boolean }[];
}

export default function TeamBuilder() {
  const { students } = useStudents();
  const [membersPerTeam, setMembersPerTeam] = useState(4);
  const [teams, setTeams] = useState<Team[]>([]);

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
      if (teamIdx < newTeams.length) {
        newTeams[teamIdx].members.push({ ...s, isCaptain: false });
      }
    });

    setTeams(newTeams);
  }, [students, membersPerTeam]);

  const toggleCaptain = (teamId: string, memberId: string) => {
    setTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      return {
        ...t,
        members: t.members.map(m => ({
          ...m,
          isCaptain: m.id === memberId ? !m.isCaptain : false,
        })),
      };
    }));
  };

  const updateTeamName = (teamId: string, name: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name } : t));
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">建队</h2>
            <p className="text-sm text-muted-foreground mt-1">按每队人数自动建队</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              每队人数
              <Input
                type="number"
                min={2}
                max={10}
                value={membersPerTeam}
                onChange={e => setMembersPerTeam(Math.max(2, Math.min(10, Number(e.target.value))))}
                className="w-16 h-8 text-center"
              />
            </label>
            <Button onClick={autoTeam} className="gap-2">
              <Shuffle className="w-4 h-4" /> 自动建队
            </Button>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动建队」开始组队</p>
            <p className="text-sm">设定每队人数后随机分配</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {teams.map((team, ti) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ti * 0.05 }}
                  className="bg-card rounded-xl border border-border shadow-card p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      value={team.name}
                      onChange={e => updateTeamName(team.id, e.target.value)}
                      className="h-7 text-sm font-semibold border-none shadow-none px-0 focus-visible:ring-0"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {team.members.length}人
                    </span>
                  </div>
                  <div className="space-y-1">
                    {team.members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted transition-colors group"
                      >
                        <span className="flex-1 text-sm text-foreground">{member.name}</span>
                        <button
                          onClick={() => toggleCaptain(team.id, member.id)}
                          className={`transition-all ${
                            member.isCaptain
                              ? 'text-warning opacity-100'
                              : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Crown className="w-4 h-4" fill={member.isCaptain ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    ))}
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
