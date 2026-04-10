import { useMemo } from 'react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
}

interface LabRow {
  rowIndex: number;
  side: 'top' | 'bottom';
  students: string[];
}

export default function ComputerLabCheckinView({ seatData, sceneConfig, studentName }: Props) {
  const labRows = seatData as LabRow[];
  const rowCount = (sceneConfig.rowCount as number) || 5;
  const seatsPerSide = (sceneConfig.seatsPerSide as number) || 8;
  const tableCols = (sceneConfig.tableCols as number) || 1;
  const seatSide = (sceneConfig.seatSide as string) || ((sceneConfig.dualSide as boolean) !== false ? 'both' : 'both');
  const showTop = seatSide === 'top' || seatSide === 'both';
  const showBottom = seatSide === 'bottom' || seatSide === 'both';

  const myPos = useMemo(() => {
    for (const row of labRows) {
      const idx = row.students.indexOf(studentName);
      if (idx >= 0) return { rowIndex: row.rowIndex, side: row.side, col: idx };
    }
    return null;
  }, [labRows, studentName]);

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  const seatW = 40, seatH = 28, gap = 3;
  const tableW = seatsPerSide * (seatW + gap);
  const colGap = 20;
  const allTableW = tableW * tableCols + colGap * (tableCols - 1);
  const rowH = seatH * 2 + 20 + 16;
  const svgW = allTableW + 60;
  const svgH = rowCount * rowH + 40;
  const totalSeatsPerSide = seatsPerSide * tableCols;
  const tableColIdx = Math.floor(myPos.col / seatsPerSide);
  const seatContainerRef = useAutoCenterMySeat([studentName, myPos.rowIndex, myPos.side, myPos.col]);

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的位置在 <strong>第{myPos.rowIndex + 1}排 · {tableCols > 1 ? `第${tableColIdx + 1}桌 · ` : ''}{myPos.side === 'top' ? '上方' : '下方'} · 第{(myPos.col % seatsPerSide) + 1}位</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
      </div>

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-auto pb-4">
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans">
          {Array.from({ length: rowCount }).map((_, ri) => {
            const baseY = 20 + ri * rowH;
            const topRow = labRows.find(r => r.rowIndex === ri && r.side === 'top');
            const bottomRow = labRows.find(r => r.rowIndex === ri && r.side === 'bottom');

            return (
              <g key={ri}>
                <text x={12} y={baseY + seatH + 10} textAnchor="middle" dominantBaseline="middle"
                  className="fill-muted-foreground text-[9px]">{ri + 1}排</text>

                {Array.from({ length: tableCols }).map((_, tci) => {
                  const tblX = 30 + tci * (tableW + colGap);
                  const seatOffset = tci * seatsPerSide;
                  return (
                    <g key={`tc-${tci}`}>
                      <rect x={tblX} y={baseY + seatH + 4} width={tableW} height={12} rx={3}
                        className="fill-primary/10 stroke-primary/20" strokeWidth={1} />

                      {showTop && Array.from({ length: seatsPerSide }).map((_, ci) => {
                        const x = tblX + ci * (seatW + gap);
                        const y = baseY;
                        const globalCol = seatOffset + ci;
                        const name = topRow?.students[globalCol] || '';
                        const isMine = myPos.rowIndex === ri && myPos.side === 'top' && myPos.col === globalCol;
                        return (
                          <g key={`t-${globalCol}`} data-my-seat={isMine ? 'true' : undefined}>
                            <rect x={x} y={y} width={seatW} height={seatH} rx={4}
                              className={isMine ? 'fill-primary stroke-primary' : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                              strokeWidth={isMine ? 2.5 : 1}
                            />
                            {name && <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                              className={`${name.length >= 4 ? 'text-[6px]' : 'text-[8px]'} ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
                              {name}
                            </text>}
                          </g>
                        );
                      })}

                      {showBottom && Array.from({ length: seatsPerSide }).map((_, ci) => {
                        const x = tblX + ci * (seatW + gap);
                        const y = baseY + seatH + 20;
                        const globalCol = seatOffset + ci;
                        const name = bottomRow?.students[globalCol] || '';
                        const isMine = myPos.rowIndex === ri && myPos.side === 'bottom' && myPos.col === globalCol;
                        return (
                          <g key={`b-${globalCol}`} data-my-seat={isMine ? 'true' : undefined}>
                            <rect x={x} y={y} width={seatW} height={seatH} rx={4}
                              className={isMine ? 'fill-primary stroke-primary' : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                              strokeWidth={isMine ? 2.5 : 1}
                            />
                            {name && <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                              className={`${name.length >= 4 ? 'text-[6px]' : 'text-[8px]'} ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
                              {name}
                            </text>}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>📍 走到第 <strong>{myPos.rowIndex + 1}</strong> 排{tableCols > 1 ? `第 ${tableColIdx + 1} 桌` : '长桌'}</p>
        <p>🪑 坐在{myPos.side === 'top' ? '上' : '下'}侧，从左数第 <strong>{(myPos.col % seatsPerSide) + 1}</strong> 个位置</p>
      </div>
    </>
  );
}
