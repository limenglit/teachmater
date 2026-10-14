import '@/student-seat.css';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams } from '@/lib/scan-params';
import { useLanguage } from '@/contexts/language-core';
import { buildSeatHint } from '@/lib/seat-hint';

import { studentSupabase as supabase } from '@/lib/student-supabase';
import { normalizeSessionId, loadScanSession, reportScanDiag, formatScanDiag } from '@/lib/scan-session';
import {
  findMissingRequiredField,
  normalizeCustomFields,
  splitFieldValues,
  type CheckinCustomField,
} from '@/lib/seat-checkin-fields';
import { Button, Input, toast } from '@/components/student-ui';
import { MapPin, ScanLine, User2, ShieldCheck } from '@/components/student-icons';
const SeatCheckinResult = lazy(() => import('@/components/checkin-views/SeatCheckinResult'));

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

const normalizeStudentName = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

const isSameStudentName = (left: unknown, right: string) => {
  if (typeof left !== 'string') return false;
  return normalizeStudentName(left) === normalizeStudentName(right);
};

const hasExistingSeatCheckinRecord = async (sessionId: string, studentName: string) => {
  const { data, error } = await supabase.rpc('has_seat_checkin_record', {
    p_session_id: sessionId,
    p_student_name: studentName,
  } as any);
  if (error) throw error;
  return data === true;
};

const submitSeatCheckinRecord = async (
  sessionId: string,
  studentName: string,
  otp?: string,
  extra?: { org?: string; phone?: string; extra?: Record<string, string> },
) => {
  const { data, error } = await (supabase.rpc as any)('submit_seat_checkin_record', {
    p_session_id: sessionId,
    p_student_name: studentName,
    ...(otp ? { p_otp: otp } : {}),
    ...(extra?.org ? { p_org: extra.org } : {}),
    ...(extra?.phone ? { p_phone: extra.phone } : {}),
    ...(extra?.extra && Object.keys(extra.extra).length > 0 ? { p_extra: extra.extra } : {}),
  } as any);
  if (error) {
    if (/INVALID_OTP/i.test(error.message || '')) throw new Error('INVALID_OTP');
    throw error;
  }
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error('NO_RECORD_CREATED');
  }
  return Array.isArray(data) ? data[0] : data;
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


export default function SeatCheckinPage() {
  const { sessionId: rawSessionId } = useParams<{ sessionId: string }>();
  const sessionId = normalizeSessionId(rawSessionId) || undefined;
  const [loadFailed, setLoadFailed] = useState(false);
  const [diagText, setDiagText] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const { t } = useLanguage();
  const [session, setSession] = useState<{
    seat_data: unknown;
    student_names: string[];
    scene_config: Record<string, unknown>;
    scene_type: string;
    status: string;
    otp_enabled: boolean;
    custom_fields: CheckinCustomField[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [displaySeatData, setDisplaySeatData] = useState<unknown | null>(null);
  const [isGuestAssigned, setIsGuestAssigned] = useState(false);
  const [assignedSeatHint, setAssignedSeatHint] = useState<string | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [neighbor, setNeighbor] = useState<SeatNeighbor | null>(null);
  const [friendName, setFriendName] = useState<string | null>(null);



  const resolveSeatDataForName = async (sessionData: {
    seat_data: unknown;
    student_names: string[];
    scene_type: string;
    scene_config?: Record<string, unknown>;
  }, targetName: string, includeCurrentAsGuest: boolean) => {
    const normalized = normalizeStudentName(targetName);
    const registeredSet = new Set(sessionData.student_names.map(normalizeStudentName).filter(Boolean));
    const isRegistered = registeredSet.has(normalized);

    if (isRegistered) {
      return {
        seatData: sessionData.seat_data,
        guestAssigned: false,
        hint: buildSeatHint(sessionData.scene_type, sessionData.seat_data, normalized, sessionData.scene_config),
      };
    }

    const { data, error } = await supabase.rpc('get_seat_checkin_guest_records', {
      p_session_id: sessionId,
    } as any);

    if (error) throw error;

    const guestNames: string[] = [];
    const seen = new Set<string>();
    for (const row of (data || []) as Array<{ student_name: string }>) {
      const studentName = normalizeStudentName(row.student_name);
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
    const hint = buildSeatHint(sessionData.scene_type, assignedSeatData, normalized, sessionData.scene_config);
    return { seatData: assignedSeatData, guestAssigned: true, hint };
  };

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    setLoading(true);
    setLoadFailed(false);
    loadScanSession('get_seat_checkin_session_for_student', sessionId)
      .then(async (res) => {
        if (res.diag) reportScanDiag('seat-checkin', sessionId, res.kind === 'ok', res.diag);
        if (res.kind !== 'ok') {
          if (res.kind === 'network') { setLoadFailed(true); setDiagText(formatScanDiag(res.diag)); }
          else toast({ title: t('seatCheckin.sessionNotFound'), variant: 'destructive' });
          setLoading(false);
          return;
        }
        const d: any = res.data;
        const nextSession = {
          seat_data: d.seat_data,
          student_names: ((d.student_names as unknown as string[]) || []).map(normalizeStudentName).filter(Boolean),
          scene_config: d.scene_config as unknown as Record<string, unknown>,
          scene_type: (d.scene_type as string) || 'classroom',
          status: (d.status as string) || 'active',
          otp_enabled: d.otp_enabled === true,
          custom_fields: normalizeCustomFields(d.scene_config),
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
  }, [sessionId, t, reloadKey]);

  const handleNameInput = (val: string) => {
    setName(val);
    if (!session || val.length === 0) { setSuggestions([]); return; }
    const normalizedValue = normalizeStudentName(val).toLowerCase();
    const filtered = session.student_names.filter(n =>
      normalizeStudentName(n).toLowerCase().includes(normalizedValue)
      && normalizeStudentName(n) !== normalizeStudentName(val)
    );
    setSuggestions(filtered.slice(0, 5));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !sessionId || !session) return;
    const trimmedName = normalizeStudentName(name);
    const otpCode = otpInput.replace(/\D/g, '');
    if (session.otp_enabled && otpCode.length !== 6) {
      toast({ title: '请输入大屏上的 6 位签到口令', variant: 'destructive' });
      return;
    }
    const missingField = findMissingRequiredField(session.custom_fields, fieldValues);
    if (missingField) {
      toast({ title: `请填写${missingField.label}`, variant: 'destructive' });
      return;
    }
    const isRegistered = session.student_names.some(n => normalizeStudentName(n) === trimmedName);
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
            title: t('seatCheckin.guestToastTitle'),
            description: resolved.hint ? `${t('seatCheckin.guestSeatAtPrefix')}${resolved.hint}。${t('seatCheckin.followGuide')}` : t('seatCheckin.followGuide'),
          });
        }
        return;
      }

      if (session.status !== 'active') {
        toast({ title: t('seatCheckin.endedCannotAdd'), variant: 'destructive' });
        return;
      }

      const submitted = splitFieldValues(session.custom_fields, fieldValues);
      await submitSeatCheckinRecord(sessionId, trimmedName, session.otp_enabled ? otpCode : undefined, {
        org: submitted.org || undefined,
        phone: submitted.phone || undefined,
        extra: submitted.extra,
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
          title: t('seatCheckin.guestToastTitle'),
          description: resolved.hint ? `${t('seatCheckin.guestSeatAtPrefix')}${resolved.hint}。${t('seatCheckin.followGuide')}` : t('seatCheckin.followGuide'),
        });
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'INVALID_OTP') {
        setOtpInput('');
        toast({ title: '口令错误或已过期', description: '请看大屏最新的 6 位数字后重试。', variant: 'destructive' });
      } else if (code === 'NO_SEAT_FOR_GUEST') {
        toast({ title: t('seatCheckin.allSeatsFull'), variant: 'destructive' });
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
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[100dvh] px-4 text-center text-muted-foreground">
        <p>{loadFailed ? '签到页加载失败' : t('seatCheckin.notFound')}</p>
        <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>重新加载</Button>
        {loadFailed && diagText ? (
          <p className="max-w-xs break-all text-[11px] leading-4 text-muted-foreground/80 select-all">诊断：{diagText}</p>
        ) : null}
      </div>
    );
  }

  if (!checkedIn) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background overflow-y-auto px-5 py-[max(1rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-sm mx-auto min-h-[calc(100dvh-max(2rem,env(safe-area-inset-top))-env(safe-area-inset-bottom))] flex flex-col justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
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
              {t('seatCheckin.scanned')}
            </div>
            {session.status !== 'active' && (
              <div className="mt-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                ⚠️ {t('seatCheckin.endedNotice')}
              </div>
            )}
          </div>

          {/* Form card */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-5 space-y-4">
            <label className="block text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User2 className="w-3.5 h-3.5" />
              {t('seatCheckin.yourName')}
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
            {session.custom_fields.map(field => (
              <div key={field.id} className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </label>
                <Input
                  value={fieldValues[field.id] || ''}
                  onChange={e => {
                    const raw = e.target.value;
                    const v = field.type === 'tel'
                      ? raw.replace(/[^\d+\-\s]/g, '').slice(0, 20)
                      : field.type === 'number'
                        ? raw.replace(/[^\d.]/g, '').slice(0, 20)
                        : raw.slice(0, 100);
                    setFieldValues(prev => ({ ...prev, [field.id]: v }));
                  }}
                  placeholder={`请填写${field.label}`}
                  className={`text-center text-base h-14 rounded-xl border-2 focus-visible:border-primary${field.type === 'text' ? '' : ' tabular-nums'}`}
                  inputMode={field.type === 'tel' ? 'tel' : field.type === 'number' ? 'numeric' : 'text'}
                  enterKeyHint="next"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            ))}
            {session.otp_enabled && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  大屏上的 6 位签到口令
                </label>
                <Input
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 位数字"
                  className="text-center text-2xl tracking-[0.4em] h-14 rounded-xl border-2 focus-visible:border-primary tabular-nums"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  enterKeyHint="done"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  该口令每隔数十秒自动更换，请以教室大屏当前显示的数字为准。
                </p>
              </div>
            )}
            <Button
              onClick={handleSubmit}
              disabled={
                !name.trim() || submitting
                || (session.otp_enabled && otpInput.replace(/\D/g, '').length !== 6)
                || !!findMissingRequiredField(session.custom_fields, fieldValues)
              }

              className="w-full h-14 text-base font-semibold rounded-xl shadow-sm"
            >
              {submitting ? t('seatCheckin.checking') : t('seatCheckin.confirm')}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground/70 leading-relaxed">
              💡 {t('seatCheckin.autoMatchHint')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[100dvh] px-4 text-muted-foreground">{t('seatCheckin.loading')}</div>}>
      <SeatCheckinResult sessionId={sessionId} session={session} name={name} displaySeatData={displaySeatData} assignedSeatHint={assignedSeatHint} alreadyCheckedIn={alreadyCheckedIn} isGuestAssigned={isGuestAssigned} />
    </Suspense>
  );
}