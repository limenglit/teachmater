import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { clearGridSeat, findInGrid, restoreIntoGrid, type LeavePoolEntry } from '@/lib/seat-leave-pool';

interface Options {
  assignment: string[][];
  setAssignment: (updater: (prev: string[][]) => string[][]) => void;
  /** 关闭 / 不可用座位判定 */
  isClosed?: (i: number, j: number) => boolean;
  /** 座位描述，例如 (i,j) => `${i+1}桌${j+1}号` */
  labelOf: (i: number, j: number) => string;
}

/** 二维姓名网格场景（智慧教室 / 宴会厅 / 音乐厅 / 美术教室）的请假池逻辑。 */
export function useGridLeavePool({ assignment, setAssignment, isClosed, labelOf }: Options) {
  const [leavePool, setLeavePool] = useState<LeavePoolEntry[]>([]);
  const gridRef = useRef(assignment);
  useEffect(() => { gridRef.current = assignment; }, [assignment]);

  const closed = useCallback((i: number, j: number) => (isClosed ? isClosed(i, j) : false), [isClosed]);

  const moveToLeave = useCallback((i: number, j: number, name: string) => {
    const clean = (name || '').trim();
    if (!clean) return;
    setAssignment(prev => clearGridSeat(prev, i, j));
    setLeavePool(prev => (prev.some(x => x.name === clean) ? prev : [...prev, { name: clean, i, j, label: labelOf(i, j) }]));
    toast.success(`${clean} 已请假，座位已空出`);
  }, [setAssignment, labelOf]);

  const dropName = useCallback((name: string) => {
    const found = findInGrid(gridRef.current, name);
    if (!found) return;
    moveToLeave(found.i, found.j, name);
  }, [moveToLeave]);

  const restore = useCallback((entry: LeavePoolEntry) => {
    const res = restoreIntoGrid(gridRef.current, entry, closed);
    if (!res) { toast.error('没有空位可以恢复，请先增加座位'); return; }
    setAssignment(() => res.grid);
    setLeavePool(prev => prev.filter(x => x.name !== entry.name));
    const backToOrigin = res.i === entry.i && res.j === entry.j;
    toast.success(backToOrigin ? `${entry.name} 已恢复原位` : `${entry.name} 原位已被占用，已安排到 ${labelOf(res.i, res.j)}`);
  }, [closed, setAssignment, labelOf]);

  return { leavePool, moveToLeave, restore, dropName };
}
