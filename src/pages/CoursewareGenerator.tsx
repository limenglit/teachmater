import { useLanguage } from '@/contexts/LanguageContext';
import { useCoursewareStore } from '@/stores/coursewareStore';
import { Stepper } from '@/components/courseware/Stepper';
import { Step1TopicInput } from '@/components/courseware/Step1TopicInput';
import { Step2DesignConfig } from '@/components/courseware/Step2DesignConfig';
import { Step3OutlinePanel } from '@/components/courseware/Step3OutlinePanel';
import { Sparkles } from 'lucide-react';

export default function CoursewareGenerator() {
  const { t } = useLanguage();
  const step = useCoursewareStore((s) => s.step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <header className="text-center space-y-2 py-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {t('cw.badge')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('cw.title')}</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">{t('cw.subtitle')}</p>
        </header>

        <Stepper />

        <main className="mt-4">
          {step === 1 && <Step1TopicInput />}
          {step === 2 && <Step2DesignConfig />}
          {step === 3 && <Step3OutlinePanel />}
        </main>
      </div>
    </div>
  );
}
