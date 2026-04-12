import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { usePinchZoom } from './usePinchZoom';

type EntryDoor = { side: 'front' | 'back'; label: string };
type Window = { side: 'left' | 'right'; label: string };

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
}

export default function ConcertCheckinView({ seatData, sceneConfig, studentName }: Props) {
  const rows = seatData as string[][];
  const seatsPerRow = (sceneConfig.seatsPerRow as number) || 12;
  const rowCount = rows.length;

  // 门窗布局
  const entryDoors: EntryDoor[] = useMemo(() => {
    if (Array.isArray(sceneConfig.entryDoorSides)) {
      return (sceneConfig.entryDoorSides as string[]).map(side => ({
        side: side === 'back' ? 'back' : 'front',
        label: side === 'back' ? '后门' : '前门',
      }));
    }
    const mode = sceneConfig.entryDoorMode as string || 'front';
    if (mode === 'both') return [
      { side: 'front', label: '前门' },
      { side: 'back', label: '后门' },
    ];
    if (mode === 'back') return [{ side: 'back', label: '后门' }];
    return [{ side: 'front', label: '前门' }];
  }, [sceneConfig]);

  const window: Window = useMemo(() => {
    const doorSides = entryDoors.map(d => d.side);
    if (doorSides.includes('front')) return { side: 'right', label: '窗户' };
    return { side: 'left', label: '窗户' };
  }, [entryDoors]);

  // 查找我的座位
  const myPos = useMemo(() => {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === studentName) return { row: r, col: c };
      }
    }
    return null;
  }, [rows, studentName]);

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  // 座位布局参数
  const seatCaps = Array.from({ length: rowCount }, (_, r) => seatsPerRow + r * 2);
  const svgW = 540;
  const svgH = 400;
  const cx = svgW / 2;
  const stageY = 48;
  const startRadius = 80;
  const radiusStep = 44;
  const seatR = 15;
  const seatContainerRef = useAutoCenterMySeat([studentName, myPos.row, myPos.col]);
  const { containerRef: pinchRef, transformStyle } = usePinchZoom();

  // 门窗坐标
  const doorPos = (side: EntryDoor['side']) => {
    if (side === 'front') return { x: cx, y: stageY - 60 };
    return { x: cx, y: svgH - 30 };
  };
  const windowPos = window.side === 'left'
    ? { x: 40, y: svgH / 2 + 30 }
    : { x: svgW - 40, y: svgH / 2 + 30 };

  // 我的座位坐标
  const mySeatPolar = (() => {
    const r = startRadius + myPos.row * radiusStep;
    const seatCount = seatCaps[myPos.row];
    const totalAngle = Math.min(Math.PI * 0.85, Math.PI * (0.5 + myPos.row * 0.05));
    const startAngle = Math.PI - (Math.PI - totalAngle) / 2;
    const endAngle = (Math.PI - totalAngle) / 2;
    const frac = seatCount <= 1 ? 0.5 : myPos.col / (seatCount - 1);
    const angle = startAngle - frac * (startAngle - endAngle);
    return { r, angle };
  })();
  const mySeatPos = {
    x: cx + mySeatPolar.r * Math.cos(mySeatPolar.angle),
    y: stageY + 15 + mySeatPolar.r * Math.sin(mySeatPolar.angle),
  };

  // 路径：选最近的门口
  const nearestDoor = entryDoors[0];
  const nearestDoorPos = doorPos(nearestDoor.side);
  // 路径为直线
  const pathPoints = [
    { ...nearestDoorPos },
    { x: mySeatPos.x, y: nearestDoorPos.y },
    { ...mySeatPos },
  ];

  // 姓名显示自适应
  const getTextFontSize = (name: string) => {
    if (name.length >= 6) return '7px';
    if (name.length >= 4) return '9px';
    return '11px';
  };

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的位置在 <strong>第{myPos.row + 1}排 · 第{myPos.col + 1}座</strong>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        {entryDoors.map((d, idx) => (
          <span key={idx} className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-accent border border-accent-foreground/20 inline-block" /> {d.label}</span>
        ))}
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary/50 inline-block" style={{ borderTop: '2px dashed' }} /> 导航路径</span>
      </div>

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-hidden pb-4">
        <div ref={pinchRef} style={transformStyle} className="touch-none">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans w-full max-w-[560px]" style={{ minWidth: Math.min(svgW, 320) }}>
          {/* Door markers */}
          {entryDoors.map((d) => {
            const pos = doorPos(d.side);
            return (
              <g key={d.side}>
                <circle cx={pos.x} cy={pos.y} r={14} className="fill-accent stroke-accent-foreground/30" strokeWidth={1.5} />
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" className="text-[9px] fill-accent-foreground">🚪</text>
                <text x={pos.x} y={pos.y + 22} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[9px]">{d.label}</text>
              </g>
            );
          })}

          {/* Animated navigation path */}
          <polyline points={pathPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none"
            className="stroke-primary/50" strokeWidth={3} strokeDasharray="8 5" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-dashoffset" from="26" to="0" dur="1.5s" repeatCount="indefinite" />
          </polyline>

          {/* Turning points */}
          {pathPoints.slice(1, -1).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-primary/40 stroke-primary/60" strokeWidth={1} />
          ))}

          {/* Stage */}
          <rect x={cx - 60} y={stageY - 15} width={120} height={28} rx={8}
            className="fill-primary/15 stroke-primary/30" strokeWidth={2} />
          <text x={cx} y={stageY} textAnchor="middle" dominantBaseline="middle"
            className="fill-primary text-base font-semibold">🎵 舞 台</text>

          {/* Semicircular seats */}
          {rows.map((row, ri) => {
            const r = startRadius + ri * radiusStep;
            const seatCount = seatCaps[ri];
            const totalAngle = Math.min(Math.PI * 0.85, Math.PI * (0.5 + ri * 0.05));
            const startAngle = Math.PI - (Math.PI - totalAngle) / 2;
            const endAngle = (Math.PI - totalAngle) / 2;

            return row.map((name, ci) => {
              const frac = seatCount <= 1 ? 0.5 : ci / (seatCount - 1);
              const angle = startAngle - frac * (startAngle - endAngle);
              const sx = cx + r * Math.cos(angle);
              const sy = stageY + 15 + r * Math.sin(angle);
              const isMine = ri === myPos.row && ci === myPos.col;
              return (
                <g key={`${ri}-${ci}`} data-my-seat={isMine ? 'true' : undefined}>
                  <circle cx={sx} cy={sy} r={seatR}
                    className={isMine
                      ? 'fill-primary stroke-primary shadow-lg'
                      : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                    strokeWidth={isMine ? 2.5 : 1.5}
                    filter={isMine ? 'drop-shadow(0 2px 8px #38bdf8aa)' : undefined}
                  />
                  {isMine && (
                    <circle cx={sx} cy={sy - seatR - 5} r={3} className="fill-primary">
                      <animate attributeName="r" values="2;4;2" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {name && (
                    <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={getTextFontSize(name)}
                      textLength={name.length > 4 ? seatR * 2.2 : undefined}
                      lengthAdjust={name.length > 4 ? 'spacingAndGlyphs' : undefined}
                      className={`pointer-events-none ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
                      {name.length > 8 ? name.slice(0, 7) + '…' : name}
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Navigation className="w-3 h-3 text-primary" />
          从<strong>{nearestDoor.label}</strong>进入，沿虚线路径前行
        </p>
        <p>📍 面向舞台，走到第 <strong>{myPos.row + 1}</strong> 排</p>
        <p>🪑 从左侧数第 <strong>{myPos.col + 1}</strong> 个座位就是你的位置</p>
      </div>
    </>
  );
}
