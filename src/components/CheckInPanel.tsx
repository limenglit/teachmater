import { useState, useEffect, useRef } from 'react';
import { useStudents } from '@/contexts/StudentContext';
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
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history.unshift({
      session,
      records,
      unchecked: studentNames.filter(n => !records.some(r => r.student_name === n && r.status === 'matched')),
      savedAt: new Date().toISOString(),
    });
    // Keep last 50
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch { }
}

export default function CheckInPanel() {
  const { students } = useStudents();
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

    // First, load existing records for this session
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
      toast({ title: '创建签到失败', variant: 'destructive' });
      return;
    }

    setSession(data as SessionData);
    setRecords([]);
    setLeaveSet(new Set());
    setTimeLeft(duration * 60);
    toast({ title: '签到已开始', description: `时长 ${duration} 分钟` });
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
    toast({ title: '签到已结束' });
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
    const lines = ['姓名,状态,时间'];
    records.filter(r => r.status === 'matched').forEach(r => {
      lines.push(`${r.student_name},已签到,${new Date(r.checked_in_at).toLocaleString()}`);
    });
    uncheckedStudents.forEach(n => {
      lines.push(`${n},${leaveSet.has(n) ? '请假' : '未签到'},`);
    });
    unknownRecords.forEach(r => {
      lines.push(`${r.student_name},未知,${new Date(r.checked_in_at).toLocaleString()}`);
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `签到记录_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  // History view
  if (showHistory) {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return (
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">签到历史</h2>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(false)}>返回</Button>
          </div>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">暂无签到记录</p>
          ) : (
            <div className="space-y-3">
              {history.map((h: any, i: number) => (
                <div key={i} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {new Date(h.session.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">{h.session.duration_minutes}分钟</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    已签到: {h.records.filter((r: any) => r.status === 'matched').length} 人 ·
                    未签到: {h.unchecked?.length || 0} 人
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
          <h2 className="text-xl font-bold text-foreground">课堂签到</h2>
          <p className="text-sm text-muted-foreground">发起签到后，学生扫码即可完成签到</p>

          <div className="flex items-center justify-center gap-3">
            <label className="text-sm text-muted-foreground">签到时长</label>
            <Input
              type="number"
              min={1}
              max={30}
              value={duration}
              onChange={e => setDuration(Math.max(1, Math.min(30, Number(e.target.value))))}
              className="w-20 h-9 text-center"
            />
            <span className="text-sm text-muted-foreground">分钟</span>
          </div>

          <Button onClick={handleStart} size="lg" className="gap-2">
            <QrCode className="w-5 h-5" /> 发起签到
          </Button>

          <div className="pt-4">
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)} className="text-muted-foreground">
              查看签到历史
            </Button>
          </div>

          {session?.status === 'ended' && (
            <div className="border border-border rounded-lg p-4 bg-card text-left space-y-3 mt-6">
              <div ref={resultExportRef} className="space-y-3 p-2">
                <h3 className="font-semibold text-foreground">上次签到结果</h3>
                <div className="text-sm text-muted-foreground">
                  已签到 {checkedNames.length} 人，未签到 {uncheckedStudents.length} 人
                  {unknownRecords.length > 0 && `，未知 ${unknownRecords.length} 人`}
                </div>
                <div className="space-y-1">
                  {records.filter(r => r.status === 'matched').map(r => (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{r.student_name}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.checked_in_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
                {uncheckedStudents.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground font-medium">未签到：</p>
                    {uncheckedStudents.map(n => (
                      <div key={n} className="text-sm text-muted-foreground">{n}{leaveSet.has(n) ? '（请假）' : ''}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <ExportButtons targetRef={resultExportRef as React.RefObject<HTMLElement>} filename="签到记录" />
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-8 text-xs">
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active session
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Clock className="w-4 h-4" />
            <span className={timeLeft !== null && timeLeft < 60 ? 'text-destructive animate-pulse' : ''}>
              {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            已签到 {checkedNames.length}/{studentNames.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 h-8 text-xs">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <ExportButtons targetRef={exportRef as React.RefObject<HTMLElement>} filename="签到记录" />
          <Button variant="destructive" size="sm" onClick={handleEnd} className="gap-1 h-8">
            <StopCircle className="w-3.5 h-3.5" /> 结束签到
          </Button>
        </div>
      </div>

      {/* QR Code + Lists */}
      <div className="flex-1 flex overflow-hidden" ref={exportRef}>
        {/* Left: QR + unchecked */}
        <div className="w-1/2 border-r border-border flex flex-col overflow-hidden">
          {/* QR Code */}
          <div className="p-4 border-b border-border bg-card flex flex-col items-center gap-2">
            <QRCodeSVG value={checkinUrl} size={160} />
            <p className="text-xs text-muted-foreground">学生扫码签到</p>
          </div>
          {/* Unchecked */}
          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-destructive" /> 未签到 ({uncheckedStudents.length})
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
                    <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded">请假</span>
                  )}
                </div>
              ))}
            </div>
            {unknownRecords.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-foreground mt-4 mb-2 flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-muted-foreground" /> 未知 ({unknownRecords.length})
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

        {/* Right: checked */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary" /> 已签到 ({checkedNames.length})
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
