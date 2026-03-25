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
  // 兼容 mainTop/mainBottom 字段
  const valid = seatData && typeof seatData === 'object'
    && ((Array.isArray((seatData as any).top) && Array.isArray((seatData as any).bottom))
      || (Array.isArray((seatData as any).mainTop) && Array.isArray((seatData as any).mainBottom)))
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
  // 统一数据结构
  const data = {
    top: (seatData as any).top || (seatData as any).mainTop || [],
    bottom: (seatData as any).bottom || (seatData as any).mainBottom || [],
    headLeft: (seatData as any).headLeft,
    headRight: (seatData as any).headRight,
  };
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

  // 显示签到成功、座位位置和导航指示
  const sideLabel = myPos.side === 'top' ? '上方' : myPos.side === 'bottom' ? '下方'
    : myPos.side === 'head-left' ? '左侧主位' : '右侧主位';
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-3">
      <div className="text-3xl mb-2">✅</div>
      <div className="text-xl font-bold text-primary">签到成功</div>
      <div className="text-base text-foreground">{studentName}，你的座位在 <strong>{sideLabel}{myPos.side === 'top' || myPos.side === 'bottom' ? ` · 第${myPos.index + 1}位` : ''}</strong></div>
      <div className="text-sm text-muted-foreground">请从门口进入，沿黄色路径找到你的座位</div>
      <div className="mt-4 w-full max-w-md flex flex-col items-center">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
          {entryDoors.map((d, idx) => (
            <span key={idx} className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-green-400/60 border border-green-600/30 inline-block" /> {d.label}</span>
          ))}
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-sky-400/40 border border-sky-600/30 inline-block" /> {window.label}</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-yellow-300/60 border border-yellow-600/30 inline-block" /> 导航路径</span>
        </div>
        {/* 简化版SVG导航示意图 */}
        <svg width="320" height="100" viewBox="0 0 320 100" className="my-2">
          {/* 门口 */}
          <rect x="150" y="10" width="40" height="20" rx="6" className="fill-green-200/80 stroke-green-600/40" strokeWidth="2" />
          <text x="170" y="25" textAnchor="middle" dominantBaseline="middle" className="fill-green-700 text-xs font-bold">门口</text>
          {/* 路径高亮 */}
          <polyline points="170,30 170,80" fill="none" stroke="#facc15" strokeWidth="5" strokeDasharray="8 6" opacity="0.85" />
          {/* 会议桌 */}
          <rect x="110" y="80" width="120" height="16" rx="8" className="fill-primary/10 stroke-primary/30" strokeWidth="2" />
          <text x="170" y="88" textAnchor="middle" dominantBaseline="middle" className="fill-primary text-xs font-semibold">会议桌</text>
          {/* 我的座位高亮 */}
          <circle cx="170" cy="88" r="10" className="fill-primary stroke-primary" strokeWidth="2.5" />
          <text x="170" y="91" textAnchor="middle" dominantBaseline="middle" className="fill-primary-foreground text-xs font-bold">你</text>
        </svg>
      </div>
    </div>
  );
}
