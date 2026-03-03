import React, { useState, useRef, useEffect } from 'react';
import { distributeComputerLab } from '@/lib/seating';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';

interface Props {
  students: { id: string; name: string }[];
}

type RefObj = { id: string; type: 'podium' | 'door' | 'window' | 'aisle'; x: number; y: number; label?: string };

export default function ComputerLab({ students }: Props) {
  const [rowCount, setRowCount] = useState(5);
  const [seatsPerSide, setSeatsPerSide] = useState(8);
  const [dualSide, setDualSide] = useState(true); // 是否两侧坐学生
  const [tableGap, setTableGap] = useState(80);
  const [assignment, setAssignment] = useState<{ rowIndex: number; side: 'top' | 'bottom'; students: string[] }[]>([]);
  const [rowOffsets, setRowOffsets] = useState<{x:number,y:number}[]>([]);
  const [seated, setSeated] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{row:number,startX:number,startY:number,origX:number,origY:number} | null>(null);
  const [refsObjs, setRefsObjs] = useState<RefObj[]>([]);
  const refDragging = useRef<{id:string,startX:number,startY:number,origX:number,origY:number} | null>(null);

  const autoSeat = (shuffle = false) => {
    const names = students.map(s => s.name);
    const res = distributeComputerLab(names, rowCount, seatsPerSide, dualSide, shuffle);
    setAssignment(res);
    setSeated(true);
  };

  const seatW = 56;
  const seatH = 36;
  const gap = 4;
  const tableMargin = 20;
  const rowGap = tableGap; // controlled by state

  // 计算 SVG 尺寸
  const tableW = seatsPerSide * (seatW + gap) + gap;
  const maxRows = Math.max(...assignment.map(a => a.rowIndex), -1) + 1 || rowCount;
  const svgW = tableW + tableMargin * 2 + 100;
  const svgH = maxRows * rowGap + 120;

  useEffect(() => {
    setRowOffsets(Array(rowCount).fill({ x: 0, y: 0 }));
  }, [rowCount]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        setRowOffsets(offs => offs.map((p,i) =>
          i === draggingRef.current!.row
            ? { x: draggingRef.current!.origX + dx, y: draggingRef.current!.origY + dy }
            : p
        ));
      }
      if (refDragging.current) {
        const dx = e.clientX - refDragging.current.startX;
        const dy = e.clientY - refDragging.current.startY;
        setRefsObjs(rs => rs.map(r => r.id === refDragging.current!.id ? { ...r, x: refDragging.current!.origX + dx, y: refDragging.current!.origY + dy } : r));
      }
    };
    const handleMouseUp = () => { draggingRef.current = null; refDragging.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startRowDrag = (e: React.MouseEvent, row: number) => {
    e.stopPropagation();
    draggingRef.current = {
      row,
      startX: e.clientX,
      startY: e.clientY,
      origX: rowOffsets[row]?.x || 0,
      origY: rowOffsets[row]?.y || 0,
    };
  };

  const startRefDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const found = refsObjs.find(r => r.id === id);
    refDragging.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: found?.x || 0,
      origY: found?.y || 0,
    };
  };

  const addRef = (type: RefObj['type']) => {
    const id = `${type}-${Date.now()}`;
    setRefsObjs(rs => [...rs, { id, type, x: 0, y: 0, label: type }]);
  };

  const renderSeat = (x: number, y: number, name: string, key: string) => (
    <g key={key}>
      <rect x={x} y={y} width={seatW} height={seatH} rx={4}
        className={name ? 'fill-card stroke-border' : 'fill-muted/50 stroke-border/50'} strokeWidth={1.5} />
      {name && (
        <text x={x + seatW / 2} y={y + seatH / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xs">
          {name.length > 3 ? name.slice(0, 3) : name}
        </text>
      )}
    </g>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          排数
          <Input type="number" min={1} max={15} value={rowCount}
            onChange={e => setRowCount(Math.max(1, Math.min(15, Number(e.target.value))))} className="w-14 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          每侧座位数
          <Input type="number" min={3} max={16} value={seatsPerSide}
            onChange={e => setSeatsPerSide(Math.max(3, Math.min(16, Number(e.target.value))))} className="w-14 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          行间距
          <Input type="number" min={20} max={200} value={tableGap}
            onChange={e => setTableGap(Math.max(20, Math.min(200, Number(e.target.value))))} className="w-14 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={dualSide} onChange={e => setDualSide(e.target.checked)} className="accent-primary" />
          长桌两侧
        </label>
        {seated && <ExportButtons targetRef={printRef} filename="机房座位" />}
        {seated && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => addRef('podium')}>添加讲台</Button>
            <Button variant="ghost" size="sm" onClick={() => addRef('door')}>添加门</Button>
            <Button variant="ghost" size="sm" onClick={() => addRef('window')}>添加窗</Button>
            <Button variant="ghost" size="sm" onClick={() => addRef('aisle')}>添加过道</Button>
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => autoSeat(true)} className="gap-2">
            <Shuffle className="w-4 h-4" /> 随机排座
          </Button>
          <Button onClick={() => autoSeat(false)} className="gap-2">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
        </div>
      </div>

      <div ref={printRef}>
        {seated ? (
          <div className="flex justify-center overflow-auto">
            <div className="relative">
              <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
              {/* Render each row of long desks */}
              {Array.from({ length: maxRows }).map((_, rowIdx) => {
                const offset = rowOffsets[rowIdx] || { x: 0, y: 0 };
                const baseY = 60 + rowIdx * rowGap + offset.y;
                const centerX = svgW / 2 + offset.x;
                const tableX = (svgW - tableW) / 2 + offset.x;

                // Get students for this row
                const topGroup = assignment.find(a => a.rowIndex === rowIdx && a.side === 'top');
                const bottomGroup = assignment.find(a => a.rowIndex === rowIdx && a.side === 'bottom');

                return (
                  <g key={`row-${rowIdx}`} onMouseDown={e => startRowDrag(e, rowIdx)} style={{ cursor: 'move' }}>
                    {/* Top side of the desk */}
                    {topGroup && (
                      <>
                        {/* Desk */}
                        <rect x={tableX} y={baseY} width={tableW} height={24} rx={6}
                          className="fill-primary/8 stroke-primary/30" strokeWidth={1.5} />
                        <text x={centerX} y={baseY + 12} textAnchor="middle" dominantBaseline="middle" className="fill-primary/50 text-xs">
                          ━━━ 长桌 ━━━
                        </text>
                        {/* Seats on top */}
                        {topGroup.students.map((name, i) => {
                          const x = tableX + gap + i * (seatW + gap);
                          const y = baseY - seatH - 8;
                          return renderSeat(x, y, name, `top-${rowIdx}-${i}`);
                        })}
                      </>
                    )}

                    {/* Bottom side of the desk */}
                    {bottomGroup && (
                      <>
                        {/* Desk */}
                        {!dualSide && (
                          <rect x={tableX} y={baseY + 56} width={tableW} height={24} rx={6}
                            className="fill-primary/8 stroke-primary/30" strokeWidth={1.5} />
                        )}
                        {/* Seats on bottom */}
                        {bottomGroup.students.map((name, i) => {
                          const x = tableX + gap + i * (seatW + gap);
                          const y = dualSide ? baseY + 28 : baseY + 88;
                          return renderSeat(x, y, name, `bottom-${rowIdx}-${i}`);
                        })}
                      </>
                    )}
                  </g>
                );
              })}
            </svg>

              <div className="absolute inset-0 pointer-events-none">
                {refsObjs.map(r => (
                  <div
                    key={r.id}
                    className="absolute pointer-events-auto bg-white/80 border rounded px-2 py-1 text-xs shadow"
                    style={{ left: r.x, top: r.y, transform: 'translate(-50%,-50%)' }}
                    onMouseDown={(e) => startRefDrag(e, r.id)}
                    onDoubleClick={() => setRefsObjs(rs => rs.filter(x => x.id !== r.id))}
                  >
                    {r.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">点击「自动排座」开始安排</p>
            <p className="text-sm">
              {dualSide
                ? `长桌长边两侧，${rowCount} 排，每侧 ${seatsPerSide} 个座位`
                : `长桌单侧，${rowCount} 排，每排 ${seatsPerSide * 2} 个座位`}
            </p>
          </div>
        )}
      </div>

      {seated && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          💡 {dualSide ? '长桌两侧对面坐，适合机房配对学习' : '长桌单侧坐学生，上下两排长桌'}
        </p>
      )}
    </div>
  );
}
