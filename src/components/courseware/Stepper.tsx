import { Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCoursewareStore, type Step } from '@/stores/coursewareStore';
import { cn } from '@/lib/utils';

const STEPS: { id: Step; key: string }[] = [
  { id: 1, key: 'cw.step1' },
  { id: 2, key: 'cw.step2' },
  { id: 3, key: 'cw.step3' },
];

export function Stepper() {
  const { t } = useLanguage();
  const step = useCoursewareStore((s) => s.step);
  const setStep = useCoursewareStore((s) => s.setStep);
  const topic = useCoursewareStore((s) => s.topic);

  const canGo = (target: Step) => {
    if (target === 1) return true;
    if (target === 2) return topic.trim().length > 0;
    return topic.trim().length > 0;
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 py-4">
      {STEPS.map((s, idx) => {
        const done = step > s.id;
        const active = step === s.id;
        const reachable = canGo(s.id);
        return (
          <div key={s.id} className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && setStep(s.id)}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all',
                active && 'bg-primary text-primary-foreground shadow-md',
                !active && done && 'bg-primary/10 text-primary hover:bg-primary/20',
                !active && !done && 'bg-muted text-muted-foreground hover:bg-muted/80',
                !reachable && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  active ? 'bg-primary-foreground/20' : done ? 'bg-primary text-primary-foreground' : 'bg-background',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s.id}
              </span>
              <span className="hidden sm:inline">{t(s.key)}</span>
            </button>
            {idx < STEPS.length - 1 && <div className="h-px w-6 sm:w-10 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
