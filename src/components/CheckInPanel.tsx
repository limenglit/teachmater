import { useState, useEffect, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, QrCode, StopCircle, Download, CheckCircle2, XCircle, UserX } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import { toast } from '@/hooks/use-toast';

interface CheckinRecord {
  id: string;
  student_name: string;
  checked_in_at: string;
  status: string;
}

interface SessionData {
  id: string;
  created_at: string;
  duration_minutes: number;
  status: string;
  ended_at: string | null;
  creator_token: string;
}

const HISTORY_KEY = 'teachmate_checkin_history';

function saveHistory(session: SessionData, records: CheckinRecord[], studentNames: string[]) {
  try {
    const history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
    history.unshift({
      session,
      records,
      unchecked: studentNames.filter(n => !records.some(r => r.student_name === n && r.status === 'matched')),
      savedAt: new Date().toISOString(),
    });
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch { }
}

export default function CheckInPanel() {
  const { students } = useStudents();
  const { t } = useLanguage();
  const [session, setSession] = useState<SessionData | null>(null);
  const [records, setRecords] = useState<CheckinRecord[]>([]);
  const [duration, setDuration] = useState(5);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [leaveSet, setLeaveSet] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const resultExportRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const studentNames = students.map(s => s.name);

  // Real-time subscription
  useEffect(() => {
    if (!session || session.status !== 'active') return;

    const loadExisting = async () => {
      const { data } = await supabase
        .from('checkin_records')
        .select('*')
        .eq('session_id', session.id);
      if (data) {
        setRecords(data as CheckinRecord[]);
      }
    };
    loadExisting();

    const channel = supabase
      .channel(`checkin-${session.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkin_records',
        filter: `session_id=eq.${session.id}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const rec = payload.new as CheckinRecord;
          const names = students.map(s => s.name);
          const isMatch = names.some(n => n.trim() === rec.student_name.trim());
          const finalStatus = isMatch ? 'matched' : 'unknown';
          
          if (rec.status !== finalStatus) {
            await supabase
              .from('checkin_records')
              .update({ status: finalStatus })
              .eq('id', rec.id);
          }
          
          const updatedRec = { ...rec, status: finalStatus };
          setRecords(prev => {
            if (prev.some(r => r.id === rec.id)) return prev;
            return [...prev, updatedRec];
          });
        } else if (payload.eventType === 'UPDATE') {
          const rec = payload.new as CheckinRecord;
          setRecords(prev => prev.map(r => r.id === rec.id ? rec : r));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.id, session?.status, students]);

  // Timer countdown
  useEffect(() => {
    if (!session || session.status !== 'active' || timeLeft === null || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [session?.id, session?.status, timeLeft]);

  // Auto-end when time runs out
  useEffect(() => {
    if (timeLeft === 0 && session?.status === 'active') {
      handleEnd();
    }
  }, [timeLeft]);

  const handleStart = async () => {
    const { data, error } = await supabase
      .from('checkin_sessions')
      .insert({ duration_minutes: duration, student_names: studentNames } as any)
      .select()
      .single();

    if (error || !data) {
      toast({ title: t('checkin.createFailed'), variant: 'destructive' });
      return;
    }

    setSession(data as SessionData);
    setRecords([]);
    setLeaveSet(new Set());
    setTimeLeft(duration * 60);
    toast({ title: t('checkin.started'), description: t('checkin.startedDesc').replace('{0}', String(duration)) });
  };

  const handleEnd = async () => {
    if (!session) return;
    clearInterval(timerRef.current);

    await supabase
      .from('checkin_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', session.id);

    const ended = { ...session, status: 'ended', ended_at: new Date().toISOString() };
    setSession(ended);
    setTimeLeft(null);
    saveHistory(ended, records, studentNames);
    toast({ title: t('checkin.ended') });
  };

  const toggleLeave = (name: string) => {
    setLeaveSet(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const checkedNames = records.filter(r => r.status === 'matched').map(r => r.student_name);
  const unknownRecords = records.filter(r => r.status === 'unknown');
  const uncheckedStudents = studentNames.filter(n => !checkedNames.includes(n));

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const checkinUrl = session
    ? `${window.location.origin}/checkin/${session.id}`
    : '';

  const exportCSV = () => {
    const lines = [`${t('checkin.csvName')},${t('checkin.csvStatus')},${t('checkin.csvTime')}`];
    records.filter(r => r.status === 'matched').forEach(r => {
      lines.push(`${r.student_name},${t('checkin.csvChecked')},${new Date(r.checked_in_at).toLocaleString()}`);
    });
    uncheckedStudents.forEach(n => {
      lines.push(`${n},${leaveSet.has(n) ? t('checkin.csvLeave') : t('checkin.csvUnchecked')},`);
    });
    unknownRecords.forEach(r => {
      lines.push(`${r.student_name},${t('checkin.csvUnknown')},${new Date(r.checked_in_at).toLocaleString()}`);
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${t('checkin.exportName')}_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}${t('checkin.secondsUnit')}`;
    return t('checkin.minuteSecond').replace('{0}', String(Math.floor(s / 60))).replace('{1}', String(s % 60));
  };

  // History view
  if (showHistory) {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return (
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">{t('checkin.historyTitle')}</h2>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(false)}>{t('checkin.back')}</Button>
          </div>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">{t('checkin.noHistory')}</p>
          ) : (
            <div className="space-y-3">
              {history.map((h: any, i: number) => (
                <div key={i} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {new Date(h.session.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">{h.session.duration_minutes}{t('checkin.minutes')}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('checkin.checkedIn')}: {h.records.filter((r: any) => r.status === 'matched').length} {t('random.persons')} ·
                    {t('checkin.unchecked')}: {h.unchecked?.length || 0} {t('random.persons')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not started
  if (!session || session.status === 'ended') {
    return (
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-md mx-auto text-center space-y-6 pt-12">
          <div className="text-6xl">📋</div>
          <h2 className="text-xl font-bold text-foreground">{t('checkin.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('checkin.desc')}</p>

          <div className="flex items-center justify-center gap-3">
            <label className="text-sm text-muted-foreground">{t('checkin.duration')}</label>
            <Input
              type="number"
              min={1}
              max={30}
              value={duration}
              onChange={e => setDuration(Math.max(1, Math.min(30, Number(e.target.value))))}
              className="w-20 h-9 text-center"
            />
            <span className="text-sm text-muted-foreground">{t('checkin.minutes')}</span>
          </div>

          <Button onClick={handleStart} size="lg" className="gap-2">
            <QrCode className="w-5 h-5" /> {t('checkin.start')}
          </Button>

          <div className="pt-4">
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)} className="text-muted-foreground">
              {t('checkin.history')}
            </Button>
          </div>

          {session?.status === 'ended' && (() => {
            const matchedRecords = records.filter(r => r.status === 'matched');
            const totalStudents = studentNames.length;
            const checkinRate = totalStudents > 0 ? Math.round((matchedRecords.length / totalStudents) * 100) : 0;
            const leaveCount = uncheckedStudents.filter(n => leaveSet.has(n)).length;
            const absentCount = uncheckedStudents.length - leaveCount;

            const sessionStart = new Date(session.created_at).getTime();
            const checkinTimes = matchedRecords.map(r => (new Date(r.checked_in_at).getTime() - sessionStart) / 1000);
            const avgTime = checkinTimes.length > 0 ? Math.round(checkinTimes.reduce((a, b) => a + b, 0) / checkinTimes.length) : 0;
            const fastestTime = checkinTimes.length > 0 ? Math.round(Math.min(...checkinTimes)) : 0;
            const slowestTime = checkinTimes.length > 0 ? Math.round(Math.max(...checkinTimes)) : 0;

            return (
            <div className="border border-border rounded-lg p-4 bg-card text-left space-y-4 mt-6">
              <div ref={resultExportRef} className="space-y-4 p-2">
                <h3 className="font-semibold text-foreground text-base">{t('checkin.stats')}</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-primary/10 p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{checkinRate}%</div>
                    <div className="text-xs text-muted-foreground mt-1">{t('checkin.rate')}</div>
                  </div>
                  <div className="rounded-lg bg-accent p-3 text-center">
                    <div className="text-2xl font-bold text-accent-foreground">{matchedRecords.length}<span className="text-sm font-normal text-muted-foreground">/{totalStudents}</span></div>
                    <div className="text-xs text-muted-foreground mt-1">{t('checkin.checkedIn')}</div>
                  </div>
                  <div className="rounded-lg bg-destructive/10 p-3 text-center">
                    <div className="text-2xl font-bold text-destructive">{absentCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t('checkin.absent')}</div>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{leaveCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t('checkin.leave')}</div>
                  </div>
                </div>

                {matchedRecords.length > 0 && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('checkin.timeStats')}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{formatDuration(avgTime)}</div>
                        <div className="text-xs text-muted-foreground">{t('checkin.avgTime')}</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-primary">{formatDuration(fastestTime)}</div>
                        <div className="text-xs text-muted-foreground">{t('checkin.fastest')}</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-destructive">{formatDuration(slowestTime)}</div>
                        <div className="text-xs text-muted-foreground">{t('checkin.slowest')}</div>
                      </div>
                    </div>
                  </div>
                )}

                {unknownRecords.length > 0 && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t('checkin.unknownCheckin')} ({unknownRecords.length}{t('random.persons')})</p>
                    <div className="text-sm text-muted-foreground">{unknownRecords.map(r => r.student_name).join('、')}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-primary flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t('checkin.checkedIn')} ({matchedRecords.length})</p>
                    {matchedRecords.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm pl-4">
                        <span className="text-foreground">{r.student_name}</span>
                        <span className="text-xs text-muted-foreground">{new Date(r.checked_in_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                  {uncheckedStudents.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" /> {t('checkin.unchecked')} ({uncheckedStudents.length})</p>
                      {uncheckedStudents.map(n => (
                        <div key={n} className="text-sm pl-4 text-muted-foreground">
                          {n}{leaveSet.has(n) ? <span className="text-xs ml-1 bg-accent text-accent-foreground px-1 py-0.5 rounded">{t('checkin.leave')}</span> : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <ExportButtons targetRef={resultExportRef as React.RefObject<HTMLElement>} filename={t('checkin.exportName')} />
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-8 text-xs">
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </div>
            </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // Active session
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Clock className="w-4 h-4" />
            <span className={timeLeft !== null && timeLeft < 60 ? 'text-destructive animate-pulse' : ''}>
              {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {t('checkin.checkedIn')} {checkedNames.length}/{studentNames.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 h-8 text-xs">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <ExportButtons targetRef={exportRef as React.RefObject<HTMLElement>} filename={t('checkin.exportName')} />
          <Button variant="destructive" size="sm" onClick={handleEnd} className="gap-1 h-8">
            <StopCircle className="w-3.5 h-3.5" /> {t('checkin.endCheckin')}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden" ref={exportRef}>
        <div className="w-1/2 border-r border-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-card flex flex-col items-center gap-2">
            <QRCodeSVG value={checkinUrl} size={160} />
            <p className="text-xs text-muted-foreground">{t('checkin.scanToCheckin')}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-destructive" /> {t('checkin.unchecked')} ({uncheckedStudents.length})
            </h3>
            <div className="space-y-1">
              {uncheckedStudents.map(name => (
                <div key={name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
                  <Checkbox
                    checked={leaveSet.has(name)}
                    onCheckedChange={() => toggleLeave(name)}
                  />
                  <span className={`text-sm ${leaveSet.has(name) ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {name}
                  </span>
                  {leaveSet.has(name) && (
                    <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded">{t('checkin.leave')}</span>
                  )}
                </div>
              ))}
            </div>
            {unknownRecords.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-foreground mt-4 mb-2 flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-muted-foreground" /> {t('checkin.unknown')} ({unknownRecords.length})
                </h3>
                <div className="space-y-1">
                  {unknownRecords.map(r => (
                    <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                      <span>{r.student_name}</span>
                      <span className="text-xs">{new Date(r.checked_in_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary" /> {t('checkin.checkedIn')} ({checkedNames.length})
            </h3>
            <div className="space-y-1">
              {records.filter(r => r.status === 'matched').map(r => (
                <div key={r.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-primary/5">
                  <span className="text-sm font-medium text-foreground">{r.student_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.checked_in_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
