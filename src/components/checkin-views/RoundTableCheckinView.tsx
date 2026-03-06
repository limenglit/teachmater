import { useMemo } from 'react';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
  sceneType: string;
}

export default function RoundTableCheckinView({ seatData, sceneConfig, studentName, sceneType }: Props) {
  const tables = seatData as string[][];
  const seatsPerTable = (sceneConfig.seatsPerTable as number) || tables[0]?.length || 6;
  const tableCols = (sceneConfig.tableCols as number) || Math.ceil(Math.sqrt(tables.length));

  const myPos = useMemo(() => {
    for (let t = 0; t < tables.length; t++) {
      for (let s = 0; s < tables[t].length; s++) {
        if (tables[t][s] === studentName) return { table: t, seat: s };
      }
    }
    return null;
  }, [tables, studentName]);

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  const label = sceneType === 'banquet' ? '宴会厅' : '智能教室';
  const tableRow = Math.floor(myPos.table / tableCols);
  const tableCol = myPos.table % tableCols;

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的位置在 <strong>第{myPos.table + 1}桌 · 第{myPos.seat + 1}号座</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary/20 border border-primary/40 inline-block" /> 你的桌子</span>
      </div>

      <div className="text-center text-xs text-muted-foreground mb-2">
        <div className="inline-block bg-primary/10 text-primary px-4 py-1 rounded-lg text-xs font-medium border border-primary/20 mb-3">
          {label}
        </div>
      </div>

      <div className="flex justify-center overflow-auto pb-4">
        <div className="inline-grid gap-4" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)` }}>
          {tables.map((people, ti) => {
            const isMyTable = ti === myPos.table;
            const radius = 44;
            const seatR = 14;
            const cx = 70, cy = 70;
            return (
              <div key={ti} className={`flex flex-col items-center ${isMyTable ? 'ring-2 ring-primary/40 rounded-xl p-1' : ''}`}>
                <svg width={140} height={140} viewBox="0 0 140 140">
                  <circle cx={cx} cy={cy} r={30}
                    className={isMyTable ? 'fill-primary/15 stroke-primary/50' : 'fill-primary/5 stroke-primary/20'}
                    strokeWidth={isMyTable ? 2.5 : 1.5}
                  />
                  <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                    className={`text-xs font-medium ${isMyTable ? 'fill-primary' : 'fill-muted-foreground'}`}>
                    {ti + 1}桌
                  </text>
                  {Array.from({ length: seatsPerTable }).map((_, si) => {
                    const angle = (2 * Math.PI * si) / seatsPerTable - Math.PI / 2;
                    const sx = cx + radius * Math.cos(angle);
                    const sy = cy + radius * Math.sin(angle);
                    const seatName = people[si] || '';
                    const isMine = ti === myPos.table && si === myPos.seat;
                    return (
                      <g key={si}>
                        <circle cx={sx} cy={sy} r={seatR}
                          className={isMine
                            ? 'fill-primary stroke-primary'
                            : isMyTable && seatName
                              ? 'fill-card stroke-primary/30'
                              : seatName ? 'fill-card stroke-border' : 'fill-muted/30 stroke-border/30'
                          }
                          strokeWidth={isMine ? 2.5 : 1.5}
                        />
                        {seatName && (
                          <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle"
                            className={`text-[10px] pointer-events-none ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
                            {seatName.length > 2 ? seatName.slice(0, 2) : seatName}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>📍 找到第 <strong>{myPos.table + 1}</strong> 桌（第{tableRow + 1}行第{tableCol + 1}列位置）</p>
        <p>🪑 坐在第 <strong>{myPos.seat + 1}</strong> 号座位（从顶部12点钟方向顺时针数）</p>
      </div>
    </>
  );
}
