import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Download, QrCode, StopCircle, Trash2, Clock, RotateCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  createSeatCheckinSession,
  deleteSeatCheckinSession,
  endSeatCheckinSession,
  loadSeatCheckinRecords,
  loadSeatCheckinSessionHistory,
  type SeatCheckinRecord,
  type SeatCheckinSessionSummary,
} from '@/lib/seat-checkin-session';
import { downloadSvgAsPng } from '@/lib/qr-download';
import QRActionPanel from '@/components/qr/QRActionPanel';
import {
  getRequireSeatAssignmentBeforeCheckin,
  isSeatAssignmentComplete,
  setRequireSeatAssignmentBeforeCheckin,
} from '@/lib/seat-checkin-policy';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatData: unknown;
  studentNames: string[];
  sceneConfig: Record<string, unknown>;
  sceneType: string;
  className?: string;
  pngFileName?: string;
  onSessionCreated?: (payload: { sessionId: string; checkinUrl: string }) => void;
}

export default function SeatCheckinDialog({
  open,
  onOpenChange,
  seatData,
  studentNames,
  sceneConfig,
  sceneType,
  className,
  pngFileName,
  onSessionCreated,
}: Props) {
  const [currentSession, setCurrentSession] = useState<SeatCheckinSessionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [records, setRecords] = useState<SeatCheckinRecord[]>([]);
  const [historySessions, setHistorySessions] = useState<SeatCheckinSessionSummary[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [requireSeatAssignment, setRequireSeatAssignment] = useState(() => getRequireSeatAssignmentBeforeCheckin());
  const qrPreviewRef = useRef<HTMLDivElement>(null);

  const seatAssignmentComplete = useMemo(
    () => isSeatAssignmentComplete(seatData, studentNames),
    [seatData, studentNames],
  );

  const refreshHistory = async () => {
    const next = await loadSeatCheckinSessionHistory(sceneType);
    setHistorySessions(next);
  };

  useEffect(() => {
    if (!open) return;
    void refreshHistory();
  }, [open, sceneType]);

  useEffect(() => {
    if (!currentSession) {
      setRecords([]);
      setTimeLeft(null);
      return;
    }

    void loadSeatCheckinRecords(currentSession.id).then(setRecords);

    const remaining = currentSession.status === 'active'
      ? Math.max(
          0,
          currentSession.duration_minutes * 60 - Math.floor((Date.now() - new Date(currentSession.created_at).getTime()) / 1000),
        )
      : 0;
    setTimeLeft(currentSession.status === 'active' ? remaining : null);

    const channel = supabase
      .channel(`seat-checkin-${currentSession.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'seat_checkin_records',
        filter: `session_id=eq.${currentSession.id}`,
      }, (payload) => {
        const record = payload.new as SeatCheckinRecord;
        setRecords(prev => prev.some(item => item.id === record.id) ? prev : [...prev, record]);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [currentSession?.id]);

  useEffect(() => {
    if (!currentSession || currentSession.status !== 'active' || timeLeft === null) return;
    if (timeLeft <= 0) {
      void handleEndSession();
      return;
    }

    const timerId = window.setInterval(() => {
      setTimeLeft(prev => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [currentSession?.id, currentSession?.status, timeLeft]);

  const createSession = async () => {
    if (requireSeatAssignment && !seatAssignmentComplete) {
      toast({ title: '请先完成排座后再发起签到', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const created = await createSeatCheckinSession({
        seatData,
        studentNames,
        sceneConfig,
        sceneType,
        durationMinutes,
        className,
      });
      setCurrentSession(created.session);
      setRecords([]);
      onSessionCreated?.({ sessionId: created.sessionId, checkinUrl: created.checkinUrl });
      await refreshHistory();
    } catch (err) {
      const description = err instanceof Error ? err.message : undefined;
      toast({ title: '创建签到失败', description, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!currentSession || currentSession.status !== 'active') return;
    setEnding(true);
    try {
      await endSeatCheckinSession(currentSession.id);
      const endedAt = new Date().toISOString();
      setCurrentSession(prev => prev ? { ...prev, status: 'ended', ended_at: endedAt } : null);
      setTimeLeft(null);
      await refreshHistory();
      toast({ title: '签到已结束' });
    } catch {
      toast({ title: '结束签到失败', variant: 'destructive' });
    } finally {
      setEnding(false);
    }
  };

  const handleDeleteSession = async (session: SeatCheckinSessionSummary) => {
    setDeletingSessionId(session.id);
    try {
      await deleteSeatCheckinSession(session.id);
      if (currentSession?.id === session.id) {
        setCurrentSession(null);
        setRecords([]);
        setTimeLeft(null);
      }
      await refreshHistory();
      toast({ title: '签到记录已删除' });
    } catch {
      toast({ title: '删除签到记录失败', variant: 'destructive' });
    } finally {
      setDeletingSessionId(null);
    }
  };

  const checkinUrl = currentSession
    ? `${window.location.origin}/seat-checkin/${currentSession.id}`
    : '';
  const resolvedPngFileName = `${(pngFileName?.trim() || className?.trim() || '座位签到二维码')}.png`;

  const checkedInNames = useMemo(() => Array.from(new Set(records.map(record => record.student_name.trim()))), [records]);
  const currentStudentNames = currentSession?.student_names ?? studentNames;
  const uncheckedNames = currentStudentNames.filter(name => !checkedInNames.includes(name.trim()));

  const formatTimeLeft = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const openHistorySession = async (session: SeatCheckinSessionSummary) => {
    setCurrentSession(session);
    const nextRecords = await loadSeatCheckinRecords(session.id);
    setRecords(nextRecords);
  };

  const handleToggleRequirement = (checked: boolean) => {
    setRequireSeatAssignment(checked);
    setRequireSeatAssignmentBeforeCheckin(checked);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setCurrentSession(null); setRecords([]); setTimeLeft(null); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" /> 座位签到
          </DialogTitle>
        </DialogHeader>

        {!currentSession ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              生成签到二维码后，学生扫码输入姓名即可查看自己的座位位置，并获得导航指引。
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">签到时长</span>
              <Input
                type="number"
                min={1}
                max={120}
                value={durationMinutes}
                onChange={e => setDurationMinutes(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                className="h-9 w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">分钟</span>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">签到前需完成排座</p>
                <Switch checked={requireSeatAssignment} onCheckedChange={handleToggleRequirement} />
              </div>
              <p className="text-xs text-muted-foreground">
                缺省开启。关闭后可无需排座直接发起签到。
              </p>
              {requireSeatAssignment && !seatAssignmentComplete && (
                <p className="text-xs text-destructive">当前尚未完成排座，暂不可发起签到。</p>
              )}
            </div>

            <Button onClick={createSession} disabled={loading || (requireSeatAssignment && !seatAssignmentComplete)} className="w-full">
              {loading ? '生成中...' : '生成签到码'}
            </Button>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">签到记录</p>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void refreshHistory()}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> 刷新
                </Button>
              </div>
              {historySessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无签到记录</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-auto pr-1">
                  {historySessions.map(session => {
                    const isDeleting = deletingSessionId === session.id;
                    return (
                      <div key={session.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between gap-2">
                          <button className="flex-1 text-left" onClick={() => void openHistorySession(session)}>
                            <p className="text-sm font-medium text-foreground truncate">{session.class_name || '座位签到'}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.created_at).toLocaleString()} · {session.duration_minutes} 分钟 · {session.status === 'active' ? '进行中' : '已结束'}
                            </p>
                          </button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-muted-foreground hover:text-destructive" onClick={() => void handleDeleteSession(session)} disabled={isDeleting}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">

            {(currentSession.class_name || className) && (
              <p className="text-center text-sm font-medium text-foreground">{currentSession.class_name || className}</p>
            )}

            <div className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Clock className="w-4 h-4" />
                <span>{currentSession.status === 'active' && timeLeft !== null ? formatTimeLeft(timeLeft) : '已结束'}</span>
              </div>
              <div className="text-muted-foreground">
                已签 {checkedInNames.length} / {currentStudentNames.length}
              </div>
            </div>

            <QRActionPanel
              url={checkinUrl}
              qrSize={200}
              qrContainerRef={qrPreviewRef}
              className="flex flex-col items-center gap-3"
              actions={(
                <>
                  <Button variant="outline" size="sm" className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap" onClick={copyUrl}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? '已复制' : '分享链接'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap"
                    onClick={async () => {
                      try {
                        const svg = qrPreviewRef.current?.querySelector('svg');
                        if (!svg) throw new Error('QR not ready');
                        await downloadSvgAsPng(svg as SVGSVGElement, resolvedPngFileName);
                        toast({ title: '下载PNG成功' });
                      } catch {
                        toast({ title: '下载PNG失败', variant: 'destructive' });
                      }
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> 下载PNG
                  </Button>
                </>
              )}
            />

            <div className="w-full border-t border-border pt-3">
              <p className="text-sm font-medium mb-2">
                已签到: {checkedInNames.length} / {currentStudentNames.length}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
                {currentStudentNames.map(name => (
                  <span
                    key={name}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      checkedInNames.includes(name)
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>

            {currentSession.status === 'ended' && (
              <div className="w-full rounded-lg border border-border bg-card p-3 text-sm">
                <p className="font-medium text-foreground">签到统计</p>
                <p className="text-muted-foreground mt-1">已签：{checkedInNames.length} 人</p>
                <p className="text-muted-foreground">未签：{uncheckedNames.length} 人</p>
              </div>
            )}

            <div className="flex w-full gap-2">
              {currentSession.status === 'active' ? (
                <Button variant="destructive" onClick={() => void handleEndSession()} className="flex-1" disabled={ending}>
                  <StopCircle className="w-4 h-4 mr-2" /> {ending ? '结束中...' : '结束签到'}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setCurrentSession(null)} className="flex-1">
                  返回记录
                </Button>
              )}
              <Button variant="outline" onClick={() => void handleDeleteSession(currentSession)} disabled={deletingSessionId === currentSession.id}>
                <Trash2 className="w-4 h-4 mr-1" /> 删除
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
