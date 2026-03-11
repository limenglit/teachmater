import { useState, useEffect, useCallback } from 'react';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/contexts/StudentContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { BarChart3, PieChart, Plus, Trash2, QrCode, ArrowLeft, Lock, Unlock, X, Download, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import ClassRosterPicker from '@/components/ClassRosterPicker';
import RosterQuickBind from '@/components/RosterQuickBind';

interface PollOption {
  label: string;
  color: string;
}

interface Poll {
  id: string;
  title: string;
  poll_type: 'single' | 'multiple';
  options: PollOption[];
  creator_token: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  user_id: string | null;
}

interface PollVote {
  id: string;
  poll_id: string;
  voter_token: string;
  voter_name: string;
  selected_options: number[];
  created_at: string;
}

const POLL_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const STORAGE_KEY = 'poll-creator-tokens';

function getCreatorTokens(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveCreatorToken(pollId: string, token: string) {
  const tokens = getCreatorTokens();
  tokens[pollId] = token;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}
function getCreatorToken(pollId: string): string | null {
  return getCreatorTokens()[pollId] || null;
}

export default function PollManager() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students } = useStudents();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [loading, setLoading] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [linkedNames, setLinkedNames] = useState<string[]>([]);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'single' | 'multiple'>('single');
  const [newOptions, setNewOptions] = useState<string[]>(['', '']);

  useEffect(() => {
    loadPolls();
  }, []);

  const loadPolls = async () => {
    setLoading(true);
    const tokens = Object.values(getCreatorTokens());
    let allPolls: Poll[] = [];

    if (user) {
      const { data } = await supabase.from('polls').select('*').eq('user_id', user.id).order('created_at', { ascending: false }) as any;
      if (data) allPolls = data;
    }
    if (tokens.length > 0) {
      const { data } = await supabase.from('polls').select('*').in('creator_token', tokens).order('created_at', { ascending: false }) as any;
      if (data) {
        for (const p of data) {
          if (!allPolls.find(ap => ap.id === p.id)) allPolls.push(p);
        }
      }
    }
    setPolls(allPolls);
    setLoading(false);
  };

  const createPoll = async () => {
    const resolvedNames = linkedNames.length > 0 ? linkedNames : students.map(s => s.name);
    if (resolvedNames.length === 0) {
      toast({ title: t('board.requireRosterFirst'), variant: 'destructive' });
      return;
    }

    const title = newTitle.trim();
    const options = newOptions.filter(o => o.trim()).map((label, i) => ({
      label: label.trim(),
      color: POLL_COLORS[i % POLL_COLORS.length],
    }));
    if (!title || options.length < 2) {
      toast({ title: t('poll.minOptions'), variant: 'destructive' });
      return;
    }

    const insertData: any = { title, poll_type: newType, options };
    if (user) insertData.user_id = user.id;

    const { data, error } = await supabase.from('polls').insert(insertData).select().single() as any;
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }

    saveCreatorToken(data.id, data.creator_token);
    setPolls(prev => [data, ...prev]);
    setShowCreate(false);
    setNewTitle('');
    setNewType('single');
    setNewOptions(['', '']);
    openPoll(data);
  };

  const openPoll = async (poll: Poll) => {
    setActivePoll(poll);
    const { data } = await supabase.from('poll_votes').select('*').eq('poll_id', poll.id) as any;
    setVotes(data || []);
  };

  const deletePoll = async (poll: Poll) => {
    if (!confirm(t('poll.deleteConfirm'))) return;
    const token = getCreatorToken(poll.id);
    if (token) {
      await supabase.rpc('delete_poll', { p_poll_id: poll.id, p_token: token });
    }
    setPolls(prev => prev.filter(p => p.id !== poll.id));
    if (activePoll?.id === poll.id) setActivePoll(null);
  };

  const togglePollStatus = async () => {
    if (!activePoll) return;
    const token = getCreatorToken(activePoll.id);
    if (!token) return;
    const newStatus = activePoll.status === 'active' ? 'ended' : 'active';
    await supabase.rpc('update_poll', { p_poll_id: activePoll.id, p_token: token, p_status: newStatus });
    const updated = { ...activePoll, status: newStatus };
    setActivePoll(updated);
    setPolls(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  // Realtime subscription
  useEffect(() => {
    if (!activePoll) return;
    const channel = supabase
      .channel(`poll-votes-${activePoll.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'poll_votes',
        filter: `poll_id=eq.${activePoll.id}`,
      }, (payload) => {
        setVotes(prev => {
          if (prev.find(v => v.id === (payload.new as any).id)) return prev;
          return [...prev, payload.new as any];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activePoll?.id]);

  const exportCSV = () => {
    if (!activePoll) return;
    const header = 'Name,Selected Options,Time\n';
    const rows = votes.map(v => {
      const optLabels = (v.selected_options as number[]).map(i => activePoll.options[i]?.label || '?').join('; ');
      return `"${v.voter_name}","${optLabels}","${v.created_at}"`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `poll-${activePoll.title}.csv`;
    a.click();
  };

  // Compute results
  const getOptionCounts = () => {
    if (!activePoll) return [];
    return activePoll.options.map((opt, idx) => ({
      label: opt.label,
      color: opt.color,
      count: votes.filter(v => (v.selected_options as number[]).includes(idx)).length,
    }));
  };

  // Poll detail view
  if (activePoll) {
    const submitUrl = `${window.location.origin}/poll/${activePoll.id}`;
    const isCreator = !!getCreatorToken(activePoll.id);
    const optionCounts = getOptionCounts();
    const totalVotes = votes.length;
    const maxCount = Math.max(...optionCounts.map(o => o.count), 1);

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setActivePoll(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> {t('board.back')}
          </Button>
          <h2 className="font-semibold text-foreground text-sm truncate">{activePoll.title}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activePoll.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
            {activePoll.status === 'active' ? t('poll.active') : t('poll.ended')}
          </span>
          <span className="text-xs text-muted-foreground">
            {activePoll.poll_type === 'single' ? t('poll.typeSingle') : t('poll.typeMultiple')}
          </span>
          <span className="text-xs text-muted-foreground">
            {tFormat(t('poll.voteCount'), totalVotes)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button variant={chartType === 'bar' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setChartType('bar')}>
              <BarChart3 className="w-3 h-3 mr-1" /> {t('poll.barChart')}
            </Button>
            <Button variant={chartType === 'pie' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setChartType('pie')}>
              <PieChart className="w-3 h-3 mr-1" /> {t('poll.pieChart')}
            </Button>
            {isCreator && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowQR(true)}>
                  <QrCode className="w-3 h-3" /> {t('poll.qrcode')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={togglePollStatus}>
                  {activePoll.status === 'active' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {activePoll.status === 'active' ? t('poll.endPoll') : t('poll.reopenPoll')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportCSV}>
                  <Download className="w-3 h-3" /> {t('poll.export')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="max-w-3xl mx-auto">
            {chartType === 'bar' ? (
              <div className="space-y-4">
                {optionCounts.map((opt, idx) => {
                  const pct = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="space-y-1"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{opt.label}</span>
                        <span className="text-muted-foreground">{opt.count} ({pct}%)</span>
                      </div>
                      <div className="h-10 bg-muted rounded-lg overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${totalVotes > 0 ? (opt.count / maxCount) * 100 : 0}%` }}
                          transition={{ duration: 0.6, delay: idx * 0.05 }}
                          className="h-full rounded-lg flex items-center justify-end pr-2"
                          style={{ backgroundColor: opt.color, minWidth: opt.count > 0 ? '2rem' : 0 }}
                        >
                          {opt.count > 0 && <span className="text-white text-xs font-bold">{opt.count}</span>}
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <PieChartView optionCounts={optionCounts} totalVotes={totalVotes} />
            )}

            {/* Voter list */}
            {isCreator && votes.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-foreground mb-3">{t('poll.voterList')}</h3>
                <div className="max-h-[min(50vh,24rem)] overflow-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">{t('poll.voterName')}</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">{t('poll.selectedOptions')}</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">{t('poll.voteTime')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {votes.map(v => (
                        <tr key={v.id} className="border-t border-border">
                          <td className="px-3 py-2 text-foreground">{v.voter_name}</td>
                          <td className="px-3 py-2">
                            {(v.selected_options as number[]).map(i => (
                              <span key={i} className="inline-block mr-1 px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: activePoll.options[i]?.color || '#888' }}>
                                {activePoll.options[i]?.label || '?'}
                              </span>
                            ))}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{new Date(v.created_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* QR Dialog */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('poll.scanToVote')}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <QRCodeSVG value={submitUrl} size={200} level="M" />
              <p className="text-xs text-muted-foreground text-center break-all">{submitUrl}</p>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { navigator.clipboard.writeText(submitUrl); toast({ title: t('common.copied') }); }}>
                <Copy className="w-3 h-3" /> {t('common.copy')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Poll list / create view
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> {t('poll.title')}
        </h3>
        <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
          <Plus className="w-3 h-3" /> {t('poll.create')}
        </Button>
      </div>

      <RosterQuickBind
        className="mb-3 space-y-2"
        linkedCount={linkedNames.length}
        sidebarCount={students.length}
        onOpenRoster={() => setShowRoster(true)}
        onUseSidebar={() => setLinkedNames(students.map((s) => s.name))}
      />

      {/* Poll list */}
      {polls.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-6">{t('poll.empty')}</p>
      )}
      <div className="space-y-2">
        {polls.map(poll => (
          <div key={poll.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => openPoll(poll)}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{poll.title}</p>
              <p className="text-xs text-muted-foreground">
                {poll.poll_type === 'single' ? t('poll.typeSingle') : t('poll.typeMultiple')} · {(poll.options as any as PollOption[]).length} {t('poll.optionsCount')}
              </p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${poll.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
              {poll.status === 'active' ? t('poll.active') : t('poll.ended')}
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={e => { e.stopPropagation(); deletePoll(poll); }}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('poll.createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder={t('poll.titlePlaceholder')}
            />
            <div className="flex gap-2">
              <Button variant={newType === 'single' ? 'default' : 'outline'} size="sm" onClick={() => setNewType('single')}>
                {t('poll.typeSingle')}
              </Button>
              <Button variant={newType === 'multiple' ? 'default' : 'outline'} size="sm" onClick={() => setNewType('multiple')}>
                {t('poll.typeMultiple')}
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('poll.optionsLabel')}</p>
              {newOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: POLL_COLORS[idx % POLL_COLORS.length] }} />
                  <Input
                    value={opt}
                    onChange={e => {
                      const updated = [...newOptions];
                      updated[idx] = e.target.value;
                      setNewOptions(updated);
                    }}
                    placeholder={`${t('poll.option')} ${idx + 1}`}
                    className="flex-1"
                  />
                  {newOptions.length > 2 && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setNewOptions(prev => prev.filter((_, i) => i !== idx))}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              {newOptions.length < 8 && (
                <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setNewOptions(prev => [...prev, ''])}>
                  <Plus className="w-3 h-3" /> {t('poll.addOption')}
                </Button>
              )}
            </div>
            <Button className="w-full" onClick={createPoll} disabled={!newTitle.trim() || newOptions.filter(o => o.trim()).length < 2}>
              {t('poll.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ClassRosterPicker
        open={showRoster}
        onOpenChange={setShowRoster}
        onSelect={(names) => setLinkedNames(names)}
        currentCount={linkedNames.length}
        onClear={() => setLinkedNames([])}
      />
    </div>
  );
}

// Simple SVG pie chart
function PieChartView({ optionCounts, totalVotes }: { optionCounts: { label: string; color: string; count: number }[]; totalVotes: number }) {
  if (totalVotes === 0) {
    return <div className="text-center py-12 text-muted-foreground">No votes yet</div>;
  }

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = 110;
  let cumAngle = -Math.PI / 2;

  const slices = optionCounts.filter(o => o.count > 0).map(opt => {
    const angle = (opt.count / totalVotes) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const midAngle = startAngle + angle / 2;
    const labelX = cx + (r * 0.65) * Math.cos(midAngle);
    const labelY = cy + (r * 0.65) * Math.sin(midAngle);
    const pct = Math.round((opt.count / totalVotes) * 100);
    return { ...opt, path, labelX, labelY, pct };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <g key={i}>
            <motion.path
              d={s.path}
              fill={s.color}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
            {s.pct >= 5 && (
              <text x={s.labelX} y={s.labelY} textAnchor="middle" dominantBaseline="middle" className="text-xs fill-white font-bold" style={{ fontSize: '12px' }}>
                {s.pct}%
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 justify-center">
        {optionCounts.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5 text-sm">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
            <span className="text-foreground">{opt.label}</span>
            <span className="text-muted-foreground">({opt.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
