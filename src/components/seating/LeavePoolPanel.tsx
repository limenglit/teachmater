import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, UserMinus } from 'lucide-react';
import type { LeavePoolEntry } from '@/lib/seat-leave-pool';

interface Props {
  entries: LeavePoolEntry[];
  /** 双击条目或拖回座位后恢复 */
  onRestore: (entry: LeavePoolEntry) => void;
  /** 把某个已就座学生拖进请假池 */
  onDropName?: (name: string) => void;
  className?: string;
}

/**
 * 可折叠的请假池面板（智慧教室、机房等场景通用）。
 * 默认折叠；有人被请假时自动展开，便于确认与恢复。
 */
export default function LeavePoolPanel({ entries, onRestore, onDropName, className }: Props) {
  const [open, setOpen] = useState(false);
  const prevCount = useRef(entries.length);

  useEffect(() => {
    if (entries.length > prevCount.current) setOpen(true);
    prevCount.current = entries.length;
  }, [entries.length]);

  return (
    <div
      className={`mt-4 rounded-xl border border-dashed border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2.5 ${className || ''}`}
      onDragOver={e => {
        if (!onDropName) return;
        const types = Array.from(e.dataTransfer.types || []);
        if (types.includes('application/x-student-name') || types.includes('text/plain')) e.preventDefault();
      }}
      onDrop={e => {
        if (!onDropName) return;
        e.preventDefault();
        const raw = e.dataTransfer.getData('text/plain');
        const name = raw.startsWith('student:') ? raw.slice('student:'.length) : e.dataTransfer.getData('application/x-student-name');
        if (name) onDropName(name);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <UserMinus className="w-3.5 h-3.5" />
          请假池（{entries.length} 人）
        </span>
        <span className="text-[11px] text-muted-foreground">双击座位移入 · 双击或拖回座位恢复</span>
      </button>

      {open && (
        <div className="mt-2">
          {entries.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">暂无请假学生。双击座位上的姓名即可请假，其座位空出且不计入签到名单。</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entries.map(entry => (
                <button
                  key={`${entry.name}-${entry.i}-${entry.j}`}
                  type="button"
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', `student:${entry.name}`);
                    e.dataTransfer.setData('application/x-student-name', entry.name);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDoubleClick={() => onRestore(entry)}
                  title={`原座位：${entry.label} · 双击或拖到座位恢复`}
                  className="px-2.5 py-1 rounded-md border border-amber-400/60 bg-background text-xs text-foreground shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/60"
                >
                  {entry.name}
                  <span className="ml-1 text-[10px] text-muted-foreground">{entry.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
