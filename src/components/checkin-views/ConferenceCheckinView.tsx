import { useMemo } from 'react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';

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

  const sideLabel = myPos.side === 'top' ? '上方' : myPos.side === 'bottom' ? '下方'
    : myPos.side === 'head-left' ? '左侧主位' : '右侧主位';

  const seatW = 52, seatH = 32, gap = 4;
  const tableW = seatsPerSide * (seatW + gap) + gap;
  const tableH = 40;
  const svgW = tableW + 180;
  const svgH = tableH + seatH * 2 + 60;
  const tableX = (svgW - tableW) / 2;
  const tableY = (svgH - tableH) / 2;
  const seatContainerRef = useAutoCenterMySeat([studentName, myPos.side, myPos.index]);

  const renderSeat = (x: number, y: number, name: string, isMine: boolean) => (
    <g key={`${x}-${y}`} data-my-seat={isMine ? 'true' : undefined}>
      <rect x={x} y={y} width={seatW} height={seatH} rx={6}
        className={isMine
          ? 'fill-primary stroke-primary'
          : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
        strokeWidth={isMine ? 2.5 : 1.5}
      />
      {name && (
        <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          className={`${name.length >= 4 ? 'text-[8px]' : 'text-[10px]'} ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
          {name}
        </text>
      )}
    </g>
  );

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的位置在会议桌 <strong>{sideLabel}{myPos.side === 'top' || myPos.side === 'bottom' ? ` · 第${myPos.index + 1}位` : ''}</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
      </div>

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-auto pb-4">
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans">
          <rect x={tableX} y={tableY} width={tableW} height={tableH} rx={10}
            className="fill-primary/10 stroke-primary/30" strokeWidth={2} />
          <text x={tableX + tableW / 2} y={tableY + tableH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
            className="fill-primary text-xs font-medium">会议桌</text>

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

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>📍 走到会议桌{sideLabel}
          {(myPos.side === 'top' || myPos.side === 'bottom') && `，从左数第 ${myPos.index + 1} 个位置`}
        </p>
      </div>
    </>
  );
}
