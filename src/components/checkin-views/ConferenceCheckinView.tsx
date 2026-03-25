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

  // 路径导航：门口到我的座位的曼哈顿路径
  // 会议桌中心点
  const seatW = 52, seatH = 32, gap = 4;
  const tableW = seatsPerSide * (seatW + gap) + gap;
  const tableH = 40;
  const svgW = tableW + 180;
  const svgH = tableH + seatH * 2 + 60;
  const tableX = (svgW - tableW) / 2;
  const tableY = (svgH - tableH) / 2;
  // 门口/窗户坐标
  const doorPos = (side: EntryDoor['side']) => {
    if (side === 'top') return { x: tableX + tableW / 2, y: tableY - seatH - 40 };
    if (side === 'bottom') return { x: tableX + tableW / 2, y: tableY + tableH + seatH + 40 };
    if (side === 'left') return { x: tableX - seatW - 60, y: tableY + tableH / 2 };
    return { x: tableX + tableW + seatW + 60, y: tableY + tableH / 2 };
  };
  const windowPos = window.side === 'left'
    ? { x: tableX - seatW - 60, y: tableY + tableH / 2 }
    : { x: tableX + tableW + seatW + 60, y: tableY + tableH / 2 };

  // 我的座位坐标
  const mySeatPos = (() => {
    if (myPos.side === 'top') {
      return { x: tableX + gap + myPos.index * (seatW + gap) + seatW / 2, y: tableY - seatH - 6 + seatH / 2 };
    } else if (myPos.side === 'bottom') {
      return { x: tableX + gap + myPos.index * (seatW + gap) + seatW / 2, y: tableY + tableH + 6 + seatH / 2 };
    } else if (myPos.side === 'head-left') {
      return { x: tableX - seatW - 10 + seatW / 2, y: tableY + (tableH - seatH) / 2 + seatH / 2 };
    } else {
      return { x: tableX + tableW + 10 + seatW / 2, y: tableY + (tableH - seatH) / 2 + seatH / 2 };
    }
  })();

  // 路径：选最近的门口
  const nearestDoor = entryDoors[0];
  const nearestDoorPos = doorPos(nearestDoor.side);

  // 路径为直线
  const pathPoints = [
    { ...nearestDoorPos },
    { x: mySeatPos.x, y: nearestDoorPos.y },
    { ...mySeatPos },
  ];

  const seatContainerRef = useAutoCenterMySeat([studentName, myPos.side, myPos.index]);

  const renderSeat = (x: number, y: number, name: string, isMine: boolean) => (
    <g key={`${x}-${y}`} data-my-seat={isMine ? 'true' : undefined}>
      <rect x={x} y={y} width={seatW} height={seatH} rx={8}
        className={isMine
          ? 'fill-primary stroke-primary shadow-lg'
          : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
        strokeWidth={isMine ? 2.5 : 1.5}
        filter={isMine ? 'drop-shadow(0 2px 8px #38bdf8aa)' : undefined}
      />
      {name && (
        <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          className={`${name.length >= 4 ? 'text-[8px]' : 'text-[10px]'} ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
          {name}
        </text>
      )}
    </g>
  );

  // 美化UI，增加门窗、路径、图例
  const sideLabel = myPos.side === 'top' ? '上方' : myPos.side === 'bottom' ? '下方'
    : myPos.side === 'head-left' ? '左侧主位' : '右侧主位';

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的位置在会议桌 <strong>{sideLabel}{myPos.side === 'top' || myPos.side === 'bottom' ? ` · 第${myPos.index + 1}位` : ''}</strong>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        {entryDoors.map((d, idx) => (
          <span key={idx} className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-green-400/60 border border-green-600/30 inline-block" /> {d.label}</span>
        ))}
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-sky-400/40 border border-sky-600/30 inline-block" /> {window.label}</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-yellow-300/60 border border-yellow-600/30 inline-block" /> 导航路径</span>
      </div>

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-auto pb-4">
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans">
          {/* 门口 */}
          {entryDoors.map((d, idx) => {
            const pos = doorPos(d.side);
            return (
              <g key={d.side}>
                <rect x={pos.x - 24} y={pos.y - 18} width={48} height={36} rx={10}
                  className="fill-green-200/80 stroke-green-600/40" strokeWidth={2} />
                <text x={pos.x} y={pos.y + 2} textAnchor="middle" dominantBaseline="middle" className="fill-green-700 text-xs font-bold">{d.label}</text>
              </g>
            );
          })}
          {/* 窗户 */}
          <g>
            <rect x={windowPos.x - 18} y={windowPos.y - 32} width={36} height={64} rx={8}
              className="fill-sky-200/80 stroke-sky-600/40" strokeWidth={2} />
            <text x={windowPos.x} y={windowPos.y} textAnchor="middle" dominantBaseline="middle" className="fill-sky-700 text-xs font-bold">{window.label}</text>
          </g>
          {/* 路径高亮 */}
          <polyline points={pathPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#facc15" strokeWidth={5} strokeDasharray="8 6" opacity={0.85} />
          {/* 会议桌 */}
          <rect x={tableX} y={tableY} width={tableW} height={tableH} rx={16}
            className="fill-primary/10 stroke-primary/30 shadow-md" strokeWidth={2.5} />
          <text x={tableX + tableW / 2} y={tableY + tableH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
            className="fill-primary text-base font-semibold">会议桌</text>

          {/* Top row */}
          {Array.from({ length: seatsPerSide }).map((_, i) => {
            const x = tableX + gap + i * (seatW + gap);
            const y = tableY - seatH - 6;
            const isMine = myPos.side === 'top' && myPos.index === i;
            return renderSeat(x, y, data.top[i] || '', isMine);
          })}

          {/* Bottom row */}
          {Array.from({ length: seatsPerSide }).map((_, i) => {
            const x = tableX + gap + i * (seatW + gap);
            const y = tableY + tableH + 6;
            const isMine = myPos.side === 'bottom' && myPos.index === i;
            return renderSeat(x, y, data.bottom[i] || '', isMine);
          })}

          {/* Head seats */}
          {renderSeat(tableX - seatW - 10, tableY + (tableH - seatH) / 2, data.headLeft, myPos.side === 'head-left')}
          {renderSeat(tableX + tableW + 10, tableY + (tableH - seatH) / 2, data.headRight, myPos.side === 'head-right')}
        </svg>
      </div>

      <div className="text-center text-xs text-primary font-medium mb-2">
        <span>🚪 从<strong>{nearestDoor.label}</strong>出发，沿黄色路径到达你的座位</span>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>📍 走到会议桌{sideLabel}
          {(myPos.side === 'top' || myPos.side === 'bottom') && `，从左数第 ${myPos.index + 1} 个位置`}
        </p>
      </div>
    </>
  );
}
