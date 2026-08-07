import { useMemo, useState } from 'react';
import { ListOrdered, ChevronDown, ChevronUp } from 'lucide-react';
import { describeStudentNoOrder, type StudentNoSource } from '@/lib/seat-student-no';

const SOURCE_LABEL: Record<StudentNoSource, string> = {
  leading: '姓名前的数字',
  trailing: '姓名后的数字',
  whole: '整条即学号',
  none: '未识别到学号',
};

interface StudentNoPreviewProps {
  names: string[];
}

/** Shows how each roster name is parsed into a student number for studentNo mode. */
export default function StudentNoPreview({ names }: StudentNoPreviewProps) {
  const [open, setOpen] = useState(true);
  const rows = useMemo(() => describeStudentNoOrder(names), [names]);
  const parsed = rows.filter(r => r.no !== null).length;
  const missing = rows.length - parsed;
  const sorted = useMemo(() => [...rows].sort((a, b) => a.order - b.order), [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-background/70">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-foreground"
      >
        <span className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-primary" />
          学号解析预览
          <span className="text-xs font-normal text-muted-foreground">
            已识别 {parsed} 人 · 未识别 {missing} 人（按名单顺序排在最后）
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="max-h-60 overflow-y-auto border-t border-border/60">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">落座序号</th>
                <th className="text-left px-3 py-1.5 font-medium">姓名</th>
                <th className="text-left px-3 py-1.5 font-medium">解析学号</th>
                <th className="text-left px-3 py-1.5 font-medium">排序依据</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={`${row.name}-${i}`} className="border-t border-border/40">
                  <td className="px-3 py-1.5 text-muted-foreground">{row.order}</td>
                  <td className="px-3 py-1.5 text-foreground">{row.name}</td>
                  <td className={`px-3 py-1.5 ${row.no === null ? 'text-muted-foreground' : 'text-primary font-medium'}`}>
                    {row.no === null ? '—' : row.no}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {SOURCE_LABEL[row.source]}
                    {row.matched ? `（"${row.matched}"）` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
