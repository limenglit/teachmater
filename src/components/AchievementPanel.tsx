import { useState, useEffect, useMemo } from 'react';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useStudents } from '@/contexts/StudentContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Plus, Minus, Medal, Star, Award, Gift, Crown, Target, Zap, Heart, Flame, Download, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PointRecord {
  id: string;
  student_name: string;
  points: number;
  source: string;
  description: string;
  created_at: string;
  creator_token: string;
}

interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  condition_type: string;
  condition_value: number;
  creator_token: string;
  is_system: boolean;
}

interface StudentBadge {
  id: string;
  student_name: string;
  badge_id: string;
  earned_at: string;
}

interface LeaderboardEntry {
  name: string;
  totalPoints: number;
  badges: Badge[];
}

const BADGE_EMOJIS = ['🏅', '🥇', '🥈', '🥉', '⭐', '🌟', '💎', '👑', '🎯', '🔥', '💪', '🎓', '🏆', '🎖️', '💡', '🚀'];
const SOURCE_OPTIONS = ['checkin', 'quiz', 'discuss', 'board', 'manual'];
const TOKEN_KEY = 'achievement-creator-token';

function getToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export default function AchievementPanel() {
  const { t } = useLanguage();
  const { students } = useStudents();
  const token = getToken();

  const [points, setPoints] = useState<PointRecord[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [studentBadges, setStudentBadges] = useState<StudentBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'leaderboard' | 'points' | 'badges'>('leaderboard');

  // Add points form
  const [showAddPoints, setShowAddPoints] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPoints, setAddPoints] = useState(10);
  const [addSource, setAddSource] = useState('manual');
  const [addDesc, setAddDesc] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Badge form
  const [showAddBadge, setShowAddBadge] = useState(false);
  const [badgeName, setBadgeName] = useState('');
  const [badgeEmoji, setBadgeEmoji] = useState('🏅');
  const [badgeDesc, setBadgeDesc] = useState('');
  const [badgeCondType, setBadgeCondType] = useState('points');
  const [badgeCondValue, setBadgeCondValue] = useState(100);

  // Award badge
  const [showAwardBadge, setShowAwardBadge] = useState(false);
  const [awardBadgeId, setAwardBadgeId] = useState('');
  const [awardStudents, setAwardStudents] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [pRes, bRes, sbRes] = await Promise.all([
      supabase.from('student_points').select('*').eq('creator_token', token).order('created_at', { ascending: false }) as any,
      supabase.from('badges').select('*').eq('creator_token', token).order('created_at') as any,
      supabase.from('student_badges').select('*').eq('creator_token', token) as any,
    ]);
    setPoints(pRes.data || []);
    setBadges(bRes.data || []);
    setStudentBadges(sbRes.data || []);
    setLoading(false);
  };

  // Leaderboard data
  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const map: Record<string, number> = {};
    for (const p of points) {
      map[p.student_name] = (map[p.student_name] || 0) + p.points;
    }
    // Include students from sidebar that may have 0 points
    for (const s of students) {
      if (!(s.name in map)) map[s.name] = 0;
    }
    return Object.entries(map)
      .map(([name, totalPoints]) => ({
        name,
        totalPoints,
        badges: studentBadges
          .filter(sb => sb.student_name === name)
          .map(sb => badges.find(b => b.id === sb.badge_id))
          .filter(Boolean) as Badge[],
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [points, students, badges, studentBadges]);

  const addPointsSubmit = async () => {
    const names = batchMode ? selectedStudents : [addName.trim()];
    if (names.length === 0 || names.some(n => !n)) {
      toast({ title: t('achieve.selectStudent'), variant: 'destructive' });
      return;
    }

    const inserts = names.map(name => ({
      student_name: name,
      points: addPoints,
      source: addSource,
      description: addDesc.trim() || t(`achieve.source_${addSource}`),
      creator_token: token,
    }));

    const { data, error } = await supabase.from('student_points').insert(inserts).select() as any;
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }

    setPoints(prev => [...(data || []), ...prev]);
    setShowAddPoints(false);
    setAddName('');
    setAddDesc('');
    setSelectedStudents([]);
    toast({ title: tFormat(t('achieve.pointsAdded'), addPoints, names.length) });

    // Auto-check badge unlocks
    checkBadgeUnlocks(names);
  };

  const checkBadgeUnlocks = async (names: string[]) => {
    const pointsBadges = badges.filter(b => b.condition_type === 'points');
    const newAwards: { student_name: string; badge_id: string; creator_token: string }[] = [];

    for (const name of names) {
      const total = points.filter(p => p.student_name === name).reduce((s, p) => s + p.points, 0) + addPoints;
      for (const badge of pointsBadges) {
        if (total >= badge.condition_value) {
          const already = studentBadges.find(sb => sb.student_name === name && sb.badge_id === badge.id);
          if (!already) {
            newAwards.push({ student_name: name, badge_id: badge.id, creator_token: token });
          }
        }
      }
    }

    if (newAwards.length > 0) {
      const { data } = await supabase.from('student_badges').insert(newAwards).select() as any;
      if (data) {
        setStudentBadges(prev => [...prev, ...data]);
        toast({ title: `🎉 ${newAwards.length} ${t('achieve.badgesUnlocked')}` });
      }
    }
  };

  const createBadge = async () => {
    if (!badgeName.trim()) return;
    const { data, error } = await supabase.from('badges').insert({
      name: badgeName.trim(),
      emoji: badgeEmoji,
      description: badgeDesc.trim(),
      condition_type: badgeCondType,
      condition_value: badgeCondValue,
      creator_token: token,
    }).select().single() as any;
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    setBadges(prev => [...prev, data]);
    setShowAddBadge(false);
    setBadgeName('');
    setBadgeDesc('');
    toast({ title: t('achieve.badgeCreated') });
  };

  const deleteBadge = async (badge: Badge) => {
    if (!confirm(t('achieve.deleteBadgeConfirm'))) return;
    await supabase.rpc('delete_badge', { p_badge_id: badge.id, p_token: token });
    setBadges(prev => prev.filter(b => b.id !== badge.id));
    setStudentBadges(prev => prev.filter(sb => sb.badge_id !== badge.id));
  };

  const awardBadgeSubmit = async () => {
    if (!awardBadgeId || awardStudents.length === 0) return;
    const inserts = awardStudents.map(name => ({
      student_name: name,
      badge_id: awardBadgeId,
      creator_token: token,
    }));
    const { data, error } = await supabase.from('student_badges').insert(inserts).select() as any;
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    setStudentBadges(prev => [...prev, ...(data || [])]);
    setShowAwardBadge(false);
    setAwardStudents([]);
    toast({ title: `🎖️ ${t('achieve.badgesAwarded')}` });
  };

  const exportCSV = () => {
    const header = 'Rank,Name,Points,Badges\n';
    const rows = leaderboard.map((entry, idx) =>
      `${idx + 1},"${entry.name}",${entry.totalPoints},"${entry.badges.map(b => `${b.emoji}${b.name}`).join(', ')}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leaderboard.csv';
    a.click();
  };

  const getRankIcon = (idx: number) => {
    if (idx === 0) return '🥇';
    if (idx === 1) return '🥈';
    if (idx === 2) return '🥉';
    return `${idx + 1}`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" /> {t('achieve.title')}
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1" onClick={() => setShowAddPoints(true)}>
              <Plus className="w-3 h-3" /> {t('achieve.addPoints')}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={exportCSV}>
              <Download className="w-3 h-3" /> {t('achieve.export')}
            </Button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(['leaderboard', 'points', 'badges'] as const).map(t2 => (
            <button
              key={t2}
              onClick={() => setTab(t2)}
              className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                tab === t2 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t2 === 'leaderboard' && `🏆 ${t('achieve.leaderboard')}`}
              {t2 === 'points' && `⭐ ${t('achieve.pointsHistory')}`}
              {t2 === 'badges' && `🎖️ ${t('achieve.badgeManage')}`}
            </button>
          ))}
        </div>

        {/* Leaderboard Tab */}
        {tab === 'leaderboard' && (
          <div className="space-y-2">
            {leaderboard.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">{t('achieve.empty')}</p>
            )}
            {leaderboard.map((entry, idx) => (
              <motion.div
                key={entry.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  idx === 0 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800/30' :
                  idx === 1 ? 'bg-slate-50 border-slate-200 dark:bg-slate-800/20 dark:border-slate-700/30' :
                  idx === 2 ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800/30' :
                  'bg-card border-border'
                }`}
              >
                <span className={`w-8 text-center text-lg font-bold ${idx < 3 ? '' : 'text-muted-foreground text-sm'}`}>
                  {getRankIcon(idx)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{entry.name}</p>
                  {entry.badges.length > 0 && (
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {entry.badges.map((b, bi) => (
                        <span key={bi} className="text-xs" title={b.name}>{b.emoji}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-primary">{entry.totalPoints}</span>
                  <span className="text-xs text-muted-foreground">{t('achieve.pts')}</span>
                </div>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setAddName(entry.name);
                      setAddPoints(10);
                      setBatchMode(false);
                      setShowAddPoints(true);
                    }}
                  >
                    <Plus className="w-3 h-3 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setAddName(entry.name);
                      setAddPoints(-10);
                      setBatchMode(false);
                      setShowAddPoints(true);
                    }}
                  >
                    <Minus className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Points History Tab */}
        {tab === 'points' && (
          <div className="space-y-2">
            {points.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">{t('achieve.noPoints')}</p>
            )}
            {points.slice(0, 100).map(p => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card text-sm">
                <span className={`font-bold min-w-[50px] text-right ${p.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {p.points > 0 ? '+' : ''}{p.points}
                </span>
                <span className="font-medium text-foreground">{p.student_name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {t(`achieve.source_${p.source}`)}
                </span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{p.description}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(p.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Badges Tab */}
        {tab === 'badges' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1" onClick={() => setShowAddBadge(true)}>
                <Plus className="w-3 h-3" /> {t('achieve.createBadge')}
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { setShowAwardBadge(true); setAwardBadgeId(badges[0]?.id || ''); }}>
                <Award className="w-3 h-3" /> {t('achieve.awardBadge')}
              </Button>
            </div>

            {badges.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">{t('achieve.noBadges')}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {badges.map(badge => {
                const earnedCount = studentBadges.filter(sb => sb.badge_id === badge.id).length;
                return (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{badge.emoji}</span>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{badge.name}</p>
                          <p className="text-xs text-muted-foreground">{badge.description}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => deleteBadge(badge)}>
                        <X className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {badge.condition_type === 'points' 
                          ? tFormat(t('achieve.unlockAtPoints'), badge.condition_value) 
                          : t('achieve.manualAward')
                        }
                      </span>
                      <span>{earnedCount} {t('achieve.earned')}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Points Dialog */}
        <Dialog open={showAddPoints} onOpenChange={setShowAddPoints}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('achieve.addPoints')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Batch toggle */}
              <div className="flex items-center gap-2">
                <Button variant={batchMode ? 'outline' : 'default'} size="sm" onClick={() => setBatchMode(false)}>
                  {t('achieve.singleMode')}
                </Button>
                <Button variant={batchMode ? 'default' : 'outline'} size="sm" onClick={() => setBatchMode(true)}>
                  {t('achieve.batchMode')}
                </Button>
              </div>

              {batchMode ? (
                <div className="max-h-40 overflow-auto border border-border rounded-lg p-2 space-y-1">
                  {students.length === 0 && <p className="text-xs text-muted-foreground">{t('achieve.noStudentList')}</p>}
                  {students.map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(s)}
                        onChange={e => {
                          setSelectedStudents(prev => e.target.checked ? [...prev, s] : prev.filter(n => n !== s));
                        }}
                        className="rounded"
                      />
                      {s}
                    </label>
                  ))}
                  {students.length > 0 && (
                    <div className="flex gap-2 pt-1">
                      <button className="text-xs text-primary" onClick={() => setSelectedStudents([...students])}>
                        {t('achieve.selectAll')}
                      </button>
                      <button className="text-xs text-muted-foreground" onClick={() => setSelectedStudents([])}>
                        {t('achieve.deselectAll')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <Input
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    placeholder={t('achieve.studentName')}
                    list="student-names"
                  />
                  <datalist id="student-names">
                    {students.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">{t('achieve.pointsAmount')}:</span>
                <div className="flex items-center gap-1">
                  {[-10, -5, -1, 1, 5, 10, 20, 50].map(v => (
                    <button
                      key={v}
                      onClick={() => setAddPoints(v)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        addPoints === v
                          ? v > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {v > 0 ? `+${v}` : v}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  value={addPoints}
                  onChange={e => setAddPoints(parseInt(e.target.value) || 0)}
                  className="w-20 h-8 text-sm"
                />
              </div>

              <div>
                <span className="text-sm font-medium text-foreground">{t('achieve.source')}:</span>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {SOURCE_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => setAddSource(s)}
                      className={`px-2 py-1 rounded text-xs transition-all ${
                        addSource === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {t(`achieve.source_${s}`)}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                value={addDesc}
                onChange={e => setAddDesc(e.target.value)}
                placeholder={t('achieve.descPlaceholder')}
              />

              <Button className="w-full" onClick={addPointsSubmit}>
                {t('achieve.confirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Badge Dialog */}
        <Dialog open={showAddBadge} onOpenChange={setShowAddBadge}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('achieve.createBadge')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={badgeName}
                    onChange={e => setBadgeName(e.target.value)}
                    placeholder={t('achieve.badgeNamePlaceholder')}
                  />
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-foreground">{t('achieve.badgeIcon')}:</span>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {BADGE_EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setBadgeEmoji(e)}
                      className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all ${
                        badgeEmoji === e ? 'bg-primary/10 border-2 border-primary scale-110' : 'bg-muted border border-border hover:bg-accent'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                value={badgeDesc}
                onChange={e => setBadgeDesc(e.target.value)}
                placeholder={t('achieve.badgeDescPlaceholder')}
              />

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{t('achieve.unlockCondition')}:</span>
                <select
                  value={badgeCondType}
                  onChange={e => setBadgeCondType(e.target.value)}
                  className="h-8 text-sm rounded-md border border-border bg-background px-2"
                >
                  <option value="points">{t('achieve.condPoints')}</option>
                  <option value="manual">{t('achieve.condManual')}</option>
                </select>
                {badgeCondType === 'points' && (
                  <Input
                    type="number"
                    value={badgeCondValue}
                    onChange={e => setBadgeCondValue(parseInt(e.target.value) || 0)}
                    className="w-24 h-8 text-sm"
                  />
                )}
              </div>

              <Button className="w-full" onClick={createBadge} disabled={!badgeName.trim()}>
                {t('achieve.confirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Award Badge Dialog */}
        <Dialog open={showAwardBadge} onOpenChange={setShowAwardBadge}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('achieve.awardBadge')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <span className="text-sm font-medium">{t('achieve.selectBadge')}:</span>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {badges.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setAwardBadgeId(b.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-all ${
                        awardBadgeId === b.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {b.emoji} {b.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-40 overflow-auto border border-border rounded-lg p-2 space-y-1">
                {students.map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={awardStudents.includes(s)}
                      onChange={e => {
                        setAwardStudents(prev => e.target.checked ? [...prev, s] : prev.filter(n => n !== s));
                      }}
                      className="rounded"
                    />
                    {s}
                  </label>
                ))}
              </div>

              <Button className="w-full" onClick={awardBadgeSubmit} disabled={!awardBadgeId || awardStudents.length === 0}>
                {t('achieve.confirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
