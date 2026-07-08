import { useEffect, useState, useCallback, useRef } from 'react';
import { getActiveClassName, ACTIVE_CLASS_CHANGED_EVENT } from '@/lib/class-context';
import { createSeatCheckinSession } from '@/lib/seat-checkin-session';
import { getRequireSeatAssignmentBeforeCheckin, isSeatAssignmentComplete } from '@/lib/seat-checkin-policy';
import { useLanguage } from '@/contexts/LanguageContext';

interface UseSeatExportQrParams {
  seatData: unknown;
  studentNames: string[];
  seatAssignmentReady?: boolean;
  sceneConfig: Record<string, unknown>;
  sceneType: string;
  durationMinutes?: number;
}

export function useSeatExportQr({ seatData, studentNames, seatAssignmentReady, sceneConfig, sceneType, durationMinutes }: UseSeatExportQrParams) {
  const { t } = useLanguage();
  const fallback = t('seat.qr.fallbackClass');
  const [activeName, setActiveName] = useState<string>(() => getActiveClassName());
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const cachedForNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setActiveName(getActiveClassName());
    window.addEventListener(ACTIVE_CLASS_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(ACTIVE_CLASS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const className = activeName || fallback;

  // Invalidate cached check-in URL when class name changes so QR label & session
  // stay in sync with the currently saved class.
  useEffect(() => {
    if (cachedForNameRef.current !== null && cachedForNameRef.current !== className) {
      setCheckinUrl(null);
    }
  }, [className]);

  const resolveQrCode = async () => {
    // Always read latest name at export time to guard against stale memoized value.
    const latestName = getActiveClassName() || fallback;
    if (checkinUrl && cachedForNameRef.current === latestName) {
      return { value: checkinUrl, className: latestName };
    }

    const requireSeatAssignment = getRequireSeatAssignmentBeforeCheckin();
    const completed = typeof seatAssignmentReady === 'boolean'
      ? seatAssignmentReady
      : isSeatAssignmentComplete(seatData, studentNames);
    if (requireSeatAssignment && !completed) {
      throw new Error(t('seat.qr.requireAssign'));
    }

    setIsCreating(true);
    setLastError(null);
    try {
      const created = await createSeatCheckinSession({
        seatData,
        studentNames,
        sceneConfig,
        sceneType,
        durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : 5,
        className: latestName,
      });
      setCheckinUrl(created.checkinUrl);
      cachedForNameRef.current = latestName;
      return { value: created.checkinUrl, className: latestName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成签到码失败';
      setLastError(msg);
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const handleSessionCreated = (url: string) => {
    setCheckinUrl(url);
    cachedForNameRef.current = getActiveClassName() || fallback;
    setLastError(null);
  };

  const reset = useCallback(() => {
    setCheckinUrl(null);
    cachedForNameRef.current = null;
    setLastError(null);
    setIsCreating(false);
  }, []);

  return {
    className,
    checkinUrl,
    isCreating,
    lastError,
    resolveQrCode,
    handleSessionCreated,
    reset,
  };
}
