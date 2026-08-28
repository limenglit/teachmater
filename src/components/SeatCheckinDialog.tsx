import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

import { formatClassroomSeatLabel, normalizeSeatLabelMode, type SeatLabelMode } from '@/lib/seat-number';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Download, QrCode, StopCircle, Trash2, Clock, RotateCcw, UserCheck, Shuffle, UsersRound, History, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  createSeatCheckinSession,
  fetchSeatCheckinOtp,
  deleteSeatCheckinSession,
  endSeatCheckinSession,
  getSeatCheckinSessionToken,
  loadSeatCheckinRecords,
  loadSeatCheckinSessionHistory,
  type SeatCheckinRecord,
  type SeatCheckinSessionSummary,
} from '@/lib/seat-checkin-session';
import { downloadQrFromContainer } from '@/lib/qr-download';
import QRActionPanel from '@/components/qr/QRActionPanel';
import {
  getRequireSeatAssignmentBeforeCheckin,
  isSeatAssignmentComplete,
  analyzeSeatCheckinCoverage,
} from '@/lib/seat-checkin-policy';
import { useLanguage } from '@/contexts/LanguageContext';

interface MergeGuestEntry {
  name: string;
  assignedKey?: string;
  seatHint: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatData: unknown;
  studentNames: string[];
  seatAssignmentReady?: boolean;
  /** Unified human-readable reason (ready or not) surfaced from evaluateSeatCheckinReadiness. */
  seatReadinessReason?: string;
  seatAssignedCount?: number;
  /** Roster size before name de-duplication (used to explain missing people). */
  rosterTotal?: number;
  /** Roster names that repeat, so check-in cannot tell them apart. */
  duplicateRosterNames?: string[];

  sceneConfig: Record<string, unknown>;
  sceneType: string;
  className?: string;
  pngFileName?: string;
  onSessionCreated?: (payload: { sessionId: string; checkinUrl: string }) => void;
  onMergeGuests?: (guests: MergeGuestEntry[]) => void;
}

const isSeatEmptyValue = (value: unknown) => value === null || value === '';

const normalizeStudentName = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

const isSameStudentName = (left: unknown, right: string) => {
  if (typeof left !== 'string') return false;
  return normalizeStudentName(left) === normalizeStudentName(right);
};

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
  seatLabelMode?: SeatLabelMode;
}): GuestAssignmentEntry[] => {
  const { sceneType, seatData, guestNames, disabledSeats = [], overrides, rotateOffsets, seatLabelMode = 'no' } = params;
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
          seatHint: formatClassroomSeatLabel(chosen.r, chosen.c, { rowWidth: grid[chosen.r].length, disabledSeats: disabledKeys, rowWidths: grid.map(row => row?.length ?? 0) }, seatLabelMode),
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
    seatHint: buildSeatHint(sceneType, cloned, name, disabledSeats, seatLabelMode) || '待老师现场确认',
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

const buildSeatHint = (
  sceneType: string,
  seatData: unknown,
  studentName: string,
  disabledSeats: string[] = [],
  seatLabelMode: SeatLabelMode = 'no',
) => {
  if (sceneType === 'classroom') {
    const seats = seatData as (string | null)[][];
    for (let r = 0; r < seats.length; r++) {
      for (let c = 0; c < seats[r].length; c++) {
        if (isSameStudentName(seats[r][c], studentName)) {
          return formatClassroomSeatLabel(r, c, { rowWidth: seats[r].length, disabledSeats, rowWidths: seats.map(row => row?.length ?? 0) }, seatLabelMode);
        }
      }
    }
    return null;
  }

  if (sceneType === 'smartClassroom' || sceneType === 'banquet') {
    const tables = seatData as string[][];
    for (let t = 0; t < tables.length; t++) {
      for (let s = 0; s < tables[t].length; s++) {
        if (isSameStudentName(tables[t][s], studentName)) return `第${t + 1}桌第${s + 1}号座`;
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
    if (isSameStudentName(data.headLeft, studentName)) return '左侧主位';
    if (isSameStudentName(data.headRight, studentName)) return '右侧主位';
    const top = data.top || data.mainTop || [];
    const bottom = data.bottom || data.mainBottom || [];
    const topIdx = top.findIndex(name => isSameStudentName(name, studentName));
    if (topIdx >= 0) return `上方第${topIdx + 1}位`;
    const bottomIdx = bottom.findIndex(name => isSameStudentName(name, studentName));
    if (bottomIdx >= 0) return `下方第${bottomIdx + 1}位`;
    return null;
  }

  if (sceneType === 'concertHall') {
    const rows = seatData as string[][];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (isSameStudentName(rows[r][c], studentName)) return `第${r + 1}排第${c + 1}座`;
      }
    }
    return null;
  }

  if (sceneType === 'artStudio') {
    const rings = seatData as string[][];
    for (let ring = 0; ring < rings.length; ring++) {
      for (let seat = 0; seat < rings[ring].length; seat++) {
        if (isSameStudentName(rings[ring][seat], studentName)) return `第${ring + 1}圈第${seat + 1}位`;
      }
    }
    return null;
  }

  if (sceneType === 'computerLab') {
    const rows = seatData as Array<{ rowIndex: number; side: 'top' | 'bottom'; students: string[] }>;
    for (const row of rows) {
      const idx = row.students.findIndex(name => isSameStudentName(name, studentName));
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
  seatReadinessReason,
  seatAssignedCount,
  rosterTotal,
  duplicateRosterNames,

  sceneConfig,
  sceneType,
  className,
  pngFileName,
  onSessionCreated,
  onMergeGuests,
}: Props) {
  const { t } = useLanguage();
  const [currentSession, setCurrentSession] = useState<SeatCheckinSessionSummary | null>(null);
  const resolvedThemeTitle = ((currentSession?.class_name || className || '').trim()) || t('seatCheckinDialog.title');
  const hasCustomTitle = !!(currentSession?.class_name?.trim() || className?.trim());

  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [records, setRecords] = useState<SeatCheckinRecord[]>([]);
  const [sessionSeatData, setSessionSeatData] = useState<unknown | null>(null);
  const [historySessions, setHistorySessions] = useState<SeatCheckinSessionSummary[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [unlimited, setUnlimited] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<SeatCheckinSessionSummary | null>(null);
  const [requireSeatAssignment, setRequireSeatAssignment] = useState(() => getRequireSeatAssignmentBeforeCheckin());
  const [checkinOnlyMode, setCheckinOnlyMode] = useState(false);
  // 学生端座位表述方式：第几号 / 第几列 / 两者都显示
  const [seatLabelMode, setSeatLabelMode] = useState<SeatLabelMode>('no');
  // 学生端附加采集字段：单位、手机号
  const [collectOrg, setCollectOrg] = useState(false);
  const [collectPhone, setCollectPhone] = useState(false);
  const [findFriendEnabled, setFindFriendEnabled] = useState(true);
  // 防代签动态口令
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpPeriodSeconds, setOtpPeriodSeconds] = useState(30);
  const [otp, setOtp] = useState<{ code: string; secondsRemaining: number; periodSeconds: number } | null>(null);
  const [seatChartImageUrl, setSeatChartImageUrl] = useState<string>('');
  const [uploadingChart, setUploadingChart] = useState(false);
  const [chartProgress, setChartProgress] = useState(0);
  const [chartStatus, setChartStatus] = useState<string>('');
  const [localPreview, setLocalPreview] = useState<string>('');
  const seatChartInputRef = useRef<HTMLInputElement | null>(null);

  const handleSeatChartUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: '请选择图片文件', variant: 'destructive' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: '图片不能超过 20MB', variant: 'destructive' });
      return;
    }
    const preview = URL.createObjectURL(file);
    setLocalPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });
    setUploadingChart(true);
    setChartProgress(5);
    setChartStatus('正在上传…');
    const timer = window.setInterval(() => {
      setChartProgress(p => (p < 85 ? p + Math.max(1, Math.round((85 - p) / 8)) : p));
    }, 250);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `seat-charts/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error } = await supabase.storage.from('board-media').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('board-media').getPublicUrl(path);
      window.clearInterval(timer);
      setChartProgress(90);
      setChartStatus('正在校验学生端可访问性…');
      // 预加载，确保学生端能立即加载到该图片
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        const to = window.setTimeout(() => reject(new Error('图片加载超时，请重试')), 20000);
        img.onload = () => { window.clearTimeout(to); resolve(); };
        img.onerror = () => { window.clearTimeout(to); reject(new Error('图片无法访问，请重试')); };
        img.src = data.publicUrl;
      });
      setSeatChartImageUrl(data.publicUrl);
      setChartProgress(100);
      setChartStatus('上传完成，学生端可正常加载');
      toast({ title: '座次表已上传', description: '学生端已可正常加载该图片' });
    } catch (err) {
      setChartProgress(0);
      setChartStatus('');
      setLocalPreview(prev => { if (prev) URL.revokeObjectURL(prev); return ''; });
      toast({ title: '座次表上传失败', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      window.clearInterval(timer);
      setUploadingChart(false);
    }
  };


  const qrPreviewRef = useRef<HTMLDivElement>(null);

  const coverage = useMemo(
    () => analyzeSeatCheckinCoverage(seatData, studentNames),
    [seatData, studentNames],
  );

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

    // 轮询兜底：访客教师（未登录）受 RLS 限制无法通过 Realtime 收到行变更，
    // 且偶发的 WebSocket 抖动也会丢消息。每 2 秒拉一次作为兜底。
    const pollId = window.setInterval(() => {
      if (currentSession.status !== 'active') return;
      void loadSeatCheckinRecords(currentSession.id).then(next => {
        if (!Array.isArray(next)) return;
        setRecords(prev => {
          // Compare by id set (order-independent) — Realtime appends to end
          // while the RPC may return rows in DB order, so positional compare
          // can falsely skip updates.
          if (prev.length === next.length) {
            const prevIds = new Set(prev.map(r => r.id));
            let same = true;
            for (const r of next) { if (!prevIds.has(r.id)) { same = false; break; } }
            if (same) return prev;
          }
          return next;
        });
      }).catch(() => {});
    }, 2000);


    const refetchNow = () => {
      if (currentSession.status !== 'active') return;
      void loadSeatCheckinRecords(currentSession.id).then(next => {
        if (Array.isArray(next)) setRecords(next);
      }).catch(() => {});
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refetchNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refetchNow);

    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refetchNow);
    };
  }, [currentSession?.id, currentSession?.status]);


  useEffect(() => {
    if (!currentSession) return;

    let canceled = false;
    void supabase.rpc('get_seat_checkin_seat_data', { p_session_id: currentSession.id } as any)
      .then(({ data }) => {
        if (canceled) return;
        setSessionSeatData((data as unknown) ?? null);
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

  // 防代签动态口令：服务端按时间片派生，本地只做倒计时展示，到点重新拉取。
  useEffect(() => {
    const sessionId = currentSession?.id;
    if (!sessionId || !currentSession?.otp_enabled || currentSession.status !== 'active') {
      setOtp(null);
      return;
    }
    let cancelled = false;
    let reloadTimer = 0;

    const load = async () => {
      const next = await fetchSeatCheckinOtp(sessionId);
      if (cancelled) return;
      setOtp(next);
      if (next) {
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => { void load(); }, Math.max(1, next.secondsRemaining) * 1000 + 300);
      }
    };

    void load();

    const tick = window.setInterval(() => {
      setOtp(prev => (prev ? { ...prev, secondsRemaining: Math.max(0, prev.secondsRemaining - 1) } : prev));
    }, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(reloadTimer);
      window.clearInterval(tick);
    };
  }, [currentSession?.id, currentSession?.otp_enabled, currentSession?.status]);



  const createSession = async () => {
    if (requireSeatAssignment && !checkinOnlyMode && !seatAssignmentComplete) {
      toast({ title: t('seatCheckinDialog.noSeatToast'), variant: 'destructive' });
      return;
    }


    setLoading(true);
    setCreateError(null);
    try {
      const minutes = unlimited ? 99999 : durationMinutes;
      // 确保智能教室/宴会厅场景 sceneConfig 包含门口信息
      const nextSceneConfig: Record<string, unknown> = { ...sceneConfig };
      if (sceneType === 'smartClassroom' || sceneType === 'banquet') {
        if (!nextSceneConfig.entryDoorMode) {
          nextSceneConfig.entryDoorMode = 'front';
        }
        if (!nextSceneConfig.entryDoorPosition) {
          // 跟随教师端当前的门位置（可被前后门互换影响），缺省顶部。
          const mode = nextSceneConfig.entryDoorMode;
          const front = nextSceneConfig.frontDoorPosition as string | undefined;
          const back = nextSceneConfig.backDoorPosition as string | undefined;
          nextSceneConfig.entryDoorPosition = (mode === 'back' ? back : front) || front || 'top';
        }
      }
      // 降级策略：仅签到不导航（可附带座次表图片）
      nextSceneConfig.checkinOnlyMode = checkinOnlyMode;
      nextSceneConfig.seatLabelMode = seatLabelMode;
      nextSceneConfig.collectOrg = collectOrg;
      nextSceneConfig.collectPhone = collectPhone;
      nextSceneConfig.findFriendEnabled = findFriendEnabled;
      if (checkinOnlyMode && seatChartImageUrl) {
        nextSceneConfig.seatChartImageUrl = seatChartImageUrl;
      } else {
        delete nextSceneConfig.seatChartImageUrl;
      }
      console.log('[SeatCheckin] Publishing session with sceneConfig:', nextSceneConfig);
      const created = await createSeatCheckinSession({
        seatData,
        studentNames,
        sceneConfig: nextSceneConfig,
        sceneType,
        durationMinutes: minutes,
        className,
        otpEnabled,
        otpPeriodSeconds,
      });
      setCurrentSession(created.session);
      setSessionSeatData(seatData);
      setRecords([]);
      setCreateError(null);
      onSessionCreated?.({ sessionId: created.sessionId, checkinUrl: created.checkinUrl });
      await refreshHistory();
    } catch (err) {
      const description = err instanceof Error ? err.message : undefined;
      setCreateError(description || t('seatCheckinDialog.createFailedToast'));
      toast({ title: t('seatCheckinDialog.createFailedToast'), description, variant: 'destructive' });
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
      toast({ title: t('seatCheckinDialog.endedSession') });
    } catch {
      toast({ title: t('seatCheckinDialog.endFailed'), variant: 'destructive' });
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
      toast({ title: t('seatCheckinDialog.deletedRecord') });
    } catch {
      toast({ title: t('seatCheckinDialog.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeletingSessionId(null);
    }
  };

  const checkinUrl = currentSession
    ? `${window.location.origin}/seat-checkin/${currentSession.id}`
    : '';
  const resolvedPngFileName = `${(pngFileName?.trim() || className?.trim() || t('seatCheckinDialog.qrFallbackName'))}.png`;

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
      seatLabelMode: normalizeSeatLabelMode(sessionSceneConfig?.seatLabelMode),
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
    toast({ title: `${t('seatCheckinDialog.guestConfirmed')} · ${entry.name}`, description: entry.seatHint });
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
    toast({ title: `${t('seatCheckinDialog.guestReassigned')} · ${entry.name}` });
  };

  const [merging, setMerging] = useState(false);
  const handleMergeGuests = async () => {
    if (!currentSession || guestSeatAssignments.length === 0) return;
    if (!onMergeGuests) {
      toast({ title: t('seatCheckinDialog.mergeUnsupported'), variant: 'destructive' });
      return;
    }
    setMerging(true);
    try {
      // 1) Update parent (local seat chart + roster)
      const entries: MergeGuestEntry[] = guestSeatAssignments.map(g => ({
        name: g.name,
        assignedKey: g.assignedKey,
        seatHint: g.seatHint,
      }));
      onMergeGuests(entries);

      // 2) Persist to current session so student-facing page also reflects merged data
      const baseSeatData = sessionSeatData ?? seatData;
      let nextSeatData: unknown = baseSeatData;
      if (currentSession.scene_type === 'classroom' && Array.isArray(baseSeatData)) {
        const grid = (baseSeatData as (string | null)[][]).map(row => [...row]);
        for (const e of entries) {
          if (!e.assignedKey) continue;
          const [rs, cs] = e.assignedKey.split('-');
          const r = Number(rs); const c = Number(cs);
          if (Number.isFinite(r) && Number.isFinite(c) && grid[r] && grid[r][c] === null) {
            grid[r][c] = e.name;
          }
        }
        nextSeatData = grid;
      } else {
        nextSeatData = cloneSeatDataSequential(baseSeatData, entries.map(e => e.name));
      }
      const mergedNames = Array.from(new Set([...currentStudentNames, ...entries.map(e => e.name)]));
      const sessionToken = getSeatCheckinSessionToken(currentSession.id) || '';
      const { error } = await supabase.rpc('merge_seat_checkin_guests', {
        p_session_id: currentSession.id,
        p_token: sessionToken,
        p_seat_data: nextSeatData as never,
        p_student_names: mergedNames as never,
      });
      if (error) throw error;

      setSessionSeatData(nextSeatData);
      setCurrentSession(prev => prev ? { ...prev, student_names: mergedNames } : prev);
      // Clear guest overrides since they're now merged
      const all = readGuestOverrides();
      delete all[currentSession.id];
      writeGuestOverrides(all);
      setGuestConfirmed({});
      setGuestRotateOffsets({});

      toast({ title: t('seatCheckinDialog.mergeSuccess'), description: t('seatCheckinDialog.mergeSuccessDesc') });
    } catch (err) {
      const description = err instanceof Error ? err.message : undefined;
      toast({ title: t('seatCheckinDialog.mergeFailed'), description, variant: 'destructive' });
    } finally {
      setMerging(false);
    }
  };

  const formatTimeLeft = (seconds: number) => {
    if (seconds === -1) return t('seatCheckinDialog.unlimitedLabel');
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
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg break-words">
            <QrCode className="w-5 h-5 shrink-0" /> <span className="min-w-0 break-words">{hasCustomTitle ? `${resolvedThemeTitle} · ${t('seatCheckinDialog.title')}` : t('seatCheckinDialog.title')}</span>
          </DialogTitle>

        </DialogHeader>

        <div className="overflow-y-auto px-4 sm:px-6 pb-5 max-h-[calc(90vh-74px)]">

        {!currentSession ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t('seatCheckinDialog.desc')}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm text-muted-foreground">{t('seatCheckinDialog.duration')}</span>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} className="accent-primary" />
                {t('seatCheckinDialog.unlimited')}
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
                  <span className="text-sm text-muted-foreground">{t('seatCheckinDialog.minutes')}</span>
                </>
              )}
              {unlimited && <span className="text-sm text-muted-foreground">{t('seatCheckinDialog.unlimitedManualEnd')}</span>}
            </div>
            {/* 已移除-1说明文案 */}

            <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground break-words min-w-0">{t('seatCheckinDialog.requireSeating')}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${requireSeatAssignment ? 'text-primary border-primary/40 bg-primary/10' : 'text-muted-foreground border-border bg-muted'}`}>
                  {requireSeatAssignment ? t('seatCheckinDialog.enabled') : t('seatCheckinDialog.disabled')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('seatCheckinDialog.requireDesc')}
              </p>
              {requireSeatAssignment && !seatAssignmentComplete && (
                <p className="text-xs text-destructive">{t('seatCheckinDialog.seatNotReady')}</p>
              )}
              {requireSeatAssignment && seatAssignmentComplete && typeof seatAssignedCount === 'number' && seatAssignedCount > 0 && (
                <p className="text-xs text-primary">
                  {t('seatCheckinDialog.seatReadyCount').replace('{count}', String(seatAssignedCount))}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                名单 {rosterTotal ?? coverage.rosterCount} 人 · 已就座 {coverage.assignedCount} 人 · 签到名单 {coverage.uniqueCount} 人
              </p>
              {coverage.unseatedNames.length > 0 && (
                <details className="text-xs text-amber-600">
                  <summary className="cursor-pointer">
                    未安排座位 {coverage.unseatedNames.length} 人（会导致室内导航缺失，点击查看名单）
                  </summary>
                  <p className="mt-1 break-words text-muted-foreground">{coverage.unseatedNames.join('、')}</p>
                </details>
              )}
              {((duplicateRosterNames && duplicateRosterNames.length > 0) || coverage.duplicateNames.length > 0) && (
                <details className="text-xs text-amber-600">
                  <summary className="cursor-pointer">
                    重名 {(duplicateRosterNames && duplicateRosterNames.length > 0 ? duplicateRosterNames : coverage.duplicateNames).length} 人（签到时会合并为同一条记录，建议加学号区分）
                  </summary>
                  <p className="mt-1 break-words text-muted-foreground">
                    {(duplicateRosterNames && duplicateRosterNames.length > 0 ? duplicateRosterNames : coverage.duplicateNames).join('、')}
                  </p>
                </details>
              )}

            </div>

            {/* 学生端座位表述方式 */}
            {sceneType === 'classroom' && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">手机端座位表述方式</p>
                <p className="text-xs text-muted-foreground">
                  学生扫码后看到的位置提示，默认显示「第几排第几号」（按教室中心号位编号）。
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {([
                    { value: 'no' as const, label: '第几排第几号（默认）' },
                    { value: 'col' as const, label: '第几排第几列' },
                    { value: 'both' as const, label: '两者都显示' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSeatLabelMode(opt.value)}
                      className={`px-2.5 py-1 rounded-full border transition-colors ${
                        seatLabelMode === opt.value
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 学生端附加填写项：单位 / 手机号 */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">签到需填写的附加信息（可选）</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2 text-foreground">
                  <input
                    type="checkbox"
                    checked={collectOrg}
                    onChange={e => setCollectOrg(e.target.checked)}
                    className="accent-primary"
                  />
                  单位
                </label>
                <label className="flex items-center gap-2 text-foreground">
                  <input
                    type="checkbox"
                    checked={collectPhone}
                    onChange={e => setCollectPhone(e.target.checked)}
                    className="accent-primary"
                  />
                  手机号
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                勾选后，学生手机端签到时会出现对应输入框，导出的签到 CSV 也会在姓名后增加相应列。
              </p>
            </div>

            {/* 学生端「找朋友」功能 */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={findFriendEnabled}
                  onChange={e => setFindFriendEnabled(e.target.checked)}
                  className="accent-primary"
                />
                开启「找朋友」功能
              </label>
              <p className="text-xs text-muted-foreground">
                开启后，学生签到成功可在座位图下方搜索好友姓名并高亮其座位；关闭则不显示该面板。
              </p>
            </div>

            {/* 防代签：动态口令 */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={otpEnabled}
                  onChange={e => setOtpEnabled(e.target.checked)}
                  className="accent-primary"
                />
                防代签动态口令（可选）
              </label>
              <p className="text-xs text-muted-foreground">
                开启后，签到码下方会显示一组 6 位数字并自动刷新，学生必须在手机端同时输入姓名和当前屏幕上的数字才能签到，可有效防止不在教室的同学远程代签。
              </p>
              {otpEnabled && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">刷新周期</span>
                  {[30, 60].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setOtpPeriodSeconds(sec)}
                      className={`px-2.5 py-1 rounded-full border transition-colors ${
                        otpPeriodSeconds === sec
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {sec} 秒
                    </button>
                  ))}
                  <span className="text-muted-foreground">（口令在前后各一个周期内仍然有效，避免网络延迟误判）</span>
                </div>
              )}
            </div>

            {/* 降级策略：仅签到不导航 + 座次表图片 */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={checkinOnlyMode}
                  onChange={e => setCheckinOnlyMode(e.target.checked)}
                  className="accent-primary"
                />
                仅签到不导航（降级策略）
              </label>
              <p className="text-xs text-muted-foreground">
                勾选后学生签到成功不再显示室内导航，改为展示你上传的座次表图片，支持手势放大缩小查看。
              </p>
              {checkinOnlyMode && (
                <div className="space-y-2">
                  <input
                    ref={seatChartInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      void handleSeatChartUpload(e.target.files?.[0] || null);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs"
                    disabled={uploadingChart}
                    onClick={() => seatChartInputRef.current?.click()}
                  >
                    {uploadingChart ? '上传中…' : seatChartImageUrl ? '重新上传座次表' : '上传座次表图'}
                  </Button>
                  {(uploadingChart || (chartProgress > 0 && chartProgress < 100)) && (
                    <div className="space-y-1">
                      <Progress value={chartProgress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{chartStatus || '正在上传…'} {chartProgress}%</p>
                    </div>
                  )}
                  {(seatChartImageUrl || localPreview) && (
                    <div className="flex items-start gap-2">
                      <div className="rounded-lg border border-border overflow-hidden w-24 h-24 shrink-0 bg-muted/30">
                        <img
                          src={seatChartImageUrl || localPreview}
                          alt="座次表缩略图"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="rounded-lg border border-border overflow-hidden flex-1">
                        <img src={seatChartImageUrl || localPreview} alt="座次表预览" className="w-full max-h-48 object-contain bg-muted/30" />
                      </div>
                    </div>
                  )}
                  {seatChartImageUrl && !uploadingChart && (
                    <p className="text-xs text-emerald-600">已上传并校验，学生端可即时加载。</p>
                  )}
                  {!seatChartImageUrl && !uploadingChart && (
                    <p className="text-xs text-amber-600">未上传座次表时，学生签到后仅显示签到成功提示。</p>
                  )}

                </div>
              )}
            </div>

            <Button onClick={createSession} disabled={loading || uploadingChart || (requireSeatAssignment && !checkinOnlyMode && !seatAssignmentComplete)} className="w-full">
              {loading ? t('seatCheckinDialog.generating') : createError ? t('seatCheckinDialog.retry') : t('seatCheckinDialog.generate')}
            </Button>

            {createError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="text-destructive font-medium mb-2">{t('seatCheckinDialog.createFailedToast')}</p>
                <p className="text-muted-foreground text-xs mb-3 break-words">{createError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9 gap-1.5 text-xs"
                  onClick={createSession}
                  disabled={loading}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? t('seatCheckinDialog.retrying') : t('seatCheckinDialog.regenerate')}
                </Button>
              </div>
            )}

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{t('seatCheckinDialog.records')}</p>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void refreshHistory()}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t('seatCheckinDialog.refresh')}
                </Button>
              </div>
              {historySessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('seatCheckinDialog.empty')}</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-auto pr-1">
                  {historySessions.map(session => {
                    const isDeleting = deletingSessionId === session.id;
                    return (
                      <div key={session.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between gap-2">
                          <button className="flex-1 text-left min-w-0" onClick={() => void openHistorySession(session)}>
                            <p className="text-sm font-medium text-foreground truncate">{session.class_name || className || t('seatCheckinDialog.title')}</p>
                            <p className="text-xs text-muted-foreground break-words">
                              {new Date(session.created_at).toLocaleString()} · {session.duration_minutes} {t('seatCheckinDialog.minutes')} · {session.status === 'active' ? t('seatCheckinDialog.inProgress') : t('seatCheckinDialog.ended')}
                            </p>
                          </button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setSessionToDelete(session)} disabled={isDeleting}>
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
                <span>{currentSession.status === 'active' && timeLeft !== null ? formatTimeLeft(timeLeft) : t('seatCheckinDialog.ended')}</span>
              </div>
              <div className="text-muted-foreground whitespace-nowrap">
                {t('seatCheckinDialog.checkedShort')} {checkedInNames.length} / {currentStudentNames.length}
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
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? t('seatCheckinDialog.copied') : t('seatCheckinDialog.copyLink')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap"
                    onClick={async () => {
                      try {
                        await downloadQrFromContainer(qrPreviewRef.current, resolvedPngFileName);
                        toast({ title: t('seatCheckinDialog.pngSuccess') });
                      } catch {
                        toast({ title: t('seatCheckinDialog.pngFailed'), variant: 'destructive' });
                      }
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> {t('seatCheckinDialog.downloadPng')}
                  </Button>
                </>
              )}
            />

            {currentSession.otp_enabled && currentSession.status === 'active' && (
              <div className="w-full rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-center space-y-1.5">
                <p className="text-xs text-muted-foreground">防代签口令 · 请学生连同姓名一起输入</p>
                <p className="text-4xl font-bold tracking-[0.35em] text-primary tabular-nums pl-[0.35em]">
                  {otp ? `${otp.code.slice(0, 3)} ${otp.code.slice(3)}` : '······'}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                      style={{ width: otp ? `${Math.max(0, Math.min(100, (otp.secondsRemaining / Math.max(1, otp.periodSeconds)) * 100))}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{otp ? `${otp.secondsRemaining}s 后刷新` : '获取中…'}</span>
                </div>
              </div>
            )}

            <div className="w-full border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-y-1">
                <p className="text-sm font-medium min-w-0 break-words">
                  {t('seatCheckinDialog.currentCheckedIn')} <span className="text-primary">{checkedInNames.length + guestSeatAssignments.length}</span> {t('seatCheckinDialog.people')}
                </p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {t('seatCheckinDialog.inListLabel')} {checkedInNames.filter(n => currentStudentNames.includes(n)).length} · {t('seatCheckinDialog.outListLabel')} {guestSeatAssignments.length}
                </p>
              </div>

              {/* 名单内 */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 flex-wrap min-w-0 break-words">
                  <UserCheck className="w-3 h-3 shrink-0" /> {t('seatCheckinDialog.inListSection')}（{currentStudentNames.length} {t('seatCheckinDialog.people')}，{t('seatCheckinDialog.checkedShort')} {checkedInNames.filter(n => currentStudentNames.includes(n)).length}）
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
              <p className="font-medium text-foreground mb-2 flex items-center gap-1.5 flex-wrap min-w-0 break-words">
                <span className="inline-flex w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                {t('seatCheckinDialog.outListSection')} · {guestSeatAssignments.length} {t('seatCheckinDialog.people')}
              </p>
              {guestSeatAssignments.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('seatCheckinDialog.noGuest')}</p>
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
                            <Check className="w-3 h-3" /> {t('seatCheckinDialog.confirm')}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={() => handleReassignGuest(item)}
                          disabled={item.assignedKey === undefined && currentSession.scene_type === 'classroom'}
                          title={t('seatCheckinDialog.reassignTitle')}
                        >
                          <Shuffle className="w-3 h-3" /> {t('seatCheckinDialog.reassign')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2 break-words">
                {t('seatCheckinDialog.guestNote')}
              </p>
              {guestSeatAssignments.length > 0 && onMergeGuests && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full mt-2 h-8 text-xs gap-1 whitespace-normal h-auto py-1.5"
                  onClick={() => void handleMergeGuests()}
                  disabled={merging}
                >
                  <UsersRound className="w-3.5 h-3.5 shrink-0" />
                  <span className="min-w-0 break-words">{merging ? t('seatCheckinDialog.merging') : `${t('seatCheckinDialog.mergeBtn')} (${guestSeatAssignments.length})`}</span>
                </Button>
              )}
            </div>


            {/* 签到流水（按时间排序） */}
            <div className="w-full rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <p className="font-medium text-foreground flex items-center gap-1.5 min-w-0 break-words">
                  <History className="w-4 h-4 shrink-0" /> {t('seatCheckinDialog.flowTitle')} · {records.length}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 whitespace-nowrap"
                  disabled={records.length === 0}
                  onClick={() => {
                    const sorted = [...records].sort(
                      (a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime(),
                    );
                    const inListSet = new Set(currentStudentNames.map(n => n.trim()));
                    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
                    // 姓名后的附加列按发布时的勾选（或已采集到的数据）动态生成
                    const showOrg = collectOrg || sorted.some(r => (r.org || '').trim() !== '');
                    const showPhone = collectPhone || sorted.some(r => (r.phone || '').trim() !== '');
                    const rows = [
                      [
                        t('seatCheckinDialog.csvIndex'),
                        t('seatCheckinDialog.csvName'),
                        ...(showOrg ? ['单位'] : []),
                        ...(showPhone ? ['手机号'] : []),
                        t('seatCheckinDialog.csvType'),
                        t('seatCheckinDialog.csvTime'),
                      ],
                      ...sorted.map((r, i) => {
                        const name = r.student_name.trim();
                        return [
                          String(i + 1),
                          name,
                          ...(showOrg ? [(r.org || '').trim()] : []),
                          ...(showPhone ? [(r.phone || '').trim()] : []),
                          inListSet.has(name) ? t('seatCheckinDialog.inListLabel') : t('seatCheckinDialog.outListLabel'),
                          new Date(r.checked_in_at).toLocaleString(undefined, { hour12: false }),
                        ];
                      }),
                    ];
                    const csv = rows.map(row => row.map(escape).join(',')).join('\r\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const today = new Date();
                    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
                    const safeName = (resolvedThemeTitle || t('seatCheckinDialog.title')).replace(/[\\/:*?"<>|]/g, '_');
                    a.href = url;
                    a.download = `${safeName}_${t('seatCheckinDialog.csvFlowFile')}_${dateStr}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast({ title: t('seatCheckinDialog.exportSuccess') });
                  }}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> {t('seatCheckinDialog.exportCsv')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 whitespace-nowrap"
                  disabled={uncheckedNames.length === 0}
                  onClick={() => {
                    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
                    const rows = [
                      [t('seatCheckinDialog.csvIndex'), t('seatCheckinDialog.csvName'), t('seatCheckinDialog.csvType')],
                      ...uncheckedNames.map((n, i) => [String(i + 1), n.trim(), t('seatCheckinDialog.statsUnchecked')]),
                    ];
                    const csv = rows.map(row => row.map(escape).join(',')).join('\r\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const today = new Date();
                    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
                    const safeName = (resolvedThemeTitle || t('seatCheckinDialog.title')).replace(/[\\/:*?"<>|]/g, '_');
                    a.href = url;
                    a.download = `${safeName}_${t('seatCheckinDialog.csvUncheckedFile')}_${dateStr}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast({ title: t('seatCheckinDialog.exportSuccess') });
                  }}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> {t('seatCheckinDialog.exportUncheckedCsv')}
                </Button>
              </div>
              {records.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('seatCheckinDialog.empty')}</p>
              ) : (
                <div className="max-h-52 overflow-auto space-y-1 pr-1">
                  {[...records]
                    .sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())
                    .map((record, idx) => {
                      const trimmed = record.student_name.trim();
                      const isInList = currentStudentNames.map(n => n.trim()).includes(trimmed);
                      const time = new Date(record.checked_in_at);
                      const timeLabel = time.toLocaleTimeString(undefined, { hour12: false });
                      return (
                        <div
                          key={record.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/60 bg-background"
                        >
                          <span className="text-[11px] text-muted-foreground tabular-nums w-7 shrink-0">
                            #{records.length - idx}
                          </span>
                          <span className="text-xs font-medium text-foreground truncate flex-1">{trimmed}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                              isInList
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {isInList ? t('seatCheckinDialog.inListLabel') : t('seatCheckinDialog.outListLabel')}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                            {timeLabel}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {currentSession.status === 'ended' && (
              <div className="w-full rounded-lg border border-border bg-card p-3 text-sm">
                <p className="font-medium text-foreground">{t('seatCheckinDialog.stats')}</p>
                <p className="text-muted-foreground mt-1">{t('seatCheckinDialog.statsChecked')}：{checkedInNames.length} {t('seatCheckinDialog.people')}</p>
                <p className="text-muted-foreground">{t('seatCheckinDialog.statsUnchecked')}：{uncheckedNames.length} {t('seatCheckinDialog.people')}</p>
                {uncheckedNames.length > 0 && (
                  <div className="mt-2">
                    <div className="max-h-32 overflow-auto text-xs text-muted-foreground leading-relaxed">
                      {uncheckedNames.map(n => n.trim()).join('、')}
                    </div>
                  </div>
                )}
              </div>
            )}


            <div className="flex w-full gap-2 flex-wrap">
              {currentSession.status === 'active' ? (
                <Button variant="destructive" onClick={() => void handleEndSession()} className="flex-1 min-w-[8rem]" disabled={ending}>
                  <StopCircle className="w-4 h-4 mr-2 shrink-0" /> <span className="truncate">{ending ? t('seatCheckinDialog.endingBtn') : t('seatCheckinDialog.endSession')}</span>
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setCurrentSession(null)} className="flex-1 min-w-[8rem]">
                  {t('seatCheckinDialog.backToRecords')}
                </Button>
              )}
              <Button variant="outline" onClick={() => setSessionToDelete(currentSession)} disabled={deletingSessionId === currentSession.id}>
                <Trash2 className="w-4 h-4 mr-1" /> {t('seatCheckinDialog.delete')}
              </Button>
            </div>
          </div>
        )}
        </div>

        <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => { if (!open) setSessionToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('seatCheckinDialog.deleteConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('seatCheckinDialog.deleteConfirmDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (sessionToDelete) {
                    void handleDeleteSession(sessionToDelete);
                    setSessionToDelete(null);
                  }
                }}
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
