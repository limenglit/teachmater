import { useMemo } from 'react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';

// 门窗布局与导航逻辑参考 SmartClassroom/RoundTableCheckinView
type EntryDoor = { side: 'top' | 'bottom' | 'left' | 'right'; label: string; };
type Window = { side: 'left' | 'right'; label: string };

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
}

interface ConferenceData {
  top: string[];
  bottom: string[];
  headLeft: string;
  headRight: string;
}

export default function ConferenceCheckinView({ seatData, sceneConfig, studentName }: Props) {
  // 健壮性校验
  const valid = seatData && typeof seatData === 'object'
    && Array.isArray((seatData as any).top)
    && Array.isArray((seatData as any).bottom)
    && typeof (seatData as any).headLeft === 'string'
    && typeof (seatData as any).headRight === 'string';
  if (!valid) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-3xl mb-4 text-destructive">⚠️</div>
        <div className="text-xl font-bold text-destructive mb-2">座位数据异常</div>
        <div className="text-sm text-muted-foreground">请联系管理员或刷新页面重试</div>
      </div>
    );
  }
  const data = seatData as ConferenceData;
  const seatsPerSide = (sceneConfig.seatsPerSide as number) || data.top.length;

  // 门窗布局，参考教室场景
  const entryDoors: EntryDoor[] = useMemo(() => {
    // 支持自定义 entryDoorSide: ['top', ...]
    if (Array.isArray(sceneConfig.entryDoorSides)) {
      return (sceneConfig.entryDoorSides as string[]).map(side => ({
        side: side as EntryDoor['side'],
        label: side === 'top' ? '前门' : side === 'bottom' ? '后门' : side === 'left' ? '左门' : '右门',
      }));
    }
    // 兼容旧配置
    const mode = sceneConfig.entryDoorMode as string || 'front';
    if (mode === 'both') return [
      { side: 'top', label: '前门' },
      { side: 'bottom', label: '后门' },
    ];
    if (mode === 'back') return [{ side: 'bottom', label: '后门' }];
    return [{ side: 'top', label: '前门' }];
  }, [sceneConfig]);

  // 窗户自动避开门
  const window: Window = useMemo(() => {
    const doorSides = entryDoors.map(d => d.side);
    if (doorSides.includes('left')) return { side: 'right', label: '窗户' };
    if (doorSides.includes('right')) return { side: 'left', label: '窗户' };
    return { side: 'right', label: '窗户' };
  }, [entryDoors]);

  // 查找我的座位
  const myPos = useMemo(() => {
    if (data.headLeft === studentName) return { side: 'head-left' as const, index: 0 };
    if (data.headRight === studentName) return { side: 'head-right' as const, index: 0 };
    const topIdx = data.top.indexOf(studentName);
    if (topIdx >= 0) return { side: 'top' as const, index: topIdx };
    const bottomIdx = data.bottom.indexOf(studentName);
    if (bottomIdx >= 0) return { side: 'bottom' as const, index: bottomIdx };
    return null;
  }, [data, studentName]);

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  // 只显示签到成功提示
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-3xl mb-4">✅</div>
      <div className="text-xl font-bold text-primary mb-2">签到成功</div>
      <div className="text-sm text-muted-foreground">欢迎参加会议，{studentName}！</div>
    </div>
  );
}
