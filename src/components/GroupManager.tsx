import { useState, useCallback, useRef, useEffect } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Shuffle, Star, GripVertical, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import ExportButtons from '@/components/ExportButtons';
import TeamShareQR from '@/components/teamwork/TeamShareQR';
import TeamworkHistory from '@/components/TeamworkHistory';
import { toast } from 'sonner';
import { loadLastGroups, saveLastGroups } from '@/lib/teamwork-local';
import { buildTeamBuckets, type TeamingDimension, type TeamingStrategy } from '@/lib/team-assignment';
import {
  deleteCustomTeamingPreset,
  loadTeamingPresets,
  saveCustomTeamingPreset,
  type TeamingPreset,
} from '@/lib/teaming-presets';

interface GroupMember { id: string; name: string; isLeader: boolean; isViceLeader?: boolean }
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
  const [groupStrategy, setGroupStrategy] = useState<TeamingStrategy>('random');
  const [customPrimaryDimension, setCustomPrimaryDimension] = useState<TeamingDimension | 'none'>('none');
  const [customBalanceDimensions, setCustomBalanceDimensions] = useState<TeamingDimension[]>(['organization', 'titleLevel']);
  const [presets, setPresets] = useState<TeamingPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    const cached = loadLastGroups();
    if (cached.length > 0) {
      setGroups(cached as Group[]);
    }
  }, []);

  useEffect(() => {
    const loaded = loadTeamingPresets('groups');
    setPresets(loaded);
    if (!selectedPresetId && loaded.length > 0) {
      setSelectedPresetId(loaded[0].id);
    }
  }, []);

  useEffect(() => {
    if (groups.length === 0) return;
    saveLastGroups(groups);
  }, [groups]);

  const autoGroup = useCallback(() => {
    if (students.length === 0) return;
    const buckets = buildTeamBuckets(students, {
      strategy: groupStrategy,
      bucketCount: groupCount,
      customPrimaryDimension,
      customBalanceDimensions,
    });
    const newGroups: Group[] = Array.from({ length: groupCount }, (_, i) => ({
      id: `g_${i}`,
      name: t('group.namePrefix').replace('{0}', GROUP_NAMES_ZH[i] || String(i + 1)),
      members: buckets[i]?.map(s => ({ id: s.id, name: s.name, isLeader: false, isViceLeader: false })) ?? [],
    }));
    setGroups(newGroups);
  }, [students, groupCount, groupStrategy, customPrimaryDimension, customBalanceDimensions, t]);

  const toggleCustomBalanceDimension = (dimension: TeamingDimension) => {
    setCustomBalanceDimensions(prev => {
      if (prev.includes(dimension)) {
        const next = prev.filter(item => item !== dimension);
        return next.length > 0 ? next : prev;
      }
      return [...prev, dimension];
    });
  };

  const applyPreset = (preset: TeamingPreset) => {
    setGroupStrategy(preset.strategy);
    setCustomPrimaryDimension(preset.customPrimaryDimension);
    setCustomBalanceDimensions(preset.customBalanceDimensions);
    setSelectedPresetId(preset.id);
    toast.success(`已切换预设：${preset.name}`);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast.error('请输入预设名称');
      return;
    }
    const created = saveCustomTeamingPreset('groups', {
      name: presetName,
      strategy: groupStrategy,
      customPrimaryDimension,
      customBalanceDimensions,
    });
    const loaded = loadTeamingPresets('groups');
    setPresets(loaded);
    setSelectedPresetId(created.id);
    setPresetName('');
    toast.success('已保存分组预设');
  };

  const handleDeletePreset = () => {
    const current = presets.find(item => item.id === selectedPresetId);
    if (!current || current.builtIn) {
      toast.error('内置模板不可删除');
      return;
    }
    deleteCustomTeamingPreset('groups', current.id);
    const loaded = loadTeamingPresets('groups');
    setPresets(loaded);
    setSelectedPresetId(loaded[0]?.id ?? '');
    toast.success('已删除预设');
  };

  const toggleLeader = (groupId: string, memberId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        members: g.members.map(m => {
          if (m.id !== memberId) return m;
          if (!m.isLeader && !m.isViceLeader) {
            return { ...m, isLeader: true, isViceLeader: false };
          }
          if (m.isLeader) {
            return { ...m, isLeader: false, isViceLeader: true };
          }
          return { ...m, isLeader: false, isViceLeader: false };
        }),
      };
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
    saveLastGroups(data as Group[]);
  };

  const handleRestoreLastLocal = () => {
    const cached = loadLastGroups();
    if (cached.length === 0) {
      toast.error('暂无本地分组记录');
      return;
    }
    setGroups(cached as Group[]);
    toast.success('已恢复上次分组');
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
            <Button variant="outline" size="sm" onClick={handleRestoreLastLocal} className="gap-1.5">
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">恢复上次</span>
            </Button>
            {groups.length > 0 && (
              <>
                {user && (
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">{saving ? t('common.loading') : t('teamwork.save')}</span>
                  </Button>
                )}
                <ExportButtons targetRef={printRef} filename={t('group.exportName')} />
                <TeamShareQR teams={groups} type="groups" />
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('group.count')}
              <Input type="number" min={2} value={groupCount}
                onChange={e => setGroupCount(Math.max(2, Number(e.target.value)))}
                className="w-16 h-8 text-center" />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              分组策略
              <select
                value={groupStrategy}
                onChange={e => setGroupStrategy(e.target.value as TeamingStrategy)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="random">随机均分</option>
                <option value="sameOrganization">同单位一组</option>
                <option value="sameTitleLevel">同级别一组</option>
                <option value="sameGender">同性别一组</option>
                <option value="balancedGender">性别均衡分组</option>
                <option value="balancedOrganizationAndTitle">单位均衡 + 职务级别均衡</option>
                <option value="custom">自定义方案</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              预设
              <select
                value={selectedPresetId}
                onChange={e => {
                  const preset = presets.find(item => item.id === e.target.value);
                  if (preset) applyPreset(preset);
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {presets.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            </label>
            <Button onClick={autoGroup} className="gap-2">
              <Shuffle className="w-4 h-4" /> {t('group.autoGroup')}
            </Button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="输入预设名称（如：企业培训模板）"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              className="h-8 w-56"
            />
            <Button variant="outline" size="sm" onClick={handleSavePreset}>保存当前为预设</Button>
            <Button variant="outline" size="sm" onClick={handleDeletePreset}>删除当前预设</Button>
            <span className="text-xs text-muted-foreground">选择预设即一键切换策略配置</span>
          </div>
        </div>

        {groupStrategy === 'custom' && (
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
                              title={member.isLeader ? '组长 → 点击设为副组长' : member.isViceLeader ? '副组长 → 点击取消' : '点击设为组长'}
                              className={`transition-all ${
                                member.isLeader
                                  ? 'text-warning opacity-100'
                                  : member.isViceLeader
                                    ? 'text-blue-500 opacity-100'
                                    : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'
                              }`}>
                              <Star className="w-4 h-4" fill={member.isLeader || member.isViceLeader ? 'currentColor' : 'none'} />
                              {member.isViceLeader && <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold">副</span>}
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
