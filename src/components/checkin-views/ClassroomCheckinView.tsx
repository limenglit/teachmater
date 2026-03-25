import { useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { useAutoCenterMySeat } from './useAutoCenterMySeat';

interface Props {
  seatData: unknown;
  sceneConfig: Record<string, unknown>;
  studentName: string;
}

export default function ClassroomCheckinView({ seatData, sceneConfig, studentName }: Props) {
  const seats = seatData as (string | null)[][];
  const config = sceneConfig as {
    rows: number; cols: number; windowOnLeft: boolean;
    colAisles: number[]; rowAisles: number[];
    entryDoorMode?: 'front' | 'back' | 'both';
    frontDoorPosition?: 'top' | 'bottom' | 'left' | 'right';
    backDoorPosition?: 'top' | 'bottom' | 'left' | 'right';
  };

  const myPosition = useMemo(() => {
    for (let r = 0; r < seats.length; r++) {
      for (let c = 0; c < seats[r].length; c++) {
        if (seats[r][c] === studentName) return { r, c };
      }
    }
    return null;
  }, [seats, studentName]);

  const rows = config.rows || seats.length;
  const cols = config.cols || (seats[0]?.length ?? 8);
  const colAisles = config.colAisles || [];
  const rowAisles = config.rowAisles || [];
  // 支持 entryDoorMode: 'front' | 'back' | 'both'
  // 默认前门在上方（row 0），后门在下方（row rows-1）
  let entryDoors: Array<{ row: number; col: number; label: string }> = [];
  const entryDoorMode = config.entryDoorMode || 'front';
  // 仅支持左右门时 col，前后门时 row
  if (entryDoorMode === 'front') {
    entryDoors = [{ row: 0, col: config.windowOnLeft ? cols - 1 : 0, label: '前门' }];
  } else if (entryDoorMode === 'back') {
    entryDoors = [{ row: rows - 1, col: config.windowOnLeft ? cols - 1 : 0, label: '后门' }];
  } else if (entryDoorMode === 'both') {
    entryDoors = [
      { row: 0, col: config.windowOnLeft ? cols - 1 : 0, label: '前门' },
      { row: rows - 1, col: config.windowOnLeft ? cols - 1 : 0, label: '后门' },
    ];
  }

  // 计算所有门到目标座位的最短路径，选择最近的门
  const pathCells = useMemo(() => {
    if (!myPosition || entryDoors.length === 0) return [];
    const keyOf = (r: number, c: number) => `${r}-${c}`;
    const directions = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];
    let shortestPath: Array<{ r: number; c: number }> = [];
    let minLen = Infinity;
    for (const door of entryDoors) {
      const visited = new Set<string>();
      const prev = new Map<string, { r: number; c: number }>();
      const queue: Array<{ r: number; c: number }> = [{ r: door.row, c: door.col }];
      visited.add(keyOf(door.row, door.col));
      let found = false;
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;
        if (current.r === myPosition.r && current.c === myPosition.c) { found = true; break; }
        for (const { dr, dc } of directions) {
          const nr = current.r + dr;
          const nc = current.c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const key = keyOf(nr, nc);
          if (visited.has(key)) continue;
          visited.add(key);
          prev.set(key, current);
          queue.push({ r: nr, c: nc });
        }
      }
      const endKey = keyOf(myPosition.r, myPosition.c);
      if (!visited.has(endKey)) continue;
      // 回溯路径
      const path: Array<{ r: number; c: number }> = [];
      let node: { r: number; c: number } | undefined = myPosition;
      while (node) {
        path.push(node);
        const parent = prev.get(keyOf(node.r, node.c));
        node = parent;
      }
      path.reverse();
      if (path.length < minLen) {
        minLen = path.length;
        shortestPath = path;
      }
    }
    return shortestPath.length > 0 ? shortestPath : [myPosition];
  }, [cols, rows, myPosition, entryDoors]);

  if (!myPosition) return <p className="text-center text-muted-foreground">未找到您的座位</p>;

  const totalVisualCols = cols + colAisles.length;
  const realToVisualCol = (realCol: number) => {
    let offset = 0;
    for (const a of colAisles) { if (realCol > a) offset++; }
    return realCol + offset;
  };
  const getVisualRow = (realRow: number) => {
    let offset = 0;
    for (const a of rowAisles) { if (realRow > a) offset++; }
    return realRow + offset;
  };
  const isOnPath = (r: number, c: number) => pathCells.some(p => p.r === r && p.c === c);
  const isMyPos = (r: number, c: number) => myPosition.r === r && myPosition.c === c;
  const seatContainerRef = useAutoCenterMySeat([studentName, myPosition?.r, myPosition?.c]);
  // 找到实际入口门
  const entryDoor = pathCells.length > 0 ? entryDoors.find(d => d.row === pathCells[0].r && d.col === pathCells[0].c) : entryDoors[0];

  return (
    <>
      <p className="text-sm text-muted-foreground text-center">
        {studentName}，你的座位在 <strong>第{myPosition.r + 1}排 第{myPosition.c + 1}列</strong>
      </p>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-primary/30 border border-primary/50 inline-block" /> 路径</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm">{config.windowOnLeft
          ? <span className="inline-flex items-center justify-center w-6 h-6 border border-primary/40 rounded bg-primary/10 text-xs text-primary">窗</span>
          : <span className="text-base">🚪</span>}</span>
        <div className="bg-primary/10 text-primary px-6 py-1.5 rounded-lg text-xs font-medium border border-primary/20">🏫 讲 台</div>
        <span className="text-sm">{config.windowOnLeft
          ? <span className="text-base">🚪</span>
          : <span className="inline-flex items-center justify-center w-6 h-6 border border-primary/40 rounded bg-primary/10 text-xs text-primary">窗</span>}</span>
      </div>
      <div ref={seatContainerRef} className="seat-checkin-surface overflow-auto pb-4 rounded-lg border border-border/60 bg-muted/20">
        <div className="inline-grid gap-1 min-w-max min-h-max shrink-0 p-2" style={{
          gridTemplateColumns: `repeat(${totalVisualCols + 2}, 2.5rem)`,
          gridTemplateRows: `repeat(${rows + 2}, 2.5rem)`,
        }}>
          {/* 渲染虚拟走道（四周）和走道格子 */}
          {Array.from({ length: rows + 2 }).flatMap((_, ri) =>
            Array.from({ length: cols + 2 }).map((_, ci) => {
              // 虚拟走道区域
              const isVirtualAisle = ri === 0 || ri === rows + 1 || ci === 0 || ci === cols + 1;
              // 真实座位区
              const realRow = ri - 1;
              const realCol = ci - 1;
              // 走道列/行
              const isColAisle = !isVirtualAisle && colAisles.includes(realCol);
              const isRowAisle = !isVirtualAisle && rowAisles.includes(realRow);
              // 渲染座位
              if (!isVirtualAisle && !isColAisle && !isRowAisle) {
                const seatName = seats[realRow]?.[realCol] ?? null;
                const isMine = isMyPos(realRow, realCol);
                const onPath = isOnPath(realRow, realCol) && !isMine;
                const isDoor = entryDoors.some(d => d.row === realRow && d.col === realCol);
                return (
                  <div key={`seat-${realRow}-${realCol}`} style={{
                    gridRow: ri + 1,
                    gridColumn: ci + 1,
                  }} data-my-seat={isMine ? 'true' : undefined} className={`w-10 h-8 rounded text-xs flex items-center justify-center border transition-all ${
                    isMine ? 'bg-primary text-primary-foreground border-primary font-bold shadow-lg scale-110 z-10 ring-2 ring-primary/40'
                    : onPath ? 'bg-primary/20 border-primary/40 text-primary/80'
                    : isDoor ? 'bg-accent border-accent-foreground/20 text-accent-foreground'
                    : seatName ? 'bg-card border-border text-foreground/60'
                    : 'bg-muted/30 border-dashed border-border/50 text-muted-foreground/40'
                  }`}>
                    {isDoor && !isMine ? <Navigation className="w-3 h-3" />
                      : <span className={`${isMine ? 'text-[10px] sm:text-xs font-bold' : 'text-[9px] sm:text-[10px]'} px-0.5 leading-tight whitespace-nowrap`}>{isMine ? seatName : (seatName || '')}</span>}
                  </div>
                );
              }
              // 渲染走道格子
              if (isVirtualAisle || isColAisle || isRowAisle) {
                // 路径高亮分段：走道路径高亮
                const onPath = isVirtualAisle
                  ? false
                  : (isColAisle && pathCells.some(p => p.r === realRow && p.c === ci - 1))
                    || (isRowAisle && pathCells.some(p => p.r === ri - 1 && p.c === realCol));
                return (
                  <div key={`aisle-${ri}-${ci}`} style={{
                    gridRow: ri + 1,
                    gridColumn: ci + 1,
                  }} className={`w-10 h-8 rounded border border-dashed border-primary/30 bg-yellow-50/60 flex items-center justify-center text-[10px] text-yellow-700 ${onPath ? 'bg-yellow-200/80 border-yellow-500/80' : ''}`}>
                    {(isVirtualAisle || isColAisle || isRowAisle) && <span>走道</span>}
                  </div>
                );
              }
              return null;
            })
          )}
        </div>
      </div>
      <div className="text-center text-xs text-muted-foreground">
        <p>🚶 从{entryDoor ? entryDoor.label : '入口'}进入，沿高亮路径前行</p>
        <p>
          {(() => {
            if (!entryDoor) return null;
            // 只考虑前后门，左右门暂不支持
            if (entryDoor.row === 0) {
              // 前门
              return <>
                先沿第{myPosition.c + 1}列向前走到第{myPosition.r + 1}排
              </>;
            } else if (entryDoor.row === rows - 1) {
              // 后门
              return <>
                先沿第{myPosition.c + 1}列向后走到第{myPosition.r + 1}排
              </>;
            } else {
              // 其他门类型
              return <>
                走到第{myPosition.r + 1}排第{myPosition.c + 1}列
              </>;
            }
          })()}
        </p>
      </div>
    </>
  );
}
