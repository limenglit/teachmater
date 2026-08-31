import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 100];

interface AdminPaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Hide the whole control when total is below this threshold. Default 10. */
  threshold?: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export default function AdminPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  threshold = 10,
}: AdminPaginationProps) {
  if (total <= threshold) return null;
  const pages = totalPages(total, pageSize);
  const current = Math.min(page, pages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <span className="text-xs text-muted-foreground">
        {from}-{to} / {total}
      </span>
      <div className="flex items-center gap-1 ml-auto">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          aria-label="上一页"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground px-1">
          {current} / {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          disabled={current >= pages}
          onClick={() => onPageChange(current + 1)}
          aria-label="下一页"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">每页</span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="h-7 rounded-md border border-border bg-background text-xs px-1.5 text-foreground"
          aria-label="每页数量"
        >
          {PAGE_SIZE_OPTIONS.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
