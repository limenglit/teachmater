import { useMemo, useRef, useState } from 'react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const [zoomMyTable, setZoomMyTable] = useState(false);
  const lastTapTsRef = useRef(0);

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
  const seatContainerRef = useAutoCenterMySeat([studentName, myPos.table, myPos.seat]);
  const svgSize = isMobile ? 152 : 160;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const tableRadius = isMobile ? 31 : 34;
  const seatOrbitRadius = isMobile ? 47 : 50;
  const seatRadius = isMobile ? 14 : 15;

  const toggleZoomMyTable = () => {
    if (!isMobile) return;
    setZoomMyTable(prev => !prev);
  };

  const handleMyTableTouchEnd = () => {
    if (!isMobile) return;
    const now = Date.now();
    if (now - lastTapTsRef.current <= 280) {
      toggleZoomMyTable();
      lastTapTsRef.current = 0;
      return;
    }
    lastTapTsRef.current = now;
  };

  return (
    <>
      <p className="text-sm text-muted-foreground text-center leading-relaxed px-2">
        {studentName}，你的位置在 <strong>第{myPos.table + 1}桌 · 第{myPos.seat + 1}号座</strong>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary/20 border border-primary/40 inline-block" /> 你的桌子</span>
      </div>

      <div className="text-center text-xs text-muted-foreground mb-2">
        <div className="inline-block bg-primary/10 text-primary px-4 py-1 rounded-lg text-xs font-medium border border-primary/20 mb-3">
          {label}
        </div>
        {isMobile && (
          <p className="text-[11px] text-muted-foreground/90">双击你的桌子可放大，再次双击恢复</p>
        )}
      </div>

      <div ref={seatContainerRef} className="seat-checkin-surface -mx-2 px-2 flex justify-start sm:justify-center overflow-x-auto overflow-y-visible pb-4">
        <div className="inline-grid w-max gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${tableCols}, max-content)` }}>
          {tables.map((people, ti) => {
            const isMyTable = ti === myPos.table;
            const isZoomedMyTable = isMyTable && zoomMyTable;
            return (
              <div
                key={ti}
                onDoubleClick={isMyTable ? toggleZoomMyTable : undefined}
                onTouchEnd={isMyTable ? handleMyTableTouchEnd : undefined}
                className={`flex flex-col items-center transition-all duration-200 ease-out ${
                  isMyTable ? 'ring-2 ring-primary/40 rounded-xl p-1' : ''
                } ${
                  zoomMyTable && !isMyTable ? 'opacity-40 scale-95' : ''
                } ${
                  isZoomedMyTable ? 'z-20 scale-125 sm:scale-110 shadow-xl bg-background/70 rounded-xl' : ''
                }`}
              >
                <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} className="overflow-visible">
                  <circle cx={cx} cy={cy} r={tableRadius}
                    className={isMyTable ? 'fill-primary/15 stroke-primary/50' : 'fill-primary/5 stroke-primary/20'}
                    strokeWidth={isMyTable ? 2.5 : 1.5}
                  />
                  <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                    className={`text-xs font-medium ${isMyTable ? 'fill-primary' : 'fill-muted-foreground'}`}>
                    {ti + 1}桌
                  </text>
                  {Array.from({ length: seatsPerTable }).map((_, si) => {
                    const angle = (2 * Math.PI * si) / seatsPerTable - Math.PI / 2;
                    const sx = cx + seatOrbitRadius * Math.cos(angle);
                    const sy = cy + seatOrbitRadius * Math.sin(angle);
                    const seatName = people[si] || '';
                    const isMine = ti === myPos.table && si === myPos.seat;
                    return (
                      <g key={si} data-my-seat={isMine ? 'true' : undefined}>
                        <circle cx={sx} cy={sy} r={seatRadius}
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
                            textLength={seatName.length >= 5 ? 22 : undefined}
                            lengthAdjust={seatName.length >= 5 ? 'spacingAndGlyphs' : undefined}
                            className={`${seatName.length >= 5 ? 'text-[6.5px]' : seatName.length >= 4 ? 'text-[7px]' : 'text-[9px]'} pointer-events-none ${isMine ? 'fill-primary-foreground font-bold' : 'fill-foreground'}`}>
                            {seatName}
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
