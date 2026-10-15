import '@/student-seat.css';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams } from '@/lib/scan-params';
import { useLanguage } from '@/contexts/language-core';
import { normalizeStudentName } from '@/lib/student-name';

import { normalizeSessionId, loadScanSession } from '@/lib/scan-session';
import type { CheckinCustomField } from '@/lib/seat-checkin-fields';
import { Button, Input, toast } from '@/components/student-ui';
import { MapPin, ScanLine, User2 } from '@/components/student-icons';
const SeatCheckinResult = lazy(() => import('@/components/checkin-views/SeatCheckinResult'));

const SeatCheckinExtraFields = lazy(() => import('@/components/SeatCheckinExtraFields'));
const findMissingRequiredField = (fields: CheckinCustomField[], values: Record<string, string>) => fields.find(f => f.required && !(values[f.id] || '').trim()) || null;
const hasCustomFields = (cfg: unknown) => {
  const c = (cfg || {}) as Record<string, unknown>;
  return (Array.isArray(c.customFields) && c.customFields.length > 0) || c.collectOrg === true || c.collectPhone === true;
};
const submitMod = () => import('@/lib/seat-checkin-submit');

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
  const [attempt, setAttempt] = useState(0);
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




  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    setLoading(true);
    setLoadFailed(false);
    loadScanSession('get_seat_checkin_session_for_student', sessionId, 60000, setAttempt)
      .then(async (res) => {
        // 诊断上报放到页面显示之后再下载，不拖慢首屏
        const diag = res.diag;
        const diagMod = () => import('@/lib/scan-diag');
        if (diag) void diagMod().then((m) => m.reportScanDiag('seat-checkin', sessionId, res.kind === 'ok', diag), () => undefined);
        if (res.kind !== 'ok') {
          if (res.kind === 'network') { setLoadFailed(true); void diagMod().then((m) => setDiagText(m.formatScanDiag(res.diag)), () => undefined); }
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
          // 只有老师设置了自定义填写项时，才下载解析工具
          custom_fields: hasCustomFields(d.scene_config) ? (await import('@/lib/seat-checkin-fields-core')).normalizeCustomFields(d.scene_config) : [],
        };
        setSession(nextSession);

        const storedName = getStoredSeatCheckinName(sessionId).trim();
        if (storedName) {
          setName(storedName);
          try {
            const exists = await (await submitMod()).hasExistingSeatCheckinRecord(sessionId, storedName);
            if (exists) {
              const resolved = await (await submitMod()).resolveSeatDataForName(sessionId, nextSession, storedName, false);
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
      const exists = await (await submitMod()).hasExistingSeatCheckinRecord(sessionId, trimmedName);
      if (exists) {
        const resolved = await (await submitMod()).resolveSeatDataForName(sessionId, session, trimmedName, false);
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

      const submitted = (await submitMod()).splitFieldValues(session.custom_fields, fieldValues);
      await (await submitMod()).submitSeatCheckinRecord(sessionId, trimmedName, session.otp_enabled ? otpCode : undefined, {
        org: submitted.org || undefined,
        phone: submitted.phone || undefined,
        extra: submitted.extra,
      });

      const resolved = await (await submitMod()).resolveSeatDataForName(sessionId, session, trimmedName, !isRegistered);
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
    return <div className="flex flex-col items-center justify-center min-h-[100dvh] px-4 text-muted-foreground">{t('seatCheckin.loading')}{attempt > 1 ? <div className="text-xs mt-2">正在连接… 第 {attempt} 次</div> : null}</div>;
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
            {(session.custom_fields.length > 0 || session.otp_enabled) && (
              <Suspense fallback={null}>
                <SeatCheckinExtraFields fields={session.custom_fields} values={fieldValues} setValues={setFieldValues} otpEnabled={session.otp_enabled} otp={otpInput} setOtp={setOtpInput} onEnter={handleSubmit} />
              </Suspense>
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