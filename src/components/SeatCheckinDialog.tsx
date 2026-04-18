import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Download, QrCode, StopCircle, Trash2, Clock, RotateCcw, UserCheck, Shuffle, UsersRound } from 'lucide-react';
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
} from '@/lib/seat-checkin-policy';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatData: unknown;
  studentNames: string[];
  seatAssignmentReady?: boolean;
  sceneConfig: Record<string, unknown>;
  sceneType: string;
  className?: string;
  pngFileName?: string;
  onSessionCreated?: (payload: { sessionId: string; checkinUrl: string }) => void;
}

const isSeatEmptyValue = (value: unknown) => value === null || value === '';

const SEAT_CHECKIN_GUEST_OVERRIDE_KEY = 'teachmate-seat-checkin-guest-overrides-v1';

type GuestOverrideMap = Record<string, Record<string, { seatHint: string; assignedKey?: string; confirmed?: boolean }>>;

const readGuestOverrides = (): GuestOverrideMap => {
  try {
    return JSON.parse(localStorage.getItem(SEAT_CHECKIN_GUEST_OVERRIDE_KEY) || '{}');
  } catch {
    return {};
  }
};
const writeGuestOverrides = (next: GuestOverrideMap) => {
  localStorage.setItem(SEAT_CHECKIN_GUEST_OVERRIDE_KEY, JSON.stringify(next));
};
const getSessionGuestOverrides = (sessionId: string) => readGuestOverrides()[sessionId] || {};
const setSessionGuestOverride = (sessionId: string, name: string, value: { seatHint: string; assignedKey?: string; confirmed?: boolean }) => {
  const all = readGuestOverrides();
  const current = all[sessionId] || {};
  current[name] = value;
  all[sessionId] = current;
  writeGuestOverrides(all);
};

/** Classroom front-center priority slot order, skipping disabled seats. */
const buildClassroomGuestSlots = (
  grid: (string | null)[][],
  disabledKeys: Set<string>,
): Array<{ r: number; c: number; key: string }> => {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0]?.length ?? 0;
  const centerC = (cols - 1) / 2;
  const slots: Array<{ r: number; c: number; key: string; score: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}-${c}`;
      if (disabledKeys.has(key)) continue;
      if (!isSeatEmptyValue(grid[r][c])) continue;
      slots.push({ r, c, key, score: r * 100 + Math.abs(c - centerC) });
    }
  }
  slots.sort((a, b) => a.score - b.score);
  return slots.map(({ r, c, key }) => ({ r, c, key }));
};

interface GuestAssignmentEntry {
  name: string;
  seatHint: string;
  assignedKey?: string;
  confirmed?: boolean;
}

const computeGuestAssignments = (params: {
  sceneType: string;
  seatData: unknown;
  guestNames: string[];
  disabledSeats?: string[];
  overrides: Record<string, { seatHint: string; assignedKey?: string; confirmed?: boolean }>;
  rotateOffsets: Record<string, number>;
}): GuestAssignmentEntry[] => {
  const { sceneType, seatData, guestNames, disabledSeats = [], overrides, rotateOffsets } = params;
  if (guestNames.length === 0) return [];

  if (sceneType === 'classroom' && Array.isArray(seatData)) {
    const grid = (seatData as (string | null)[][]).map(row => [...row]);
    const disabledKeys = new Set(disabledSeats);
    const slots = buildClassroomGuestSlots(grid, disabledKeys);
    const used = new Set<string>();
    const result: GuestAssignmentEntry[] = [];
    for (const name of guestNames) {
      const override = overrides[name];
      // Find first available slot (respect rotate offset for re-assignment)
      const offset = rotateOffsets[name] || 0;
      let chosen: { r: number; c: number; key: string } | null = null;
      let counter = 0;
      for (const slot of slots) {
        if (used.has(slot.key)) continue;
        if (counter === offset) { chosen = slot; break; }
        counter++;
      }
      // If offset overflows, fall back to next available
      if (!chosen) {
        chosen = slots.find(s => !used.has(s.key)) || null;
      }
      if (chosen) {
        used.add(chosen.key);
        result.push({
          name,
          seatHint: `第${chosen.r + 1}排第${chosen.c + 1}列`,
          assignedKey: chosen.key,
          confirmed: override?.confirmed,
        });
      } else {
        result.push({ name, seatHint: '待老师现场确认', confirmed: override?.confirmed });
      }
    }
    return result;
  }

  // Sequential fill for other scenes
  const cloned = cloneSeatDataSequential(seatData, guestNames);
  return guestNames.map(name => ({
    name,
    seatHint: buildSeatHint(sceneType, cloned, name) || '待老师现场确认',
    confirmed: overrides[name]?.confirmed,
  }));
};

const cloneSeatDataSequential = (seatData: unknown, guestNames: string[]) => {
  let cursor = 0;
  const assign = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(item => assign(item));
    if (node && typeof node === 'object') {
      const next: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) next[key] = assign(value);
      return next;
    }
    if (isSeatEmptyValue(node) && cursor < guestNames.length) {
      const assigned = guestNames[cursor];
      cursor += 1;
      return assigned;
    }
    return node;
  };
  return assign(seatData);
};

const buildSeatHint = (sceneType: string, seatData: unknown, studentName: string) => {
  if (sceneType === 'classroom') {
    const seats = seatData as (string | null)[][];
    for (let r = 0; r < seats.length; r++) {
      for (let c = 0; c < seats[r].length; c++) {
        if (seats[r][c] === studentName) return `第${r + 1}排第${c + 1}列`;
      }
    }
    return null;
  }

  if (sceneType === 'smartClassroom' || sceneType === 'banquet') {
    const tables = seatData as string[][];
    for (let t = 0; t < tables.length; t++) {
      for (let s = 0; s < tables[t].length; s++) {
        if (tables[t][s] === studentName) return `第${t + 1}桌第${s + 1}号座`;
      }
    }
    return null;
  }

  if (sceneType === 'conference') {
    const data = seatData as {
      headLeft?: string;
      headRight?: string;
      top?: string[];
      bottom?: string[];
      mainTop?: string[];
      mainBottom?: string[];
    };
    if (data.headLeft === studentName) return '左侧主位';
    if (data.headRight === studentName) return '右侧主位';
    const top = data.top || data.mainTop || [];
    const bottom = data.bottom || data.mainBottom || [];
    const topIdx = top.indexOf(studentName);
    if (topIdx >= 0) return `上方第${topIdx + 1}位`;
    const bottomIdx = bottom.indexOf(studentName);
    if (bottomIdx >= 0) return `下方第${bottomIdx + 1}位`;
    return null;
  }

  if (sceneType === 'concertHall') {
    const rows = seatData as string[][];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === studentName) return `第${r + 1}排第${c + 1}座`;
      }
    }
    return null;
  }

  if (sceneType === 'computerLab') {
    const rows = seatData as Array<{ rowIndex: number; side: 'top' | 'bottom'; students: string[] }>;
    for (const row of rows) {
      const idx = row.students.indexOf(studentName);
      if (idx >= 0) return `第${row.rowIndex + 1}排${row.side === 'top' ? '上侧' : '下侧'}第${idx + 1}位`;
    }
    return null;
  }

  return null;
};

export default function SeatCheckinDialog({
  open,
  onOpenChange,
  seatData,
  studentNames,
  seatAssignmentReady,
  sceneConfig,
  sceneType,
  className,
  pngFileName,
  onSessionCreated,
}: Props) {
  const [currentSession, setCurrentSession] = useState<SeatCheckinSessionSummary | null>(null);
  const resolvedThemeTitle = (currentSession?.class_name || className || '座位签到').trim();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [records, setRecords] = useState<SeatCheckinRecord[]>([]);
  const [sessionSeatData, setSessionSeatData] = useState<unknown | null>(null);
  const [historySessions, setHistorySessions] = useState<SeatCheckinSessionSummary[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [unlimited, setUnlimited] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [requireSeatAssignment, setRequireSeatAssignment] = useState(() => getRequireSeatAssignmentBeforeCheckin());
  const qrPreviewRef = useRef<HTMLDivElement>(null);

  const seatAssignmentComplete = useMemo(
    () => (typeof seatAssignmentReady === 'boolean' ? seatAssignmentReady : isSeatAssignmentComplete(seatData, studentNames)),
    [seatAssignmentReady, seatData, studentNames],
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
      setSessionSeatData(null);
      setTimeLeft(null);
      return;
    }

    void loadSeatCheckinRecords(currentSession.id).then(setRecords);

    let remaining = 0;
    if (currentSession.status === 'active') {
      if (currentSession.duration_minutes >= 99999) {
        remaining = -1; // 无限时长
      } else {
        remaining = Math.max(
          0,
          currentSession.duration_minutes * 60 - Math.floor((Date.now() - new Date(currentSession.created_at).getTime()) / 1000),
        );
      }
    }
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
    if (!currentSession) return;

    let canceled = false;
    void supabase
      .from('seat_checkin_sessions')
      .select('seat_data')
      .eq('id', currentSession.id)
      .maybeSingle()
      .then(({ data }) => {
        if (canceled) return;
        setSessionSeatData((data as { seat_data?: unknown } | null)?.seat_data ?? null);
      })
      .then(null, () => {
        if (canceled) return;
        setSessionSeatData(null);
      });

    return () => {
      canceled = true;
    };
  }, [currentSession?.id]);

  useEffect(() => {
    if (!currentSession || currentSession.status !== 'active' || timeLeft === null) return;
    if (currentSession.duration_minutes >= 99999) return; // 无限时长，不自动结束
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
      const minutes = unlimited ? 99999 : durationMinutes;
      // 确保智能教室/宴会厅场景 sceneConfig 包含门口信息
      let nextSceneConfig = { ...sceneConfig };
      if (sceneType === 'smartClassroom' || sceneType === 'banquet') {
        // 默认仅支持前门，后续可扩展
        if (!nextSceneConfig.entryDoorMode) {
          nextSceneConfig.entryDoorMode = 'front';
        }
        if (!nextSceneConfig.entryDoorPosition) {
          // 默认前门在顶部中央
          nextSceneConfig.entryDoorPosition = 'top';
        }
      }
      console.log('[SeatCheckin] Publishing session with sceneConfig:', nextSceneConfig);
      const created = await createSeatCheckinSession({
        seatData,
        studentNames,
        sceneConfig: nextSceneConfig,
        sceneType,
        durationMinutes: minutes,
        className,
      });
      setCurrentSession(created.session);
      setSessionSeatData(seatData);
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

  // Manual override state for guest students
  const [guestRotateOffsets, setGuestRotateOffsets] = useState<Record<string, number>>({});
  const [guestConfirmed, setGuestConfirmed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentSession) {
      setGuestRotateOffsets({});
      setGuestConfirmed({});
      return;
    }
    const stored = getSessionGuestOverrides(currentSession.id);
    const confirmed: Record<string, boolean> = {};
    for (const [name, value] of Object.entries(stored)) {
      if (value.confirmed) confirmed[name] = true;
    }
    setGuestRotateOffsets({});
    setGuestConfirmed(confirmed);
  }, [currentSession?.id]);

  const guestSeatAssignments = useMemo<GuestAssignmentEntry[]>(() => {
    if (!currentSession) return [];
    const baseSeatData = sessionSeatData ?? seatData;
    if (!baseSeatData) return [];

    const registeredSet = new Set(currentStudentNames.map(item => item.trim()));
    const guestNames: string[] = [];
    const seen = new Set<string>();
    for (const record of records) {
      const checkedName = record.student_name.trim();
      if (!checkedName || registeredSet.has(checkedName) || seen.has(checkedName)) continue;
      seen.add(checkedName);
      guestNames.push(checkedName);
    }
    if (guestNames.length === 0) return [];

    const sessionSceneConfig = (currentSession as unknown as { scene_config?: Record<string, unknown> }).scene_config || sceneConfig;
    const disabledSeats = Array.isArray(sessionSceneConfig?.disabledSeats)
      ? (sessionSceneConfig!.disabledSeats as string[])
      : [];

    const overridesObj: Record<string, { seatHint: string; assignedKey?: string; confirmed?: boolean }> = {};
    for (const name of guestNames) {
      if (guestConfirmed[name]) overridesObj[name] = { seatHint: '', confirmed: true };
    }

    return computeGuestAssignments({
      sceneType: currentSession.scene_type,
      seatData: baseSeatData,
      guestNames,
      disabledSeats,
      overrides: overridesObj,
      rotateOffsets: guestRotateOffsets,
    });
  }, [currentSession, currentStudentNames, records, seatData, sessionSeatData, sceneConfig, guestRotateOffsets, guestConfirmed]);

  const handleConfirmGuest = (entry: GuestAssignmentEntry) => {
    if (!currentSession) return;
    setGuestConfirmed(prev => ({ ...prev, [entry.name]: true }));
    setSessionGuestOverride(currentSession.id, entry.name, {
      seatHint: entry.seatHint,
      assignedKey: entry.assignedKey,
      confirmed: true,
    });
    toast({ title: `已确认 ${entry.name} 的座位`, description: entry.seatHint });
  };

  const handleReassignGuest = (entry: GuestAssignmentEntry) => {
    setGuestRotateOffsets(prev => ({ ...prev, [entry.name]: (prev[entry.name] || 0) + 1 }));
    setGuestConfirmed(prev => {
      const next = { ...prev };
      delete next[entry.name];
      return next;
    });
    if (currentSession) {
      const all = readGuestOverrides();
      if (all[currentSession.id]) {
        delete all[currentSession.id][entry.name];
        writeGuestOverrides(all);
      }
    }
    toast({ title: `已为 ${entry.name} 重新指派座位` });
  };

  const formatTimeLeft = (seconds: number) => {
    if (seconds === -1) return '不限时长';
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const openHistorySession = async (session: SeatCheckinSessionSummary) => {
    setCurrentSession(session);
    const nextRecords = await loadSeatCheckinRecords(session.id);
    setRecords(nextRecords);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setCurrentSession(null); setRecords([]); setTimeLeft(null); } }}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" /> {resolvedThemeTitle} · 座位签到
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto px-4 sm:px-6 pb-5 max-h-[calc(90vh-74px)]">

        {!currentSession ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              生成签到二维码后，学生扫码输入姓名即可查看自己的座位位置，并获得导航指引。
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">签到时长</span>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} className="accent-primary" />
                不限制时长
              </label>
              {!unlimited && (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={durationMinutes}
                    onChange={e => {
                      let v = Number(e.target.value) || 1;
                      if (v < 1) v = 1;
                      if (v > 120) v = 120;
                      setDurationMinutes(v);
                    }}
                    className="h-9 w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">分钟</span>
                </>
              )}
              {unlimited && <span className="text-sm text-muted-foreground">不限/需手动结束</span>}
            </div>
            {/* 已移除-1说明文案 */}

            <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">签到前需完成排座</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${requireSeatAssignment ? 'text-primary border-primary/40 bg-primary/10' : 'text-muted-foreground border-border bg-muted'}`}>
                  {requireSeatAssignment ? '已开启' : '已关闭'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                该策略由系统配置统一管理。关闭后可无需排座直接发起签到。
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
                            <p className="text-sm font-medium text-foreground truncate">{session.class_name || className || '座位签到'}</p>
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

            <p className="text-center text-sm font-medium text-foreground">{resolvedThemeTitle}</p>

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
              qrSize={220}
              qrContainerRef={qrPreviewRef}
              className="flex flex-col items-center gap-3 w-full"
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  当前已签到 <span className="text-primary">{checkedInNames.length + guestSeatAssignments.length}</span> 人
                </p>
                <p className="text-xs text-muted-foreground">
                  名单内 {checkedInNames.filter(n => currentStudentNames.includes(n)).length} · 名单外 {guestSeatAssignments.length}
                </p>
              </div>

              {/* 名单内 */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> 名单内（{currentStudentNames.length} 人，已签 {checkedInNames.filter(n => currentStudentNames.includes(n)).length}）
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
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
            </div>

            {/* 名单外（临时分配） */}
            <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium text-foreground mb-2 flex items-center gap-1.5">
                <span className="inline-flex w-2 h-2 rounded-full bg-amber-500" />
                名单外（临时分配座位） · {guestSeatAssignments.length} 人
              </p>
              {guestSeatAssignments.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无未注册签到人员</p>
              ) : (
                <div className="max-h-44 overflow-auto space-y-1.5 pr-1">
                  {guestSeatAssignments.map(item => (
                    <div
                      key={item.name}
                      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${
                        item.confirmed ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-background'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-medium text-foreground truncate">{item.name}</span>
                        <span className="text-xs text-primary whitespace-nowrap">{item.seatHint}</span>
                        {item.confirmed && <Check className="w-3 h-3 text-primary shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!item.confirmed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => handleConfirmGuest(item)}
                          >
                            <Check className="w-3 h-3" /> 确认
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={() => handleReassignGuest(item)}
                          disabled={item.assignedKey === undefined && currentSession.scene_type === 'classroom'}
                          title="重新指派至下一个可用座位"
                        >
                          <Shuffle className="w-3 h-3" /> 重派
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                临时座位优先安排在前排居中，自动跳过关闭座位与已占用座位。点击"重派"可循环切换至下一个可用座位。
              </p>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
