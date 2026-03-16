import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import RadarChart from './RadarChart';
import { type ScoringRules, type DimensionKey, type StudentDimensionData, DIMENSION_KEYS } from './analyticsTypes';

interface Props {
  analyticsData: StudentDimensionData[];
  rules: ScoringRules;
  getRawCount: (name: string, dim: DimensionKey) => number;
}

export default function ClassOverview({ analyticsData, rules, getRawCount }: Props) {
  const { t } = useLanguage();
  const enabledKeys = DIMENSION_KEYS.filter(k => rules[k].enabled);

  const stats = useMemo(() => {
    const n = analyticsData.length;
    if (n === 0) return null;

    const avgScore = analyticsData.reduce((s, d) => s + d.totalScore, 0) / n;
    const maxScore = Math.max(...analyticsData.map(d => d.totalScore));
    const minScore = Math.min(...analyticsData.map(d => d.totalScore));
    const median = (() => {
      const sorted = [...analyticsData].sort((a, b) => a.totalScore - b.totalScore);
      const mid = Math.floor(n / 2);
      return n % 2 ? sorted[mid].totalScore : (sorted[mid - 1].totalScore + sorted[mid].totalScore) / 2;
    })();

    // Per-dimension stats
    const dimStats = enabledKeys.map(k => {
      const rawCounts = analyticsData.map(s => getRawCount(s.name, k));
      const total = rawCounts.reduce((a, b) => a + b, 0);
      const active = rawCounts.filter(c => c > 0).length;
      const avg = total / n;
      const max = Math.max(...rawCounts);
      return { key: k, total, active, participationRate: (active / n) * 100, avg, max };
    });

    // Overall participation: students with at least 1 activity in any dimension
    const activeStudents = analyticsData.filter(s =>
      enabledKeys.some(k => getRawCount(s.name, k) > 0)
    ).length;

    // Class radar: average normalized values
    const radarValues = enabledKeys.map(k => {
      const maxVal = Math.max(...analyticsData.map(s => s[k]), 1);
      const avg = analyticsData.reduce((s, d) => s + d[k], 0) / n;
      return (avg / maxVal) * 100;
    });

    return { avgScore, maxScore, minScore, median, dimStats, activeStudents, radarValues, n };
  }, [analyticsData, rules, enabledKeys, getRawCount]);

  if (!stats) return null;

  const getDimIcon = (key: DimensionKey) => {
    const icons: Record<DimensionKey, string> = {
      board_participate: '🎨', board_quality: '❤️', task_complete: '✅',
      barrage_participate: '💬', quiz_participate: '📝', checkin: '📋',
    };
    return icons[key];
  };

  const summaryCards = [
    { label: t('analytics.classAvg'), value: (Math.round(stats.avgScore * 10) / 10).toString(), sub: t('analytics.pts'), color: 'text-primary' },
    { label: t('analytics.classMedian'), value: (Math.round(stats.median * 10) / 10).toString(), sub: t('analytics.pts'), color: 'text-primary' },
    { label: t('analytics.classMax'), value: (Math.round(stats.maxScore * 10) / 10).toString(), sub: t('analytics.pts'), color: 'text-green-600 dark:text-green-400' },
    { label: t('analytics.classMin'), value: (Math.round(stats.minScore * 10) / 10).toString(), sub: t('analytics.pts'), color: 'text-orange-600 dark:text-orange-400' },
    { label: t('analytics.classParticipation'), value: `${Math.round((stats.activeStudents / stats.n) * 100)}%`, sub: `${stats.activeStudents}/${stats.n}`, color: 'text-primary' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {summaryCards.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="text-center">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-muted-foreground">{c.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Class Radar Chart */}
      <Card>
        <CardContent className="p-4 flex flex-col items-center">
          <p className="text-sm font-medium text-foreground mb-2">{t('analytics.classRadar')}</p>
          <RadarChart
            labels={enabledKeys.map(k => t(`analytics.dim_${k}_short`))}
            values={stats.radarValues}
            size={200}
          />
        </CardContent>
      </Card>

      {/* Per-Dimension Table */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground mb-3">{t('analytics.dimStats')}</p>
          <div className="space-y-2">
            {stats.dimStats.map((ds, i) => (
              <motion.div
                key={ds.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2"
              >
                <span className="w-5 text-center text-sm">{getDimIcon(ds.key)}</span>
                <span className="w-16 text-xs font-medium text-foreground truncate">{t(`analytics.dim_${ds.key}_short`)}</span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full bg-primary/60 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${ds.participationRate}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-foreground">
                    {Math.round(ds.participationRate)}%
                  </span>
                </div>
                <div className="w-32 text-right text-[10px] text-muted-foreground space-x-2">
                  <span>{t('analytics.classTotal')}: {ds.total}</span>
                  <span>Avg: {(Math.round(ds.avg * 10) / 10)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Score Distribution */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground mb-3">{t('analytics.scoreDistribution')}</p>
          <div className="flex items-end gap-1 h-24">
            {(() => {
              const buckets = [0, 0, 0, 0, 0]; // 0-20%, 20-40%, 40-60%, 60-80%, 80-100%
              const labels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
              const maxScore = Math.max(...analyticsData.map(d => d.totalScore), 1);
              analyticsData.forEach(d => {
                const pct = (d.totalScore / maxScore) * 100;
                const idx = Math.min(Math.floor(pct / 20), 4);
                buckets[idx]++;
              });
              const maxBucket = Math.max(...buckets, 1);
              return buckets.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">{count}</span>
                  <motion.div
                    className="w-full bg-primary/50 rounded-t"
                    initial={{ height: 0 }}
                    animate={{ height: `${(count / maxBucket) * 80}px` }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                  />
                  <span className="text-[8px] text-muted-foreground">{labels[i]}</span>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
