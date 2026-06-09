import { useMemo } from 'react';
import { AlertTriangle, Info, Layers } from 'lucide-react';
import {
  collectActiveRules,
  detectRuleConflicts,
  type SeatRuleState,
} from '@/lib/seat-rule-conflicts';

interface SeatRuleComposerProps {
  state: SeatRuleState;
  /** When provided, allows the user to drop a single rule by id (currently
   *  only used for gender policy reset to surface a quick-fix button). */
  onQuickFix?: (loserId: string) => void;
}

/**
 * Read-only summary of the rules that will be applied by the next `autoSeat`
 * call, plus a banner explaining how conflicts will be resolved. Sits inside
 * the existing strategy card so teachers can preview the combined effect
 * before clicking "auto-seat".
 */
export default function SeatRuleComposer({ state, onQuickFix }: SeatRuleComposerProps) {
  const rules = useMemo(() => collectActiveRules(state), [state]);
  const conflicts = useMemo(() => detectRuleConflicts(rules), [rules]);

  const sorted = useMemo(() => [...rules].sort((a, b) => b.priority - a.priority), [rules]);
  const loserIds = useMemo(() => new Set(conflicts.flatMap(c => c.loserIds)), [conflicts]);

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Layers className="w-4 h-4 text-primary" />
        <span>当前规则组合（按优先级排序）</span>
        <span className="text-xs text-muted-foreground">共 {rules.length} 条</span>
      </div>

      <div className="flex flex-wrap gap-1.5" role="list" aria-label="当前生效的排座规则">
        {sorted.map((rule, idx) => {
          const overridden = loserIds.has(rule.id);
          return (
            <span
              key={rule.id}
              role="listitem"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                overridden
                  ? 'border-amber-300 bg-amber-50 text-amber-700 line-through dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-primary/30 bg-primary/5 text-foreground'
              }`}
              title={overridden ? '该规则被更高优先级规则覆盖，不会生效' : `优先级 ${rule.priority}`}
            >
              <span className="text-[10px] font-mono opacity-60">#{idx + 1}</span>
              {rule.label}
            </span>
          );
        })}
      </div>

      {conflicts.length > 0 && (
        <div className="space-y-1.5" role="alert" aria-live="polite">
          {conflicts.map((conflict, i) => {
            const Icon = conflict.severity === 'warning' ? AlertTriangle : Info;
            const tone =
              conflict.severity === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                : 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200';
            return (
              <div key={i} className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs ${tone}`}>
                <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div className="flex-1 leading-relaxed">
                  <div>{conflict.message}</div>
                  {onQuickFix && conflict.loserIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onQuickFix(conflict.loserIds[0])}
                      className="mt-1 underline underline-offset-2 hover:opacity-80"
                    >
                      取消被覆盖的规则
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
