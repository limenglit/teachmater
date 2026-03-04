import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SceneLandmarks from './SceneLandmarks';

interface Props {
  students: { id: string; name: string }[];
}

export default function ComputerLab({ students }: Props) {
  const [rowCount, setRowCount] = useState(5);
  const [seatsPerSide, setSeatsPerSide] = useState(8);
  const [dualSide, setDualSide] = useState(true);
  const [tableGap, setTableGap] = useState(80);
  const [assignment, setAssignment] = useState<{ rowIndex: number; side: 'top' | 'bottom'; students: string[] }[]>([]);
  const [rowOffsets, setRowOffsets] = useState<{x:number,y:number}[]>([]);
  const [seated, setSeated] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{row:number,startX:number,startY:number,origX:number,origY:number} | null>(null);

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

    const result: typeof assignment = [];
    let idx = 0;

    if (dualSide) {
      for (let r = 0; r < rowCount && idx < names.length; r++) {
        const topSeats: string[] = [];
        for (let i = 0; i < seatsPerSide && idx < names.length; i++) {
          topSeats.push(names[idx++]);
        }
        if (topSeats.length > 0) {
          result.push({ rowIndex: r, side: 'top', students: topSeats });
        }

        const bottomSeats: string[] = [];
        for (let i = 0; i < seatsPerSide && idx < names.length; i++) {
          bottomSeats.push(names[idx++]);
        }
        if (bottomSeats.length > 0) {
          result.push({ rowIndex: r, side: 'bottom', students: bottomSeats });
        }
      }
    } else {
      for (let r = 0; r < rowCount && idx < names.length; r++) {
        const topSeats: string[] = [];
        for (let i = 0; i < seatsPerSide && idx < names.length; i++) {
          topSeats.push(names[idx++]);
        }
        if (topSeats.length > 0) {
          result.push({ rowIndex: r, side: 'top', students: topSeats });
        }

        const bottomSeats: string[] = [];
        for (let i = 0; i < seatsPerSide && idx < names.length; i++) {
          bottomSeats.push(names[idx++]);
        }
        if (bottomSeats.length > 0) {
          result.push({ rowIndex: r, side: 'bottom', students: bottomSeats });
        }
      }
    }

    setAssignment(result);
    setSeated(true);
  };

  const seatW = 56;
  const seatH = 36;
  const gap = 4;
  const tableMargin = 20;
  const rowGap = tableGap;

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
    };
    const handleMouseUp = () => { draggingRef.current = null; };
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
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => autoSeat(true)} className="gap-2">
            <Shuffle className="w-4 h-4" /> 随机排座
          </Button>
          <Button onClick={() => autoSeat(false)} className="gap-2">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
        </div>
      </div>

      <SceneLandmarks
        printRef={printRef}
        top={{ label: '讲 台', emoji: '🖥️' }}
        sides={{
          left: { label: '窗', boxStyle: true },
          right: { label: '门', emoji: '🚪' },
          swappable: true,
        }}
      >
        {seated ? (
          <div className="flex justify-center overflow-auto">
            <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
              {Array.from({ length: maxRows }).map((_, rowIdx) => {
                const offset = rowOffsets[rowIdx] || { x: 0, y: 0 };
                const baseY = 60 + rowIdx * rowGap + offset.y;
                const centerX = svgW / 2 + offset.x;
                const tableX = (svgW - tableW) / 2 + offset.x;

                const topGroup = assignment.find(a => a.rowIndex === rowIdx && a.side === 'top');
                const bottomGroup = assignment.find(a => a.rowIndex === rowIdx && a.side === 'bottom');

                return (
                  <g key={`row-${rowIdx}`} onMouseDown={e => startRowDrag(e, rowIdx)} style={{ cursor: 'move' }}>
                    {topGroup && (
                      <>
                        <rect x={tableX} y={baseY} width={tableW} height={24} rx={6}
                          className="fill-primary/8 stroke-primary/30" strokeWidth={1.5} />
                        <text x={centerX} y={baseY + 12} textAnchor="middle" dominantBaseline="middle" className="fill-primary/50 text-xs">
                          ━━━ 长桌 ━━━
                        </text>
                        {topGroup.students.map((name, i) => {
                          const x = tableX + gap + i * (seatW + gap);
                          const y = baseY - seatH - 8;
                          return renderSeat(x, y, name, `top-${rowIdx}-${i}`);
                        })}
                      </>
                    )}

                    {bottomGroup && (
                      <>
                        {!dualSide && (
                          <rect x={tableX} y={baseY + 56} width={tableW} height={24} rx={6}
                            className="fill-primary/8 stroke-primary/30" strokeWidth={1.5} />
                        )}
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
      </SceneLandmarks>

      {seated && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          💡 {dualSide ? '长桌两侧对面坐，适合机房配对学习' : '长桌单侧坐学生'} · 拖动讲台/门窗可调整位置
        </p>
      )}
    </div>
  );
}
