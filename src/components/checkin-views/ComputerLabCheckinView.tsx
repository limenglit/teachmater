import { useMemo } from 'react';

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
  const rowH = seatH * 2 + 20 + 16; // top + table + bottom + spacing
  const svgW = tableW + 60;
  const svgH = rowCount * rowH + 40;

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的位置在 <strong>第{myPos.rowIndex + 1}排 · {myPos.side === 'top' ? '上方' : '下方'} · 第{myPos.col + 1}位</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
      </div>

      <div className="flex justify-center overflow-auto pb-4">
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans">
          {Array.from({ length: rowCount }).map((_, ri) => {
            const baseY = 20 + ri * rowH;
            const tableX = 30;
            const topRow = labRows.find(r => r.rowIndex === ri && r.side === 'top');
            const bottomRow = labRows.find(r => r.rowIndex === ri && r.side === 'bottom');

            return (
              <g key={ri}>
                {/* Table */}
                <rect x={tableX} y={baseY + seatH + 4} width={tableW} height={12} rx={3}
                  className="fill-primary/10 stroke-primary/20" strokeWidth={1} />
                <text x={tableX - 18} y={baseY + seatH + 10} textAnchor="middle" dominantBaseline="middle"
                  className="fill-muted-foreground text-[9px]">{ri + 1}排</text>

                {/* Top seats */}
                {Array.from({ length: seatsPerSide }).map((_, ci) => {
                  const x = tableX + ci * (seatW + gap);
                  const y = baseY;
                  const name = topRow?.students[ci] || '';
                  const isMine = myPos.rowIndex === ri && myPos.side === 'top' && myPos.col === ci;
                  return (
                    <g key={`t-${ci}`}>
                      <rect x={x} y={y} width={seatW} height={seatH} rx={4}
                        className={isMine ? 'fill-primary stroke-primary' : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                        strokeWidth={isMine ? 2.5 : 1}
                      />
                      {name && <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                        className={`text-[8px] ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
                        {name.length > 2 ? name.slice(0, 2) : name}
                      </text>}
                    </g>
                  );
                })}

                {/* Bottom seats */}
                {Array.from({ length: seatsPerSide }).map((_, ci) => {
                  const x = tableX + ci * (seatW + gap);
                  const y = baseY + seatH + 20;
                  const name = bottomRow?.students[ci] || '';
                  const isMine = myPos.rowIndex === ri && myPos.side === 'bottom' && myPos.col === ci;
                  return (
                    <g key={`b-${ci}`}>
                      <rect x={x} y={y} width={seatW} height={seatH} rx={4}
                        className={isMine ? 'fill-primary stroke-primary' : name ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'}
                        strokeWidth={isMine ? 2.5 : 1}
                      />
                      {name && <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                        className={`text-[8px] ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
                        {name.length > 2 ? name.slice(0, 2) : name}
                      </text>}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>📍 走到第 <strong>{myPos.rowIndex + 1}</strong> 排长桌</p>
        <p>🪑 坐在{myPos.side === 'top' ? '上' : '下'}侧，从左数第 <strong>{myPos.col + 1}</strong> 个位置</p>
      </div>
    </>
  );
}
