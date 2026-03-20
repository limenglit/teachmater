import { useMemo, useState } from 'react';
import { getActiveClassName } from '@/lib/class-context';
import { createSeatCheckinSession } from '@/lib/seat-checkin-session';
import { getRequireSeatAssignmentBeforeCheckin, isSeatAssignmentComplete } from '@/lib/seat-checkin-policy';

interface UseSeatExportQrParams {
  seatData: unknown;
  studentNames: string[];
  sceneConfig: Record<string, unknown>;
  sceneType: string;
}

export function useSeatExportQr({ seatData, studentNames, sceneConfig, sceneType }: UseSeatExportQrParams) {
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);

  const className = useMemo(() => getActiveClassName() || '当前班级', []);

  const resolveQrCode = async () => {
    if (checkinUrl) {
      return { value: checkinUrl, className };
    }

    const requireSeatAssignment = getRequireSeatAssignmentBeforeCheckin();
    const completed = isSeatAssignmentComplete(seatData, studentNames);
    if (requireSeatAssignment && !completed) {
      throw new Error('请先完成排座后再发起签到');
    }

    const created = await createSeatCheckinSession({
      seatData,
      studentNames,
      sceneConfig,
      sceneType,
      durationMinutes: 5,
      className,
    });
    setCheckinUrl(created.checkinUrl);
    return { value: created.checkinUrl, className };
  };

  const handleSessionCreated = (url: string) => {
    setCheckinUrl(url);
  };

  return {
    className,
    resolveQrCode,
    handleSessionCreated,
  };
}
