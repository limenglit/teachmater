import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { usePinchZoom } from './usePinchZoom';

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

type DoorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Compute a navigation path from the door to the student's seat.
 * The path walks along the aisle (left or right edge), then turns into the correct row.
 */
function computeNavPath(
  doorPos: DoorPosition,
  myRow: number,
  mySide: 'top' | 'bottom',
  myCol: number,
  rowCount: number,
  seatsPerSide: number,
  tableCols: number,
  seatW: number,
  seatH: number,
  gap: number,
  colGap: number,
  tableW: number,
  svgPadLeft: number,
  rowH: number,
): { x: number; y: number }[] {
  const tableColIdx = Math.floor(myCol / seatsPerSide);
  const localCol = myCol % seatsPerSide;

  // Seat center position
  const tblX = svgPadLeft + tableColIdx * (tableW + colGap);
  const seatCenterX = tblX + localCol * (seatW + gap) + seatW / 2;
  const baseY = 20 + myRow * rowH;
  const seatCenterY = mySide === 'top'
    ? baseY + seatH / 2
    : baseY + seatH + 20 + seatH / 2;

  const allTableW = tableW * tableCols + colGap * (tableCols - 1);
  const aisleLeft = svgPadLeft - 16;
  const aisleRight = svgPadLeft + allTableW + 16;

  const doorOnTop = doorPos.startsWith('top');
  const doorOnLeft = doorPos.endsWith('left');

  const aisleX = doorOnLeft ? aisleLeft : aisleRight;
  const doorY = doorOnTop ? 8 : 20 + (rowCount - 1) * rowH + seatH + 20 + seatH + 8;

  // Build path: door → walk along aisle to correct row → turn into seat
  const rowAisleY = baseY + seatH + 10; // center of the table bar area (aisle Y for this row)
  const points: { x: number; y: number }[] = [
    { x: aisleX, y: doorY },       // door
    { x: aisleX, y: rowAisleY },   // walk along aisle to row
    { x: seatCenterX, y: rowAisleY }, // turn into row
    { x: seatCenterX, y: seatCenterY }, // arrive at seat
  ];

  return points;
}

export default function ComputerLabCheckinView({ seatData, sceneConfig, studentName }: Props) {
  const labRows = seatData as LabRow[];
  const rowCount = (sceneConfig.rowCount as number) || 5;
  const seatsPerSide = (sceneConfig.seatsPerSide as number) || 8;
  const tableCols = (sceneConfig.tableCols as number) || 1;
  const seatSide = (sceneConfig.seatSide as string) || ((sceneConfig.dualSide as boolean) !== false ? 'both' : 'both');
  const doorPosition = (sceneConfig.doorPosition as DoorPosition) || 'bottom-right';
  const showTop = seatSide === 'top' || seatSide === 'both';
  const showBottom = seatSide === 'bottom' || seatSide === 'both';

  const myPos = useMemo(() => {
    for (const row of labRows) {
      const idx = row.students.indexOf(studentName);
      if (idx >= 0) return { rowIndex: row.rowIndex, side: row.side, col: idx };
    }
    return null;
  }, [labRows, studentName]);

  const seatW = 40, seatH = 28, gap = 3;
  const tableW = seatsPerSide * (seatW + gap);
  const colGap = 20;
  const allTableW = tableW * tableCols + colGap * (tableCols - 1);
  const rowH = seatH * 2 + 20 + 16;
  const svgPadLeft = 30;
  const svgW = allTableW + 60;
  const svgH = rowCount * rowH + 40;
  const tableColIdx = myPos ? Math.floor(myPos.col / seatsPerSide) : 0;
  const seatContainerRef = useAutoCenterMySeat([studentName, myPos?.rowIndex, myPos?.side, myPos?.col]);
  const { containerRef: pinchRef, transformStyle } = usePinchZoom();

  const navPath = useMemo(() => {
    if (!myPos) return [];
    return computeNavPath(
      doorPosition, myPos.rowIndex, myPos.side, myPos.col,
      rowCount, seatsPerSide, tableCols,
      seatW, seatH, gap, colGap, tableW, svgPadLeft, rowH,
    );
  }, [doorPosition, myPos, rowCount, seatsPerSide, tableCols, seatW, seatH, gap, colGap, tableW, svgPadLeft, rowH]);

  const pathD = navPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  // Navigation text directions
  const doorOnTop = doorPosition.startsWith('top');
  const doorOnLeft = doorPosition.endsWith('left');
  const doorLabel = `${doorOnTop ? '前' : '后'}门（${doorOnLeft ? '左侧' : '右侧'}）`;
  const walkDir = doorOnTop
    ? (myPos.rowIndex > 0 ? '向下' : '')
    : (myPos.rowIndex < rowCount - 1 ? '向上' : '');

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的位置在 <strong>第{myPos.rowIndex + 1}排 · {tableCols > 1 ? `第${tableColIdx + 1}桌 · ` : ''}{myPos.side === 'top' ? '上方' : '下方'} · 第{(myPos.col % seatsPerSide) + 1}位</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary/50 inline-block" style={{ borderTop: '2px dashed' }} /> 导航路径</span>
      </div>
      <p className="text-[11px] text-muted-foreground/70 text-center sm:hidden">双指缩放查看细节，双击恢复</p>

      <div ref={seatContainerRef} className="seat-checkin-surface flex justify-center overflow-hidden pb-4">
        <div ref={pinchRef} style={transformStyle} className="touch-none">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans w-full max-w-[600px]" style={{ minWidth: Math.min(svgW, 320) }}>
          {/* Navigation path */}
          <path d={pathD} fill="none" className="stroke-primary/50" strokeWidth={2.5}
            strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" repeatCount="indefinite" />
          </path>

          {/* Door marker */}
          <g>
            <circle cx={navPath[0].x} cy={navPath[0].y} r={10} className="fill-accent stroke-accent-foreground/30" strokeWidth={1.5} />
            <text x={navPath[0].x} y={navPath[0].y + 1} textAnchor="middle" dominantBaseline="middle" className="text-[8px] fill-accent-foreground">🚪</text>
          </g>

          {/* Turning points */}
          {navPath.slice(1, -1).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-primary/40 stroke-primary/60" strokeWidth={1} />
          ))}

          {/* Rows */}
          {Array.from({ length: rowCount }).map((_, ri) => {
            const baseY = 20 + ri * rowH;
            const topRow = labRows.find(r => r.rowIndex === ri && r.side === 'top');
            const bottomRow = labRows.find(r => r.rowIndex === ri && r.side === 'bottom');

            return (
              <g key={ri}>
                <text x={12} y={baseY + seatH + 10} textAnchor="middle" dominantBaseline="middle"
                  className="fill-muted-foreground text-[9px]">{ri + 1}排</text>

                {Array.from({ length: tableCols }).map((_, tci) => {
                  const tblX = svgPadLeft + tci * (tableW + colGap);
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
                            {isMine && (
                              <circle cx={x + seatW / 2} cy={y - 6} r={4} className="fill-primary">
                                <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
                              </circle>
                            )}
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
                            {isMine && (
                              <circle cx={x + seatW / 2} cy={y + seatH + 6} r={4} className="fill-primary">
                                <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
                              </circle>
                            )}
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
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Navigation className="w-3 h-3 text-primary" />
          从<strong>{doorLabel}</strong>进入
          {walkDir && <>，沿{doorOnLeft ? '左' : '右'}侧走廊{walkDir}走到<strong>第 {myPos.rowIndex + 1} 排</strong></>}
        </p>
        <p>🪑 {doorOnLeft ? '向右' : '向左'}转入{tableCols > 1 ? `第 ${tableColIdx + 1} 桌` : '长桌'}，坐在{myPos.side === 'top' ? '上' : '下'}侧从左数第 <strong>{(myPos.col % seatsPerSide) + 1}</strong> 个位置</p>
      </div>
    </>
  );
}
