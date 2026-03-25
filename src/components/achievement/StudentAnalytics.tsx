import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { BarChart3, Settings2, Download, Calendar, Users, TrendingUp, Eye, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RadarChart from './RadarChart';
import ScoringRulesConfig from './ScoringRulesConfig';
import ClassOverview from './ClassOverview';
import { type ScoringRules, type DimensionKey, type StudentDimensionData, DEFAULT_RULES, DIMENSION_KEYS } from './analyticsTypes';

interface Props {
  studentNames: string[];
}

type SubView = 'classOverview' | 'overall' | 'dimension' | 'detail';

export default function StudentAnalytics({ studentNames }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [rules, setRules] = useState<ScoringRules>(DEFAULT_RULES);
  const [showRulesConfig, setShowRulesConfig] = useState(false);
  const [subView, setSubView] = useState<SubView>('classOverview');
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('board_participate');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Date range
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Raw data
  const [boardCounts, setBoardCounts] = useState<Record<string, number>>({});
  const [boardLikes, setBoardLikes] = useState<Record<string, number>>({});
  const [boardCommentCounts, setBoardCommentCounts] = useState<Record<string, number>>({});
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [barrageCounts, setBarrageCounts] = useState<Record<string, number>>({});
  const [quizCounts, setQuizCounts] = useState<Record<string, number>>({});
  const [checkinCounts, setCheckinCounts] = useState<Record<string, number>>({});

  // Load scoring rules
  useEffect(() => {
    if (!user) return;
    supabase.from('scoring_rules' as any).select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }: any) => {
        if (data?.rules) {
          setRules({ ...DEFAULT_RULES, ...data.rules });
        }
      });
  }, [user]);

  const loadAnalytics = useCallback(async () => {
    if (studentNames.length === 0) return;
    setLoading(true);

    const fromISO = new Date(dateFrom).toISOString();
    const toISO = new Date(dateTo + 'T23:59:59').toISOString();

    try {
      // Query all data sources in parallel
      const [boardRes, boardCommentRes, taskRes, barrageRes, quizRes, checkinRes, seatCheckinRes] = await Promise.all([
        supabase.from('board_cards').select('author_nickname, likes_count').gte('created_at', fromISO).lte('created_at', toISO).in('author_nickname', studentNames),
        supabase.from('board_comments').select('author_nickname, created_at').gte('created_at', fromISO).lte('created_at', toISO).in('author_nickname', studentNames),
        supabase.from('task_completions').select('student_name').gte('completed_at', fromISO).lte('completed_at', toISO).in('student_name', studentNames),
        supabase.from('barrage_messages').select('nickname').gte('created_at', fromISO).lte('created_at', toISO).in('nickname', studentNames),
        supabase.from('quiz_answers').select('student_name, session_id').gte('created_at', fromISO).lte('created_at', toISO).in('student_name', studentNames),
        supabase.from('checkin_records').select('student_name').gte('checked_in_at', fromISO).lte('checked_in_at', toISO).in('student_name', studentNames),
        supabase.from('seat_checkin_records').select('student_name').gte('checked_in_at', fromISO).lte('checked_in_at', toISO).in('student_name', studentNames),
      ]);

      // Aggregate board participation & likes
      const bc: Record<string, number> = {};
      const bl: Record<string, number> = {};
      (boardRes.data || []).forEach((row: any) => {
        bc[row.author_nickname] = (bc[row.author_nickname] || 0) + 1;
        bl[row.author_nickname] = (bl[row.author_nickname] || 0) + (row.likes_count || 0);
      });
      setBoardCounts(bc);
      setBoardLikes(bl);

      // Board comments
      const bcc: Record<string, number> = {};
      (boardCommentRes.data || []).forEach((row: any) => {
        bcc[row.author_nickname] = (bcc[row.author_nickname] || 0) + 1;
      });
      setBoardCommentCounts(bcc);

      // Task completions
      const tc: Record<string, number> = {};
      (taskRes.data || []).forEach((row: any) => {
        tc[row.student_name] = (tc[row.student_name] || 0) + 1;
      });
      setTaskCounts(tc);

      // Barrage messages
      const brc: Record<string, number> = {};
      (barrageRes.data || []).forEach((row: any) => {
        brc[row.nickname] = (brc[row.nickname] || 0) + 1;
      });
      setBarrageCounts(brc);

      // Quiz participation (count distinct sessions)
      const qc: Record<string, Set<string>> = {};
      (quizRes.data || []).forEach((row: any) => {
        if (!qc[row.student_name]) qc[row.student_name] = new Set();
        qc[row.student_name].add(row.session_id);
      });
      const qcCount: Record<string, number> = {};
      Object.entries(qc).forEach(([name, sessions]) => { qcCount[name] = sessions.size; });
      setQuizCounts(qcCount);

      // Check-in (combine both types)
      const cc: Record<string, number> = {};
      (checkinRes.data || []).forEach((row: any) => {
        cc[row.student_name] = (cc[row.student_name] || 0) + 1;
      });
      (seatCheckinRes.data || []).forEach((row: any) => {
        cc[row.student_name] = (cc[row.student_name] || 0) + 1;
      });
      setCheckinCounts(cc);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  }, [studentNames, dateFrom, dateTo]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Compute student analytics data
  const analyticsData = useMemo<StudentDimensionData[]>(() => {
    return studentNames.map(name => {
      const dims: Record<DimensionKey, number> = {
        board_participate: (boardCounts[name] || 0) * (rules.board_participate.points_per || 0),
        board_quality: (boardLikes[name] || 0) * (rules.board_quality.points_per_like || 0),
        board_comment: (boardCommentCounts[name] || 0) * (rules.board_comment.points_per || 0),
        task_complete: (taskCounts[name] || 0) * (rules.task_complete.points_per || 0),
        barrage_participate: (barrageCounts[name] || 0) * (rules.barrage_participate.points_per || 0),
        quiz_participate: (quizCounts[name] || 0) * (rules.quiz_participate.points_per || 0),
        checkin: (checkinCounts[name] || 0) * (rules.checkin.points_per || 0),
      };

      const totalWeight = DIMENSION_KEYS.reduce((s, k) => s + (rules[k].enabled ? rules[k].weight : 0), 0) || 1;
      const totalScore = DIMENSION_KEYS.reduce((s, k) => {
        if (!rules[k].enabled) return s;
        return s + dims[k] * (rules[k].weight / totalWeight);
      }, 0);

      return { name, ...dims, totalScore };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [studentNames, boardCounts, boardLikes, boardCommentCounts, taskCounts, barrageCounts, quizCounts, checkinCounts, rules]);

  // Get raw counts for display
  const getRawCount = (name: string, dim: DimensionKey): number => {
    switch (dim) {
      case 'board_participate': return boardCounts[name] || 0;
      case 'board_quality': return boardLikes[name] || 0;
      case 'board_comment': return boardCommentCounts[name] || 0;
      case 'task_complete': return taskCounts[name] || 0;
      case 'barrage_participate': return barrageCounts[name] || 0;
      case 'quiz_participate': return quizCounts[name] || 0;
      case 'checkin': return checkinCounts[name] || 0;
      default: return 0;
    }
  };

  // Normalize values for radar chart (0-100)
  const getRadarValues = (student: StudentDimensionData): number[] => {
    return DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => {
      const maxVal = Math.max(...analyticsData.map(s => s[k]), 1);
      return (student[k] / maxVal) * 100;
    });
  };

  const getRadarLabels = (): string[] => {
    return DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => t(`analytics.dim_${k}_short`));
  };

  // Sort by specific dimension
  const sortedByDimension = useMemo(() => {
    return [...analyticsData].sort((a, b) => b[activeDimension] - a[activeDimension]);
  }, [analyticsData, activeDimension]);

  const getRankIcon = (idx: number) => {
    if (idx === 0) return '🥇';
    if (idx === 1) return '🥈';
    if (idx === 2) return '🥉';
    return `${idx + 1}`;
  };

  const getDimIcon = (key: DimensionKey) => {
    const icons: Record<DimensionKey, string> = {
      board_participate: '🎨', board_quality: '❤️', board_comment: '💭', task_complete: '✅',
      barrage_participate: '💬', quiz_participate: '📝', checkin: '📋',
    };
    return icons[key];
  };

  // Export to Excel
  const exportExcel = async () => {
    try {
      const { writeExcelFile } = await import('@/lib/excel-utils');
      const headers = [
        t('analytics.rank'), t('analytics.studentName'),
        ...DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => t(`analytics.dim_${k}`)),
        ...DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => `${t(`analytics.dim_${k}`)}(${t('analytics.rawCount')})`),
        t('analytics.totalScore'),
      ];
      const rows = analyticsData.map((s, i) => [
        i + 1, s.name,
        ...DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => s[k]),
        ...DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => getRawCount(s.name, k)),
        Math.round(s.totalScore * 10) / 10,
      ]);
      await writeExcelFile([headers, ...rows], t('analytics.exportFileName'), `${t('analytics.exportFileName')}_${dateFrom}_${dateTo}.xlsx`);
      toast({ title: t('analytics.exported') });
    } catch {
      // Fallback to CSV
      const headers = ['Rank', 'Name', ...DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => t(`analytics.dim_${k}`)), 'Total'];
      const csv = [
        headers.join(','),
        ...analyticsData.map((s, i) => [i + 1, `"${s.name}"`, ...DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => s[k]), Math.round(s.totalScore * 10) / 10].join(','))
      ].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `analytics_${dateFrom}_${dateTo}.csv`;
      a.click();
      toast({ title: t('analytics.exported') });
    }
  };

  const selectedData = selectedStudent ? analyticsData.find(s => s.name === selectedStudent) : null;

  if (studentNames.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium mb-1">{t('analytics.noClass')}</p>
        <p className="text-sm">{t('analytics.selectClassFirst')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-[130px] text-xs" />
          <span>~</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-[130px] text-xs" />
        </div>
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowRulesConfig(true)}>
          <Settings2 className="w-3 h-3" /> {t('analytics.rules')}
        </Button>
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={exportExcel}>
          <Download className="w-3 h-3" /> {t('analytics.exportExcel')}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          <Users className="w-3 h-3 inline mr-1" />{studentNames.length}{t('analytics.students')}
        </span>
      </div>

      {loading && (
        <div className="text-center py-8 text-muted-foreground text-sm">{t('common.loading')}</div>
      )}

      {!loading && (
        <>
          {/* Sub-view tabs */}
          <div className="flex gap-1 border-b border-border">
            {([
              { id: 'classOverview' as SubView, label: t('analytics.classOverview'), icon: '📋' },
              { id: 'overall' as SubView, label: t('analytics.overallRank'), icon: '🏆' },
              { id: 'dimension' as SubView, label: t('analytics.byDimension'), icon: '📊' },
            ]).map(v => (
              <button key={v.id} onClick={() => setSubView(v.id)}
                className={`px-3 py-2 text-sm font-medium transition-all border-b-2 ${subView === v.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {/* Class Overview */}
          {subView === 'classOverview' && (
            <ClassOverview
              analyticsData={analyticsData}
              rules={rules}
              getRawCount={getRawCount}
            />
          )}

          {/* Overall Ranking */}
          {subView === 'overall' && (
            <div className="space-y-2">
              {analyticsData.map((student, idx) => (
                <motion.div
                  key={student.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                    idx === 0 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800/30' :
                    idx === 1 ? 'bg-slate-50 border-slate-200 dark:bg-slate-800/20 dark:border-slate-700/30' :
                    idx === 2 ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800/30' :
                    'bg-card border-border'
                  }`}
                  onClick={() => setSelectedStudent(student.name)}
                >
                  <span className={`w-8 text-center text-lg font-bold ${idx < 3 ? '' : 'text-muted-foreground text-sm'}`}>
                    {getRankIcon(idx)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{student.name}</p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      {DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => (
                        <span key={k} className="text-[10px] text-muted-foreground" title={t(`analytics.dim_${k}`)}>
                          {getDimIcon(k)}{getRawCount(student.name, k)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-primary">{Math.round(student.totalScore * 10) / 10}</span>
                    <span className="text-xs text-muted-foreground">{t('analytics.score')}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setSelectedStudent(student.name); }}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}

          {/* Dimension View */}
          {subView === 'dimension' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => (
                  <button key={k} onClick={() => setActiveDimension(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      activeDimension === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                    }`}>
                    {getDimIcon(k)} {t(`analytics.dim_${k}_short`)}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                {sortedByDimension.map((student, idx) => {
                  const maxVal = Math.max(...sortedByDimension.map(s => s[activeDimension]), 1);
                  const pct = (student[activeDimension] / maxVal) * 100;
                  return (
                    <motion.div
                      key={student.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.015 }}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className={`w-7 text-right font-bold ${idx < 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {getRankIcon(idx)}
                      </span>
                      <span className="w-20 truncate font-medium text-foreground">{student.name}</span>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden relative">
                        <motion.div
                          className="h-full bg-primary/70 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: idx * 0.02 }}
                        />
                      </div>
                      <span className="w-16 text-right text-xs text-muted-foreground">
                        {getRawCount(student.name, activeDimension)}{t('analytics.times')} / {student[activeDimension]}{t('analytics.pts')}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Student Detail Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={open => { if (!open) setSelectedStudent(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {selectedData?.name} - {t('analytics.studentDetail')}
            </DialogTitle>
          </DialogHeader>
          {selectedData && (
            <div className="space-y-4 py-2">
              <RadarChart
                labels={getRadarLabels()}
                values={getRadarValues(selectedData)}
                size={220}
              />
              <div className="space-y-2">
                {DIMENSION_KEYS.filter(k => rules[k].enabled).map(k => {
                  const maxVal = Math.max(...analyticsData.map(s => s[k]), 1);
                  const pct = (selectedData[k] / maxVal) * 100;
                  const rank = analyticsData.filter(s => s[k] > selectedData[k]).length + 1;
                  return (
                    <div key={k} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-center">{getDimIcon(k)}</span>
                      <span className="w-20 text-xs text-muted-foreground truncate">{t(`analytics.dim_${k}_short`)}</span>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-20 text-right text-xs text-muted-foreground">
                        {getRawCount(selectedData.name, k)}{t('analytics.times')} #{rank}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="text-center pt-2 border-t border-border">
                <span className="text-2xl font-bold text-primary">{Math.round(selectedData.totalScore * 10) / 10}</span>
                <span className="text-sm text-muted-foreground ml-1">{t('analytics.totalScore')}</span>
                <span className="text-sm text-muted-foreground ml-3">
                  {t('analytics.rank')} #{analyticsData.findIndex(s => s.name === selectedData.name) + 1}/{analyticsData.length}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScoringRulesConfig
        open={showRulesConfig}
        onOpenChange={setShowRulesConfig}
        rules={rules}
        onRulesChange={setRules}
      />
    </div>
  );
}
