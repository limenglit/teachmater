import { useState, useCallback, useRef, useEffect } from 'react';
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
import { loadLastTeams, saveLastTeams } from '@/lib/teamwork-local';
import { buildTeamBuckets, type TeamingDimension, type TeamingStrategy } from '@/lib/team-assignment';

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
  const [teamStrategy, setTeamStrategy] = useState<TeamingStrategy>('random');
  const [customPrimaryDimension, setCustomPrimaryDimension] = useState<TeamingDimension | 'none'>('none');
  const [customBalanceDimensions, setCustomBalanceDimensions] = useState<TeamingDimension[]>(['organization', 'titleLevel']);

  useEffect(() => {
    const cached = loadLastTeams();
    if (cached.length > 0) {
      setTeams(cached as Team[]);
    }
  }, []);

  useEffect(() => {
    if (teams.length === 0) return;
    saveLastTeams(teams);
  }, [teams]);

  const autoTeam = useCallback(() => {
    if (students.length === 0) return;
    const teamCount = Math.max(1, Math.ceil(students.length / membersPerTeam));
    const buckets = buildTeamBuckets(students, {
      strategy: teamStrategy,
      bucketCount: teamCount,
      customPrimaryDimension,
      customBalanceDimensions,
    });
    const newTeams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
      id: `t_${i}`,
      name: t('team.namePrefix').replace('{0}', TEAM_NAMES_ZH[i] || String(i + 1)),
      members: buckets[i]?.map(s => ({ id: s.id, name: s.name, isCaptain: false })) ?? [],
    }));
    setTeams(newTeams);
  }, [students, membersPerTeam, teamStrategy, customPrimaryDimension, customBalanceDimensions, t]);

  const toggleCustomBalanceDimension = (dimension: TeamingDimension) => {
    setCustomBalanceDimensions(prev => {
      if (prev.includes(dimension)) {
        const next = prev.filter(item => item !== dimension);
        return next.length > 0 ? next : prev;
      }
      return [...prev, dimension];
    });
  };

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

  const handleSave = async () => {
    if (!user || teams.length === 0) return;
    setSaving(true);
    try {
      const studentCount = teams.reduce((sum, t) => sum + t.members.length, 0);
      const title = `${teams.length}${t('teamwork.teamsCount')} · ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const { error } = await supabase.from('teamwork_history').insert([{
        user_id: user.id, type: 'teams' as const, title, data: teams as any, student_count: studentCount,
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
    setTeams(data as Team[]);
    saveLastTeams(data as Team[]);
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
              <>
                {user && (
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">{saving ? t('common.loading') : t('teamwork.save')}</span>
                  </Button>
                )}
                <ExportButtons targetRef={printRef} filename={t('team.exportName')} />
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('team.perTeam')}
              <Input type="number" min={2} max={10} value={membersPerTeam}
                onChange={e => setMembersPerTeam(Math.max(2, Math.min(10, Number(e.target.value))))}
                className="w-16 h-8 text-center" />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              建队策略
              <select
                value={teamStrategy}
                onChange={e => setTeamStrategy(e.target.value as TeamingStrategy)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="random">随机均分</option>
                <option value="sameOrganization">同单位一队</option>
                <option value="sameTitleLevel">同级别一队</option>
                <option value="sameGender">同性别一队</option>
                <option value="balancedGender">性别均衡建队</option>
                <option value="balancedOrganizationAndTitle">单位均衡 + 职务级别均衡</option>
                <option value="custom">自定义方案</option>
              </select>
            </label>
            <Button onClick={autoTeam} className="gap-2">
              <Shuffle className="w-4 h-4" /> {t('team.autoTeam')}
            </Button>
          </div>
        </div>

        {teamStrategy === 'custom' && (
          <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-muted-foreground">
                主聚合维度
                <select
                  value={customPrimaryDimension}
                  onChange={e => setCustomPrimaryDimension(e.target.value as TeamingDimension | 'none')}
                  className="h-8 rounded-md border border-input bg-background px-2"
                >
                  <option value="none">无（纯均衡）</option>
                  <option value="organization">单位</option>
                  <option value="titleLevel">职务级别</option>
                  <option value="gender">性别</option>
                </select>
              </label>
              <span className="text-muted-foreground">均衡维度</span>
              <label className="flex items-center gap-1 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={customBalanceDimensions.includes('organization')}
                  onChange={() => toggleCustomBalanceDimension('organization')}
                />
                单位
              </label>
              <label className="flex items-center gap-1 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={customBalanceDimensions.includes('titleLevel')}
                  onChange={() => toggleCustomBalanceDimension('titleLevel')}
                />
                职务级别
              </label>
              <label className="flex items-center gap-1 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={customBalanceDimensions.includes('gender')}
                  onChange={() => toggleCustomBalanceDimension('gender')}
                />
                性别
              </label>
            </div>
          </div>
        )}

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
