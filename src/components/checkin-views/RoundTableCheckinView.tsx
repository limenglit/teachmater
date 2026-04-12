import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePinchZoom } from './usePinchZoom';

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
  const gridRef = useRef<HTMLDivElement>(null);
  const [pathSvgData, setPathSvgData] = useState<{ w: number; h: number; d: string } | null>(null);

  const myPos = useMemo(() => {
    for (let t = 0; t < tables.length; t++) {
      for (let s = 0; s < tables[t].length; s++) {
        if (tables[t][s] === studentName) return { table: t, seat: s };
      }
    }
    return null;
  }, [tables, studentName]);

  // 支持自定义门口数组 entryDoors: [{row, col, label}]
  type EntryDoor = { row: number; col: number; label: string };
  let entryDoors: EntryDoor[] = [];
  if (Array.isArray(sceneConfig.entryDoors) && sceneConfig.entryDoors.length > 0) {
    entryDoors = (sceneConfig.entryDoors as EntryDoor[]).map(d => ({
      row: typeof d.row === 'number' ? d.row : 0,
      col: typeof d.col === 'number' ? d.col : 0,
      label: d.label || '门口',
    }));
  } else {
    const entryDoorPosition = (sceneConfig.entryDoorPosition as string) || 'top';
    let entryDoorLabel = '门口';
    let entryDoorRow = 0;
    let entryDoorCol = 0;
    if (entryDoorPosition === 'top') {
      entryDoorRow = 0;
      entryDoorCol = Math.floor(tableCols / 2);
      entryDoorLabel = '前门';
    } else if (entryDoorPosition === 'bottom') {
      entryDoorRow = Math.ceil(tables.length / tableCols) - 1;
      entryDoorCol = Math.floor(tableCols / 2);
      entryDoorLabel = '后门';
    } else if (entryDoorPosition === 'left') {
      entryDoorRow = Math.floor(tables.length / 2 / tableCols);
      entryDoorCol = 0;
      entryDoorLabel = '左门';
    } else if (entryDoorPosition === 'right') {
      entryDoorRow = Math.floor(tables.length / 2 / tableCols);
      entryDoorCol = tableCols - 1;
      entryDoorLabel = '右门';
    } else if (entryDoorPosition === 'center') {
      entryDoorRow = Math.floor((tables.length / tableCols) / 2);
      entryDoorCol = Math.floor(tableCols / 2);
      entryDoorLabel = '门口';
    }
    entryDoors = [{ row: entryDoorRow, col: entryDoorCol, label: entryDoorLabel }];
  }

  // 计算我的桌子在 grid 的位置
  const tableRow = myPos ? Math.floor(myPos.table / tableCols) : 0;
  const tableCol = myPos ? myPos.table % tableCols : 0;

  // 计算所有门到我的桌子的曼哈顿距离，选择最近的门
  const doorDistances = entryDoors.map(door => ({
    ...door,
    distance: Math.abs(tableRow - door.row) + Math.abs(tableCol - door.col)
  }));
  const sortedDoors = [...doorDistances].sort((a, b) => a.distance - b.distance);
  const nearestDoor = sortedDoors[0];
  const minDistance = nearestDoor?.distance ?? 0;

  // 路径：门口到桌的曼哈顿路径（含终点桌）
  const pathCells: Array<{ row: number; col: number }> = [];
  if (nearestDoor && myPos) {
    let r = nearestDoor.row;
    let c = nearestDoor.col;
    pathCells.push({ row: r, col: c });
    while (r !== tableRow || c !== tableCol) {
      if (r < tableRow) r++;
      else if (r > tableRow) r--;
      else if (c < tableCol) c++;
      else if (c > tableCol) c--;
      pathCells.push({ row: r, col: c });
    }
  }

  const label = sceneType === 'banquet' ? '宴会厅' : '智能教室';
  const seatContainerRef = useAutoCenterMySeat([studentName, myPos?.table, myPos?.seat]);
  const { containerRef: pinchRef, transformStyle } = usePinchZoom();
  const svgSize = isMobile ? 120 : 160;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const tableRadius = isMobile ? 24 : 34;
  const seatOrbitRadius = isMobile ? 38 : 50;
  const seatRadius = isMobile ? 11 : 15;

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

  // Compute SVG overlay path after layout
  const computeOverlayPath = useCallback(() => {
    const grid = gridRef.current;
    if (!grid || pathCells.length < 2 || !myPos) return;

    const gridRect = grid.getBoundingClientRect();
    const children = Array.from(grid.children) as HTMLElement[];

    const getCellCenter = (row: number, col: number) => {
      const idx = row * tableCols + col;
      const el = children[idx];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - gridRect.left + grid.scrollLeft,
        y: r.top + r.height / 2 - gridRect.top + grid.scrollTop,
      };
    };

    const points = pathCells.map(c => getCellCenter(c.row, c.col)).filter(Boolean) as { x: number; y: number }[];
    if (points.length < 2) return;

    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    setPathSvgData({
      w: grid.scrollWidth,
      h: grid.scrollHeight,
      d,
    });
  }, [pathCells, tableCols, myPos]);

  useEffect(() => {
    const timer = setTimeout(computeOverlayPath, 150);
    return () => clearTimeout(timer);
  }, [computeOverlayPath]);

  if (!myPos) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  // Navigation direction text
  const getNavDirections = () => {
    if (!nearestDoor) return '';
    const rowDiff = tableRow - nearestDoor.row;
    const colDiff = tableCol - nearestDoor.col;
    const parts: string[] = [];
    if (rowDiff > 0) parts.push(`向下走${rowDiff}排`);
    else if (rowDiff < 0) parts.push(`向上走${Math.abs(rowDiff)}排`);
    if (colDiff > 0) parts.push(`向右走${colDiff}列`);
    else if (colDiff < 0) parts.push(`向左走${Math.abs(colDiff)}列`);
    return parts.join('，然后');
  };

  return (
    <>
      <p className="text-sm text-muted-foreground text-center leading-relaxed px-2">
        {studentName}，你的位置在 <strong>第{myPos.table + 1}桌 · 第{myPos.seat + 1}号座</strong>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary/20 border border-primary/40 inline-block" /> 你的桌子</span>
        {entryDoors.map((d, idx) => (
          <span key={idx} className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-green-400/60 border border-green-600/30 inline-block" /> {d.label}</span>
        ))}
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary/50 inline-block" style={{ borderTop: '2px dashed' }} /> 导航路径</span>
      </div>

      <div className="text-center text-xs text-muted-foreground mb-2">
        <div className="inline-block bg-primary/10 text-primary px-4 py-1 rounded-lg text-xs font-medium border border-primary/20 mb-3">
          {label}
        </div>
        {isMobile && (
          <p className="text-[11px] text-muted-foreground/90">双击你的桌子可放大，再次双击恢复</p>
        )}
      </div>

      <div className="text-center text-xs text-primary font-medium mb-2 flex items-center justify-center gap-1">
        <Navigation className="w-3 h-3" />
        <span>从<strong>{nearestDoor.label}</strong>出发，{getNavDirections()}到第 <strong>{myPos.table + 1}</strong> 桌</span>
      </div>

      <div ref={seatContainerRef} className="seat-checkin-surface -mx-2 px-2 flex justify-start sm:justify-center overflow-hidden pb-4">
        <div ref={pinchRef} style={transformStyle} className="relative touch-none">
          {/* SVG overlay for animated path */}
          {pathSvgData && (
            <svg
              width={pathSvgData.w}
              height={pathSvgData.h}
              className="absolute inset-0 pointer-events-none z-10"
              style={{ overflow: 'visible' }}
            >
              <path d={pathSvgData.d} fill="none" className="stroke-primary/60" strokeWidth={3}
                strokeDasharray="8 5" strokeLinecap="round" strokeLinejoin="round">
                <animate attributeName="stroke-dashoffset" from="26" to="0" dur="1.5s" repeatCount="indefinite" />
              </path>
            </svg>
          )}

          <div ref={gridRef} className="inline-grid w-max gap-1 sm:gap-4" style={{ gridTemplateColumns: `repeat(${tableCols}, max-content)` }}>
            {tables.map((people, ti) => {
              const isMyTable = ti === myPos.table;
              const isZoomedMyTable = isMyTable && zoomMyTable;
              const thisRow = Math.floor(ti / tableCols);
              const thisCol = ti % tableCols;
              const isEntryDoor = entryDoors.some(d => d.row === thisRow && d.col === thisCol);
              const doorLabel = isEntryDoor ? (entryDoors.find(d => d.row === thisRow && d.col === thisCol)?.label || '门口') : '';
              const isPathCell = pathCells.some(cell => cell.row === thisRow && cell.col === thisCol);
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
                  } ${
                    isEntryDoor ? 'border-2 border-green-400 shadow-green-200 shadow' : ''
                  } ${
                    isPathCell && !isMyTable && !isEntryDoor ? 'border-2 border-yellow-400/60 shadow-yellow-200 shadow' : ''
                  }`}
                >
                  <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} className="overflow-visible">
                    <circle cx={cx} cy={cy} r={tableRadius}
                      className={isMyTable ? 'fill-primary/15 stroke-primary/50' : isEntryDoor ? 'fill-green-200/60 stroke-green-600/40' : isPathCell ? 'fill-yellow-200/60 stroke-yellow-600/40' : 'fill-primary/5 stroke-primary/20'}
                      strokeWidth={isMyTable || isEntryDoor || isPathCell ? 2.5 : 1.5}
                    />
                    <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                      className={`text-xs font-medium ${isMyTable ? 'fill-primary' : isEntryDoor ? 'fill-green-700' : isPathCell ? 'fill-yellow-700' : 'fill-muted-foreground'}`}>
                      {isEntryDoor ? doorLabel : `${ti + 1}桌`}
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
                          {isMine && (
                            <circle cx={sx} cy={sy - seatRadius - 4} r={3} className="fill-primary">
                              <animate attributeName="r" values="2;4;2" dur="1.2s" repeatCount="indefinite" />
                            </circle>
                          )}
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
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>📍 找到第 <strong>{myPos.table + 1}</strong> 桌（第{tableRow + 1}行第{tableCol + 1}列位置）</p>
        <p>🪑 坐在第 <strong>{myPos.seat + 1}</strong> 号座位（从顶部12点钟方向顺时针数）</p>
      </div>
    </>
  );
}
