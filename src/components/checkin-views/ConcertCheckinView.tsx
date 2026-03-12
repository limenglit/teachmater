import { useMemo } from 'react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
}

export default function ConcertCheckinView({ seatData, sceneConfig, studentName }: Props) {
  const rows = seatData as string[][];
  const seatsPerRow = (sceneConfig.seatsPerRow as number) || 12;
  const rowCount = rows.length;

  const myPos = useMemo(() => {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === studentName) return { row: r, col: c };
      }
    }
    return null;
  }, [rows, studentName]);

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  const seatCaps = Array.from({ length: rowCount }, (_, r) => seatsPerRow + r * 2);
  const svgW = 500;
  const svgH = 350;
  const cx = svgW / 2;
  const stageY = 40;
  const startRadius = 70;
  const radiusStep = 40;
  const seatR = 12;
  const seatContainerRef = useAutoCenterMySeat([studentName, myPos.row, myPos.col]);

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的位置在 <strong>第{myPos.row + 1}排 · 第{myPos.col + 1}座</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
      </div>

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-auto pb-4">
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans">
          <rect x={cx - 60} y={stageY - 15} width={120} height={28} rx={8}
            className="fill-primary/15 stroke-primary/30" strokeWidth={2} />
          <text x={cx} y={stageY} textAnchor="middle" dominantBaseline="middle"
            className="fill-primary text-xs font-medium">🎵 舞 台</text>

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
                      ? 'fill-primary stroke-primary'
                      : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                    strokeWidth={isMine ? 2.5 : 1.5}
                  />
                  {name && (
                    <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle"
                      className={`${name.length >= 4 ? 'text-[7px]' : 'text-[9px]'} pointer-events-none ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
                      {name}
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>📍 面向舞台，走到第 <strong>{myPos.row + 1}</strong> 排</p>
        <p>🪑 从左侧数第 <strong>{myPos.col + 1}</strong> 个座位就是你的位置</p>
      </div>
    </>
  );
}
