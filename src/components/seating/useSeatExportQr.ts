import { useMemo, useState, useCallback } from 'react';
import { getActiveClassName } from '@/lib/class-context';
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
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const className = useMemo(() => getActiveClassName() || t('seat.qr.fallbackClass'), [t]);

  const resolveQrCode = async () => {
    if (checkinUrl) {
      return { value: checkinUrl, className };
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
        className,
      });
      setCheckinUrl(created.checkinUrl);
      return { value: created.checkinUrl, className };
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
    setLastError(null);
  };

  const reset = useCallback(() => {
    setCheckinUrl(null);
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
