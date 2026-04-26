import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { MapPin, CheckCircle2, Crosshair, ScanLine, User2 } from 'lucide-react';
import ClassroomCheckinView from '@/components/checkin-views/ClassroomCheckinView';
import RoundTableCheckinView from '@/components/checkin-views/RoundTableCheckinView';
import ConferenceCheckinView from '@/components/checkin-views/ConferenceCheckinView';
import ConcertCheckinView from '@/components/checkin-views/ConcertCheckinView';
import ComputerLabCheckinView from '@/components/checkin-views/ComputerLabCheckinView';

const SEAT_CHECKIN_NAME_STORAGE_KEY = 'teachmate-seat-checkin-names';

const getStoredSeatCheckinNames = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SEAT_CHECKIN_NAME_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const getStoredSeatCheckinName = (sessionId: string) => getStoredSeatCheckinNames()[sessionId] || '';

const saveStoredSeatCheckinName = (sessionId: string, studentName: string) => {
  const next = getStoredSeatCheckinNames();
  next[sessionId] = studentName;
  localStorage.setItem(SEAT_CHECKIN_NAME_STORAGE_KEY, JSON.stringify(next));
};

const hasExistingSeatCheckinRecord = async (sessionId: string, studentName: string) => {
  const { data, error } = await supabase
    .from('seat_checkin_records')
    .select('id')
    .eq('session_id', sessionId)
    .eq('student_name', studentName)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
};

const isSeatEmptyValue = (value: unknown) => value === null || value === '';

const countEmptySeatSlots = (node: unknown): number => {
  if (Array.isArray(node)) {
    return node.reduce((sum: number, item) => sum + countEmptySeatSlots(item), 0 as number);
  }
  if (node && typeof node === 'object') {
    return (Object.values(node as Record<string, unknown>) as unknown[]).reduce<number>((sum, value) => sum + countEmptySeatSlots(value), 0);
  }
  return isSeatEmptyValue(node) ? 1 : 0;
};

/**
 * Build classroom guest seat priority: front rows first, center columns first,
 * skipping disabled seats and seats already taken.
 */
const buildClassroomGuestSlots = (
  grid: (string | null)[][],
  disabledKeys: Set<string>
): Array<{ r: number; c: number }> => {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0]?.length ?? 0;
  const centerC = (cols - 1) / 2;
  const slots: Array<{ r: number; c: number; score: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (disabledKeys.has(`${r}-${c}`)) continue;
      if (!isSeatEmptyValue(grid[r][c])) continue;
      // Lower score = higher priority. Front row first (heavy), then center.
      const score = r * 100 + Math.abs(c - centerC);
      slots.push({ r, c, score });
    }
  }
  slots.sort((a, b) => a.score - b.score);
  return slots.map(({ r, c }) => ({ r, c }));
};

const cloneSeatDataWithGuestAssignments = (
  seatData: unknown,
  guestNames: string[],
  options: { sceneType?: string; disabledSeats?: string[] } = {}
) => {
  if (guestNames.length === 0) return seatData;

  // Classroom: smart front-center placement that respects disabled seats.
  if (options.sceneType === 'classroom' && Array.isArray(seatData)) {
    const grid = (seatData as (string | null)[][]).map(row => [...row]);
    const disabledKeys = new Set(options.disabledSeats || []);
    const slots = buildClassroomGuestSlots(grid, disabledKeys);
    for (let i = 0; i < guestNames.length && i < slots.length; i++) {
      const { r, c } = slots[i];
      grid[r][c] = guestNames[i];
    }
    return grid;
  }

  // Other scenes: sequential fill of empty slots (preserve existing behavior).
  let cursor = 0;
  const assign = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map(item => assign(item));
    }
    if (node && typeof node === 'object') {
      const next: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        next[key] = assign(value);
      }
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

export default function SeatCheckinPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useLanguage();
  const [session, setSession] = useState<{
    seat_data: unknown;
    student_names: string[];
    scene_config: Record<string, unknown>;
    scene_type: string;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [displaySeatData, setDisplaySeatData] = useState<unknown | null>(null);
  const [isGuestAssigned, setIsGuestAssigned] = useState(false);
  const [assignedSeatHint, setAssignedSeatHint] = useState<string | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const handleRecenter = useCallback(() => {
    setRecenterSignal(s => s + 1);
  }, []);

  const resolveSeatDataForName = async (sessionData: {
    seat_data: unknown;
    student_names: string[];
    scene_type: string;
    scene_config?: Record<string, unknown>;
  }, targetName: string, includeCurrentAsGuest: boolean) => {
    const normalized = targetName.trim();
    const registeredSet = new Set(sessionData.student_names);
    const isRegistered = registeredSet.has(normalized);

    if (isRegistered) {
      return {
        seatData: sessionData.seat_data,
        guestAssigned: false,
        hint: buildSeatHint(sessionData.scene_type, sessionData.seat_data, normalized),
      };
    }

    const { data, error } = await supabase
      .from('seat_checkin_records')
      .select('student_name, checked_in_at')
      .eq('session_id', sessionId)
      .order('checked_in_at', { ascending: true });

    if (error) throw error;

    const guestNames: string[] = [];
    const seen = new Set<string>();
    for (const row of (data || []) as Array<{ student_name: string }>) {
      const studentName = row.student_name.trim();
      if (!studentName || registeredSet.has(studentName) || seen.has(studentName)) continue;
      seen.add(studentName);
      guestNames.push(studentName);
    }

    if (includeCurrentAsGuest && !seen.has(normalized)) {
      guestNames.push(normalized);
      seen.add(normalized);
    }

    const disabledSeats = Array.isArray(sessionData.scene_config?.disabledSeats)
      ? (sessionData.scene_config!.disabledSeats as string[])
      : [];

    // For classroom, capacity excludes disabled seats.
    let capacity = countEmptySeatSlots(sessionData.seat_data);
    if (sessionData.scene_type === 'classroom' && Array.isArray(sessionData.seat_data)) {
      const disabledKeys = new Set(disabledSeats);
      const grid = sessionData.seat_data as (string | null)[][];
      capacity = 0;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (disabledKeys.has(`${r}-${c}`)) continue;
          if (isSeatEmptyValue(grid[r][c])) capacity += 1;
        }
      }
    }
    if (includeCurrentAsGuest && guestNames.length > capacity) {
      throw new Error('NO_SEAT_FOR_GUEST');
    }

    const assignedSeatData = cloneSeatDataWithGuestAssignments(sessionData.seat_data, guestNames, {
      sceneType: sessionData.scene_type,
      disabledSeats,
    });
    const hint = buildSeatHint(sessionData.scene_type, assignedSeatData, normalized);
    return { seatData: assignedSeatData, guestAssigned: true, hint };
  };

  useEffect(() => {
    if (!sessionId) return;
    supabase.from('seat_checkin_sessions').select('*').eq('id', sessionId).single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          toast({ title: t('seatCheckin.sessionNotFound'), variant: 'destructive' });
          setLoading(false);
          return;
        }
        const nextSession = {
          seat_data: data.seat_data,
          student_names: data.student_names as unknown as string[],
          scene_config: data.scene_config as unknown as Record<string, unknown>,
          scene_type: (data as Record<string, unknown>).scene_type as string || 'classroom',
          status: (data as Record<string, unknown>).status as string || 'active',
        };
        setSession(nextSession);

        const storedName = getStoredSeatCheckinName(sessionId).trim();
        if (storedName) {
          setName(storedName);
          try {
            const exists = await hasExistingSeatCheckinRecord(sessionId, storedName);
            if (exists) {
              const resolved = await resolveSeatDataForName(nextSession, storedName, false);
              setDisplaySeatData(resolved.seatData);
              setIsGuestAssigned(resolved.guestAssigned);
              setAssignedSeatHint(resolved.hint);
              setCheckedIn(true);
              setAlreadyCheckedIn(true);
            }
          } catch {
            // Ignore restore failures and allow manual sign-in.
          }
        }

        setLoading(false);
      });
  }, [sessionId, t]);

  const handleNameInput = (val: string) => {
    setName(val);
    if (!session || val.length === 0) { setSuggestions([]); return; }
    const filtered = session.student_names.filter(n =>
      n.toLowerCase().includes(val.toLowerCase()) && n !== val
    );
    setSuggestions(filtered.slice(0, 5));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !sessionId || !session) return;
    const trimmedName = name.trim();
    const isRegistered = session.student_names.includes(trimmedName);
    setSubmitting(true);
    try {
      const exists = await hasExistingSeatCheckinRecord(sessionId, trimmedName);
      if (exists) {
        const resolved = await resolveSeatDataForName(session, trimmedName, false);
        setDisplaySeatData(resolved.seatData);
        setIsGuestAssigned(resolved.guestAssigned);
        setAssignedSeatHint(resolved.hint);
        saveStoredSeatCheckinName(sessionId, trimmedName);
        setName(trimmedName);
        setCheckedIn(true);
        setAlreadyCheckedIn(true);
        if (resolved.guestAssigned) {
          toast({
            title: '您没提前注册，已为您分配临时座位',
            description: resolved.hint ? `分配座位在${resolved.hint}，请按下方引导入座。` : '请按下方引导入座。',
          });
        }
        return;
      }

      if (session.status !== 'active') {
        toast({ title: '签到已结束，无法新增签到', variant: 'destructive' });
        return;
      }

      await supabase.from('seat_checkin_records').insert({
        session_id: sessionId,
        student_name: trimmedName,
      });

      const resolved = await resolveSeatDataForName(session, trimmedName, !isRegistered);
      setDisplaySeatData(resolved.seatData);
      setIsGuestAssigned(resolved.guestAssigned);
      setAssignedSeatHint(resolved.hint);
      saveStoredSeatCheckinName(sessionId, trimmedName);
      setName(trimmedName);
      setCheckedIn(true);
      setAlreadyCheckedIn(false);
      if (resolved.guestAssigned) {
        toast({
          title: '您没提前注册，已为您分配临时座位',
          description: resolved.hint ? `分配座位在${resolved.hint}，请按下方引导入座。` : '请按下方引导入座。',
        });
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'NO_SEAT_FOR_GUEST') {
        toast({ title: '当前可分配座位已满，请联系老师现场安排。', variant: 'destructive' });
      } else {
        toast({ title: t('seatCheckin.failed'), variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[100dvh] px-4 text-muted-foreground">{t('seatCheckin.loading')}</div>;
  }

  if (!session) {
    return <div className="flex items-center justify-center min-h-[100dvh] px-4 text-muted-foreground">{t('seatCheckin.notFound')}</div>;
  }

  if (!checkedIn) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background overflow-y-auto px-5 py-[max(1rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-sm mx-auto min-h-[calc(100dvh-max(2rem,env(safe-area-inset-top))-env(safe-area-inset-bottom))] flex flex-col justify-center pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* Hero */}
          <div className="text-center space-y-3 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto">
              <MapPin className="w-8 h-8" strokeWidth={2.2} />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('seatCheckin.title')}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">{t('seatCheckin.desc')}</p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80 bg-muted/40 px-3 py-1 rounded-full">
              <ScanLine className="w-3 h-3" />
              已通过扫码进入签到页
            </div>
            {session.status !== 'active' && (
              <div className="mt-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                ⚠️ 签到已结束，仅已签到同学可查看座位
              </div>
            )}
          </div>

          {/* Form card */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-5 space-y-4">
            <label className="block text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User2 className="w-3.5 h-3.5" />
              你的姓名
            </label>
            <div className="relative">
              <Input
                value={name}
                onChange={e => handleNameInput(e.target.value)}
                placeholder={t('seatCheckin.namePlaceholder')}
                className="text-center text-base h-14 rounded-xl border-2 focus-visible:border-primary"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoComplete="name"
                inputMode="text"
                enterKeyHint="done"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-56 overflow-y-auto bg-card border border-border rounded-xl shadow-xl">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => { setName(s); setSuggestions([]); }} className="w-full text-left px-4 py-3 text-sm hover:bg-muted active:bg-muted/80 transition-colors border-b border-border/40 last:border-0">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || submitting}
              className="w-full h-14 text-base font-semibold rounded-xl shadow-sm"
            >
              {submitting ? t('seatCheckin.checking') : t('seatCheckin.confirm')}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground/70 leading-relaxed">
              💡 输入姓名时会自动匹配名单，未在名单中的同学将获得临时座位
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sceneType = session.scene_type;
  const studentName = name.trim();
  const effectiveSeatData = displaySeatData ?? session.seat_data;
  // Resolve a clean seat-position label even if the assignedSeatHint is missing
  const seatLabel = assignedSeatHint
    || buildSeatHint(sceneType, effectiveSeatData, studentName)
    || '请在地图上查看你的位置';

  return (
    <div className="min-h-[100dvh] bg-background overflow-auto pb-[max(5rem,env(safe-area-inset-bottom))]">
      {/* Sticky "我的座位" info card */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/60 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/8 to-primary/5 border border-primary/25 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="shrink-0 w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary/80 uppercase tracking-wide">
                    <span>{t('seatCheckin.success')}</span>
                    {alreadyCheckedIn && (
                      <span className="text-[10px] bg-primary/15 text-primary/90 px-1.5 py-0.5 rounded normal-case">已签到</span>
                    )}
                  </div>
                  <div className="text-base font-bold text-foreground truncate">
                    {studentName} <span className="text-primary">·</span> <span className="text-primary">{seatLabel}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleRecenter}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/20 px-3 py-2 rounded-lg border border-primary/20 transition-colors"
                aria-label="回到我的座位"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">回到我的座位</span>
                <span className="inline sm:hidden">居中</span>
              </button>
            </div>
            {isGuestAssigned && (
              <div className="mt-2 text-xs text-foreground/80 bg-card/60 rounded-lg px-2.5 py-1.5 border border-primary/15">
                💡 你不在预设名单中，已自动为你分配临时座位，请按下方引导入座
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {sceneType === 'classroom' && (
          <ClassroomCheckinView seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} recenterSignal={recenterSignal} />
        )}
        {(sceneType === 'smartClassroom' || sceneType === 'banquet') && (
          <RoundTableCheckinView seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} sceneType={sceneType} recenterSignal={recenterSignal} />
        )}
        {sceneType === 'conference' && (
          <ConferenceCheckinView seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} recenterSignal={recenterSignal} />
        )}
        {sceneType === 'concertHall' && (
          <ConcertCheckinView seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} recenterSignal={recenterSignal} />
        )}
        {sceneType === 'computerLab' && (
          <ComputerLabCheckinView seatData={effectiveSeatData} sceneConfig={session.scene_config} studentName={studentName} recenterSignal={recenterSignal} />
        )}
        {!['classroom', 'smartClassroom', 'banquet', 'conference', 'concertHall', 'computerLab'].includes(sceneType) && (
          <div className="text-center text-sm text-muted-foreground bg-muted/40 border border-border rounded-xl px-4 py-6">
            暂不支持该座位场景的可视化展示，请按提示「{seatLabel}」入座。
          </div>
        )}
      </div>
    </div>
  );
}
