import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { usePinchZoom } from './usePinchZoom';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
}

type SeatPosition = {
  side: 'head-left' | 'head-right' | 'top' | 'bottom' | 'companion-top' | 'companion-bottom';
  index: number;
  companionRow?: number;
  label: string;
};

export default function ConferenceCheckinView({ seatData, sceneConfig, studentName }: Props) {
  const raw = seatData as Record<string, unknown>;
  const valid = raw && typeof raw === 'object'
    && ((Array.isArray(raw.top) && Array.isArray(raw.bottom))
      || (Array.isArray(raw.mainTop) && Array.isArray(raw.mainBottom)))
    && typeof raw.headLeft === 'string'
    && typeof raw.headRight === 'string';

  const data = useMemo(() => {
    if (!valid) return null;
    return {
      headLeft: raw.headLeft as string,
      headRight: raw.headRight as string,
      top: (raw.top || raw.mainTop) as string[],
      bottom: (raw.bottom || raw.mainBottom) as string[],
      companionTop: (raw.companionTop as string[][] | undefined) || [],
      companionBottom: (raw.companionBottom as string[][] | undefined) || [],
    };
  }, [raw, valid]);

  const seatsPerSide = (sceneConfig.seatsPerSide as number) || data?.top.length || 10;
  const companionRows = (sceneConfig.companionRows as number) || 0;

  const myPos = useMemo((): SeatPosition | null => {
    if (!data) return null;
    if (data.headLeft === studentName) return { side: 'head-left', index: 0, label: '左侧主位' };
    if (data.headRight === studentName) return { side: 'head-right', index: 0, label: '右侧主位' };
    const topIdx = data.top.indexOf(studentName);
    if (topIdx >= 0) return { side: 'top', index: topIdx, label: `上方第${topIdx + 1}位` };
    const bottomIdx = data.bottom.indexOf(studentName);
    if (bottomIdx >= 0) return { side: 'bottom', index: bottomIdx, label: `下方第${bottomIdx + 1}位` };
    for (let cr = 0; cr < data.companionTop.length; cr++) {
      const ci = data.companionTop[cr].indexOf(studentName);
      if (ci >= 0) return { side: 'companion-top', index: ci, companionRow: cr, label: `上方随员第${cr + 1}排第${ci + 1}位` };
    }
    for (let cr = 0; cr < data.companionBottom.length; cr++) {
      const ci = data.companionBottom[cr].indexOf(studentName);
      if (ci >= 0) return { side: 'companion-bottom', index: ci, companionRow: cr, label: `下方随员第${cr + 1}排第${ci + 1}位` };
    }
    return null;
  }, [data, studentName]);

  const seatContainerRef = useAutoCenterMySeat([studentName, myPos?.side, myPos?.index]);
  const { containerRef: pinchRef, transformStyle } = usePinchZoom();

  if (!valid || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-3xl mb-4 text-destructive">⚠️</div>
        <div className="text-xl font-bold text-destructive mb-2">座位数据异常</div>
        <div className="text-sm text-muted-foreground">请联系管理员或刷新页面重试</div>
      </div>
    );
  }

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  // Layout constants
  const seatW = 38, seatH = 26, gap = 3;
  const tableW = seatsPerSide * (seatW + gap) + 20;
  const tableH = 16;
  const sideGap = 6;
  const companionGap = 4;

  // Calculate total height
  const topCompanionH = companionRows * (seatH + companionGap);
  const bottomCompanionH = companionRows * (seatH + companionGap);
  const totalH = topCompanionH + seatH + sideGap + tableH + sideGap + seatH + bottomCompanionH;

  const svgW = tableW + 100; // extra for head seats + door
  const svgH = totalH + 80;

  const tableX = (svgW - tableW) / 2;
  const tableY = 40 + topCompanionH + seatH + sideGap;
  const headSeatW = 32, headSeatH = tableH;

  // Door position: right side, vertically centered
  const doorX = svgW - 20;
  const doorY = tableY + tableH / 2;

  // Compute seat center positions
  const getSeatCenter = (pos: SeatPosition): { x: number; y: number } => {
    const seatStartX = tableX + 10;
    switch (pos.side) {
      case 'head-left':
        return { x: tableX - headSeatW / 2 - 4, y: tableY + tableH / 2 };
      case 'head-right':
        return { x: tableX + tableW + headSeatW / 2 + 4, y: tableY + tableH / 2 };
      case 'top':
        return { x: seatStartX + pos.index * (seatW + gap) + seatW / 2, y: tableY - sideGap - seatH / 2 };
      case 'bottom':
        return { x: seatStartX + pos.index * (seatW + gap) + seatW / 2, y: tableY + tableH + sideGap + seatH / 2 };
      case 'companion-top': {
        const cr = pos.companionRow || 0;
        return { x: seatStartX + pos.index * (seatW + gap) + seatW / 2, y: tableY - sideGap - seatH - (cr + 1) * (seatH + companionGap) + seatH / 2 };
      }
      case 'companion-bottom': {
        const cr = pos.companionRow || 0;
        return { x: seatStartX + pos.index * (seatW + gap) + seatW / 2, y: tableY + tableH + sideGap + seatH + (cr + 1) * companionGap + cr * seatH + seatH / 2 };
      }
    }
  };

  const mySeatCenter = getSeatCenter(myPos);

  // Navigation path from door to seat
  const navPath = [
    { x: doorX, y: doorY },
    { x: mySeatCenter.x, y: doorY },
    { x: mySeatCenter.x, y: mySeatCenter.y },
  ];
  const pathD = navPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const renderSeat = (x: number, y: number, w: number, h: number, name: string, isMine: boolean, key: string) => (
    <g key={key} data-my-seat={isMine ? 'true' : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={4}
        className={isMine ? 'fill-primary stroke-primary' : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
        strokeWidth={isMine ? 2.5 : 1}
      />
      {isMine && (
        <circle cx={x + w / 2} cy={y - 6} r={4} className="fill-primary">
          <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}
      {name && (
        <text x={x + w / 2} y={y + h / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          className={`${name.length >= 4 ? 'text-[6px]' : 'text-[8px]'} ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
          {name}
        </text>
      )}
    </g>
  );

  const seatStartX = tableX + 10;

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的座位在 <strong>{myPos.label}</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary/50 inline-block" style={{ borderTop: '2px dashed' }} /> 导航路径</span>
      </div>

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-hidden pb-4">
        <div ref={pinchRef} style={transformStyle} className="touch-none">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans w-full max-w-[560px]" style={{ minWidth: Math.min(svgW, 320) }}>
          {/* Navigation path */}
          <path d={pathD} fill="none" className="stroke-primary/50" strokeWidth={2.5}
            strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" repeatCount="indefinite" />
          </path>

          {/* Door marker */}
          <g>
            <circle cx={doorX} cy={doorY} r={12} className="fill-accent stroke-accent-foreground/30" strokeWidth={1.5} />
            <text x={doorX} y={doorY + 1} textAnchor="middle" dominantBaseline="middle" className="text-[9px] fill-accent-foreground">🚪</text>
          </g>

          {/* Turning points */}
          {navPath.slice(1, -1).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-primary/40 stroke-primary/60" strokeWidth={1} />
          ))}

          {/* Conference table */}
          <rect x={tableX} y={tableY} width={tableW} height={tableH} rx={6}
            className="fill-primary/10 stroke-primary/30" strokeWidth={2} />
          <text x={tableX + tableW / 2} y={tableY + tableH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
            className="fill-primary text-[9px] font-medium">会议桌</text>

          {/* Head seats */}
          {renderSeat(tableX - headSeatW - 4, tableY + (tableH - headSeatH) / 2, headSeatW, headSeatH,
            data.headLeft, myPos.side === 'head-left', 'head-left')}
          {renderSeat(tableX + tableW + 4, tableY + (tableH - headSeatH) / 2, headSeatW, headSeatH,
            data.headRight, myPos.side === 'head-right', 'head-right')}

          {/* Main top seats */}
          {data.top.map((name, i) => {
            const x = seatStartX + i * (seatW + gap);
            const y = tableY - sideGap - seatH;
            const isMine = myPos.side === 'top' && myPos.index === i;
            return renderSeat(x, y, seatW, seatH, name, isMine, `top-${i}`);
          })}

          {/* Main bottom seats */}
          {data.bottom.map((name, i) => {
            const x = seatStartX + i * (seatW + gap);
            const y = tableY + tableH + sideGap;
            const isMine = myPos.side === 'bottom' && myPos.index === i;
            return renderSeat(x, y, seatW, seatH, name, isMine, `bottom-${i}`);
          })}

          {/* Companion top rows */}
          {data.companionTop.map((row, cr) => row.map((name, i) => {
            const x = seatStartX + i * (seatW + gap);
            const y = tableY - sideGap - seatH - (cr + 1) * (seatH + companionGap);
            const isMine = myPos.side === 'companion-top' && myPos.companionRow === cr && myPos.index === i;
            return renderSeat(x, y, seatW, seatH, name, isMine, `ct-${cr}-${i}`);
          }))}

          {/* Companion bottom rows */}
          {data.companionBottom.map((row, cr) => row.map((name, i) => {
            const x = seatStartX + i * (seatW + gap);
            const y = tableY + tableH + sideGap + seatH + (cr + 1) * companionGap + cr * seatH;
            const isMine = myPos.side === 'companion-bottom' && myPos.companionRow === cr && myPos.index === i;
            return renderSeat(x, y, seatW, seatH, name, isMine, `cb-${cr}-${i}`);
          }))}
        </svg>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Navigation className="w-3 h-3 text-primary" />
          从<strong>右侧门</strong>进入，沿虚线路径前行
        </p>
        <p>🪑 到达 <strong>{myPos.label}</strong></p>
      </div>
    </>
  );
}
