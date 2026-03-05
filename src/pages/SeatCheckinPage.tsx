import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { MapPin, Navigation, CheckCircle2 } from 'lucide-react';

interface SceneConfig {
  rows: number;
  cols: number;
  windowOnLeft: boolean;
  colAisles: number[];
  rowAisles: number[];
  doorPosition?: { side: 'left' | 'right'; row?: number };
}

export default function SeatCheckinPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<{
    seat_data: (string | null)[][];
    student_names: string[];
    scene_config: SceneConfig;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [myPosition, setMyPosition] = useState<{ r: number; c: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    supabase.from('seat_checkin_sessions').select('*').eq('id', sessionId).single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast({ title: '签到会话不存在', variant: 'destructive' });
          setLoading(false);
          return;
        }
        setSession({
          seat_data: data.seat_data as unknown as (string | null)[][],
          student_names: data.student_names as unknown as string[],
          scene_config: data.scene_config as unknown as SceneConfig,
        });
        setLoading(false);
      });
  }, [sessionId]);

  const handleNameInput = (val: string) => {
    setName(val);
    if (!session || val.length === 0) { setSuggestions([]); return; }
    const filtered = session.student_names.filter(n =>
      n.toLowerCase().includes(val.toLowerCase()) && n !== val
    );
    setSuggestions(filtered.slice(0, 5));
  };

  const selectSuggestion = (s: string) => {
    setName(s);
    setSuggestions([]);
  };

  const findSeat = (studentName: string): { r: number; c: number } | null => {
    if (!session) return null;
    for (let r = 0; r < session.seat_data.length; r++) {
      for (let c = 0; c < session.seat_data[r].length; c++) {
        if (session.seat_data[r][c] === studentName) return { r, c };
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!name.trim() || !sessionId) return;
    const pos = findSeat(name.trim());
    if (!pos) {
      toast({ title: '未找到该姓名的座位', description: '请检查姓名是否正确', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from('seat_checkin_records').insert({
        session_id: sessionId,
        student_name: name.trim(),
      });
      setMyPosition(pos);
      setCheckedIn(true);
    } catch {
      toast({ title: '签到失败', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate path from door to seat
  const pathCells = useMemo(() => {
    if (!myPosition || !session) return [];
    const config = session.scene_config;
    const doorCol = config.windowOnLeft ? config.cols - 1 : 0;
    const doorRow = config.rows - 1; // door usually at back

    const path: { r: number; c: number }[] = [];
    // Walk along the back row to the target column
    const colStep = doorCol <= myPosition.c ? 1 : -1;
    for (let c = doorCol; c !== myPosition.c; c += colStep) {
      path.push({ r: doorRow, c });
    }
    // Walk up to the target row
    const rowStep = doorRow <= myPosition.r ? 1 : -1;
    for (let r = doorRow; r !== myPosition.r; r += rowStep) {
      path.push({ r, c: myPosition.c });
    }
    path.push(myPosition);
    return path;
  }, [myPosition, session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        签到会话不存在或已过期
      </div>
    );
  }

  // Not checked in yet — show name input
  if (!checkedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <MapPin className="w-12 h-12 mx-auto text-primary" />
            <h1 className="text-xl font-bold text-foreground">座位签到</h1>
            <p className="text-sm text-muted-foreground">输入姓名查看你的座位位置</p>
          </div>

          <div className="relative">
            <Input
              value={name}
              onChange={e => handleNameInput(e.target.value)}
              placeholder="请输入你的姓名"
              className="text-center text-lg h-12"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={!name.trim() || submitting} className="w-full h-12 text-base">
            {submitting ? '签到中...' : '确认签到'}
          </Button>
        </div>
      </div>
    );
  }

  // Checked in — show seat map with highlight and path
  const config = session.scene_config;
  const rows = config.rows || session.seat_data.length;
  const cols = config.cols || (session.seat_data[0]?.length ?? 8);
  const colAisles = config.colAisles || [];
  const rowAisles = config.rowAisles || [];
  const totalVisualCols = cols + colAisles.length;
  const totalVisualRows = rows + rowAisles.length;

  const realToVisualCol = (realCol: number) => {
    let offset = 0;
    for (const a of colAisles) {
      if (realCol > a) offset++;
    }
    return realCol + offset;
  };

  const getVisualRow = (realRow: number) => {
    let offset = 0;
    for (const a of rowAisles) {
      if (realRow > a) offset++;
    }
    return realRow + offset;
  };

  const isOnPath = (r: number, c: number) => pathCells.some(p => p.r === r && p.c === c);
  const isMyPos = (r: number, c: number) => myPosition?.r === r && myPosition?.c === c;

  const doorCol = config.windowOnLeft ? cols - 1 : 0;
  const doorRow = rows - 1;

  return (
    <div className="min-h-screen bg-background p-4 overflow-auto">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-primary">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-lg font-bold">签到成功！</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {name}，你的座位在 <strong>第{myPosition!.r + 1}排 第{myPosition!.c + 1}列</strong>
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded bg-primary inline-block" /> 你的座位
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded bg-primary/30 border border-primary/50 inline-block" /> 引导路径
          </span>
          <span className="flex items-center gap-1">
            <Navigation className="w-3 h-3" /> 从门出发
          </span>
        </div>

        {/* Podium */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm">
            {config.windowOnLeft
              ? <span className="inline-flex items-center justify-center w-6 h-6 border border-primary/40 rounded bg-primary/10 text-xs text-primary">窗</span>
              : <span className="text-base">🚪</span>}
          </span>
          <div className="bg-primary/10 text-primary px-6 py-1.5 rounded-lg text-xs font-medium border border-primary/20">
            🏫 讲 台
          </div>
          <span className="text-sm">
            {config.windowOnLeft
              ? <span className="text-base">🚪</span>
              : <span className="inline-flex items-center justify-center w-6 h-6 border border-primary/40 rounded bg-primary/10 text-xs text-primary">窗</span>}
          </span>
        </div>

        {/* Seat Grid */}
        <div className="flex justify-center overflow-auto pb-4">
          <div
            className="inline-grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${totalVisualCols}, 2.5rem)`,
              gridTemplateRows: `repeat(${totalVisualRows}, 2rem)`,
            }}
          >
            {Array.from({ length: rows }).map((_, ri) => (
              Array.from({ length: cols }).map((_, ci) => {
                const seatName = session.seat_data[ri]?.[ci] ?? null;
                const isMine = isMyPos(ri, ci);
                const onPath = isOnPath(ri, ci) && !isMine;
                const isDoor = ri === doorRow && ci === doorCol;

                return (
                  <div
                    key={`${ri}-${ci}`}
                    style={{
                      gridRow: getVisualRow(ri) + 1,
                      gridColumn: realToVisualCol(ci) + 1,
                    }}
                    className={`w-10 h-8 rounded text-xs flex items-center justify-center border transition-all
                      ${isMine
                        ? 'bg-primary text-primary-foreground border-primary font-bold shadow-lg scale-110 z-10 ring-2 ring-primary/40'
                        : onPath
                          ? 'bg-primary/20 border-primary/40 text-primary/80'
                          : isDoor
                            ? 'bg-accent border-accent-foreground/20 text-accent-foreground'
                            : seatName
                              ? 'bg-card border-border text-foreground/60'
                              : 'bg-muted/30 border-dashed border-border/50 text-muted-foreground/40'
                      }`}
                  >
                    {isDoor && !isMine ? (
                      <Navigation className="w-3 h-3" />
                    ) : isMine ? (
                      <span className="truncate px-0.5">{seatName}</span>
                    ) : (
                      <span className="truncate px-0.5 text-[10px]">{seatName || ''}</span>
                    )}
                  </div>
                );
              })
            ))}

            {/* Column aisles */}
            {colAisles.map(aisleAfterCol => {
              const visualCol = aisleAfterCol + colAisles.filter(a => a < aisleAfterCol).length + 1;
              return Array.from({ length: rows }).map((_, ri) => (
                <div
                  key={`aisle-${ri}-${aisleAfterCol}`}
                  style={{ gridRow: getVisualRow(ri) + 1, gridColumn: visualCol + 1 }}
                  className="w-10 h-8 flex items-center justify-center"
                >
                  {isOnPath(ri, aisleAfterCol) || isOnPath(ri, aisleAfterCol + 1) ? (
                    <div className="w-0.5 h-5 bg-primary/30 rounded" />
                  ) : (
                    <div className="w-0.5 h-5 bg-border/30 rounded" />
                  )}
                </div>
              ));
            })}

            {/* Row aisles */}
            {rowAisles.map(aisleAfterRow => {
              const aisleVisualRow = getVisualRow(aisleAfterRow) + 2;
              return Array.from({ length: totalVisualCols }).map((_, ci) => (
                <div
                  key={`row-aisle-${aisleAfterRow}-${ci}`}
                  style={{ gridRow: aisleVisualRow, gridColumn: ci + 1 }}
                  className="w-10 h-8 flex items-center justify-center"
                >
                  <div className="w-5 h-0.5 bg-border/30 rounded" />
                </div>
              ));
            })}
          </div>
        </div>

        {/* Direction hint */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>🚶 从{config.windowOnLeft ? '右侧' : '左侧'}门进入，沿高亮路径前行</p>
          <p>向{myPosition!.c > doorCol ? '左' : myPosition!.c < doorCol ? '右' : '前'}走到第{myPosition!.c + 1}列，再向前走到第{myPosition!.r + 1}排</p>
        </div>
      </div>
    </div>
  );
}
