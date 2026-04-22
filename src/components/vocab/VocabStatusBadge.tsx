import type { VocabStatus } from '@/lib/vocab-cloud';

const STATUS_MAP: Record<VocabStatus, { label: string; className: string }> = {
  private: { label: '私有', className: 'bg-muted text-muted-foreground' },
  pending: { label: '待审核', className: 'bg-warning/10 text-warning' },
  approved: { label: '已通过', className: 'bg-success/10 text-success' },
  rejected: { label: '已拒绝', className: 'bg-destructive/10 text-destructive' },
};

export default function VocabStatusBadge({ status, isSystem }: { status: VocabStatus; isSystem?: boolean }) {
  if (isSystem) {
    return (
      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
        平台推荐
      </span>
    );
  }
  const cfg = STATUS_MAP[status];
  return (
    <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
