import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import { clampValue, splitIntoGroups, shuffleArray } from '@/lib/seatingUtils';
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
  const [groupCount, setGroupCount] = useState(4);
  const [freeCanvasMode, setFreeCanvasMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{row:number,startX:number,startY:number,origX:number,origY:number} | null>(null);

  const autoSeat = (shuffle = false) => {
    const names = shuffle ? shuffleArray(students.map(s => s.name)) : students.map(s => s.name);

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

  const groupSeat = () => {
    const names = students.map(s => s.name);
    const groups = splitIntoGroups(names, groupCount);
    const result: typeof assignment = [];
    let idx = 0;
    for (let r = 0; r < rowCount && idx < groups.length; r++) {
      const g = groups[idx++];
      if (g && g.length) result.push({ rowIndex: r, side: 'top', students: g.slice(0, seatsPerSide) });
      const g2 = groups[idx++];
      if (g2 && g2.length) result.push({ rowIndex: r, side: 'bottom', students: g2.slice(0, seatsPerSide) });
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
  const baseSvgW = tableW + tableMargin * 2 + 100;
  const baseSvgH = maxRows * rowGap + 120;
  const svgW = freeCanvasMode ? Math.max(baseSvgW + 600, 1200) : baseSvgW;
  const svgH = freeCanvasMode ? Math.max(baseSvgH + 420, 760) : baseSvgH;
  const baseTableX = (svgW - tableW) / 2;
  const canvasPadding = 10;

  useEffect(() => {
    setRowOffsets(Array(rowCount).fill({ x: 0, y: 0 }));
  }, [rowCount]);

  useEffect(() => {
    if (!freeCanvasMode) {
      setRowOffsets(Array(rowCount).fill({ x: 0, y: 0 }));
    }
  }, [freeCanvasMode, rowCount]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        const row = draggingRef.current.row;
        const baseY = 60 + row * rowGap;
        const rowBottom = dualSide ? baseY + 28 + seatH : baseY + 88 + seatH;
        const minY = canvasPadding - (baseY - seatH - 8);
        const maxY = svgH - canvasPadding - rowBottom;
        const minX = canvasPadding - baseTableX;
        const maxX = svgW - canvasPadding - tableW - baseTableX;

        setRowOffsets(offs => offs.map((p, i) => {
          if (i !== row) return p;
          return {
            x: clampValue(draggingRef.current!.origX + dx, minX, maxX),
            y: clampValue(draggingRef.current!.origY + dy, minY, maxY),
          };
        }));
      }
    };
    const handleMouseUp = () => { draggingRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [baseTableX, canvasPadding, dualSide, rowGap, seatH, svgH, svgW, tableW]);

  const startRowDrag = (e: React.MouseEvent, row: number) => {
    if (!freeCanvasMode) return;
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
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          组数
          <Input type="number" min={1} max={20} value={groupCount}
            onChange={e => setGroupCount(Math.max(1, Math.min(20, Number(e.target.value))))} className="w-14 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={freeCanvasMode} onChange={e => setFreeCanvasMode(e.target.checked)} className="accent-primary" />
          自由画布
        </label>
        {seated && <ExportButtons targetRef={printRef} filename="机房座位" />}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => autoSeat(true)} className="gap-2">
            <Shuffle className="w-4 h-4" /> 随机排座
          </Button>
          <Button onClick={() => autoSeat(false)} className="gap-2">
            <LayoutGrid className="w-4 h-4" /> 自动排座
          </Button>
          <Button variant="ghost" onClick={groupSeat} className="gap-2">分组排座</Button>
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
            <div className="inline-block border border-border rounded-lg bg-card/40 p-2 overflow-hidden">
            <div className={freeCanvasMode ? 'rounded-md border border-dashed border-border/70 bg-muted/20' : ''}>
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
      </SceneLandmarks>

      {seated && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          💡 {dualSide ? '长桌两侧对面坐，适合机房配对学习' : '长桌单侧坐学生'} · 拖动讲台/门窗可调整位置
        </p>
      )}
    </div>
  );
}
