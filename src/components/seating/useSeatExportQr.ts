import { useMemo, useState } from 'react';
import { getActiveClassName } from '@/lib/class-context';
import { createSeatCheckinSession } from '@/lib/seat-checkin-session';

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

    const created = await createSeatCheckinSession({
      seatData,
      studentNames,
      sceneConfig,
      sceneType,
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
