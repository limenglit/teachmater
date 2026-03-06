import { useMemo } from 'react';
import { Navigation } from 'lucide-react';

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
  const doorCol = config.windowOnLeft ? cols - 1 : 0;
  const doorRow = rows - 1;

  const pathCells = useMemo(() => {
    if (!myPosition) return [];
    const path: { r: number; c: number }[] = [];
    const colStep = doorCol <= myPosition.c ? 1 : -1;
    for (let c = doorCol; c !== myPosition.c; c += colStep) path.push({ r: doorRow, c });
    const rowStep = doorRow <= myPosition.r ? 1 : -1;
    for (let r = doorRow; r !== myPosition.r; r += rowStep) path.push({ r, c: myPosition.c });
    path.push(myPosition);
    return path;
  }, [myPosition, doorCol, doorRow]);

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
      <div className="flex justify-center overflow-auto pb-4">
        <div className="inline-grid gap-1" style={{
          gridTemplateColumns: `repeat(${totalVisualCols}, 2.5rem)`,
        }}>
          {Array.from({ length: rows }).flatMap((_, ri) =>
            Array.from({ length: cols }).map((_, ci) => {
              const seatName = seats[ri]?.[ci] ?? null;
              const isMine = isMyPos(ri, ci);
              const onPath = isOnPath(ri, ci) && !isMine;
              const isDoor = ri === doorRow && ci === doorCol;
              return (
                <div key={`${ri}-${ci}`} style={{
                  gridRow: getVisualRow(ri) + 1,
                  gridColumn: realToVisualCol(ci) + 1,
                }} className={`w-10 h-8 rounded text-xs flex items-center justify-center border transition-all ${
                  isMine ? 'bg-primary text-primary-foreground border-primary font-bold shadow-lg scale-110 z-10 ring-2 ring-primary/40'
                  : onPath ? 'bg-primary/20 border-primary/40 text-primary/80'
                  : isDoor ? 'bg-accent border-accent-foreground/20 text-accent-foreground'
                  : seatName ? 'bg-card border-border text-foreground/60'
                  : 'bg-muted/30 border-dashed border-border/50 text-muted-foreground/40'
                }`}>
                  {isDoor && !isMine ? <Navigation className="w-3 h-3" />
                    : <span className="truncate px-0.5 text-[10px]">{isMine ? seatName : (seatName || '')}</span>}
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="text-center text-xs text-muted-foreground">
        <p>🚶 从{config.windowOnLeft ? '右侧' : '左侧'}门进入，沿高亮路径前行</p>
        <p>向{myPosition.c > doorCol ? '左' : myPosition.c < doorCol ? '右' : '前'}走到第{myPosition.c + 1}列，再向前走到第{myPosition.r + 1}排</p>
      </div>
    </>
  );
}
