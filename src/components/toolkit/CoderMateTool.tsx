import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Code, ExternalLink } from 'lucide-react';

export default function CoderMateTool() {
  const { t } = useLanguage();
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
        <Code className="w-4 h-4" /> {t('toolkit.coderMate')}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">{t('toolkit.coderMateDesc')}</p>
      <Button variant="outline" className="w-full gap-2" asChild>
        <a href="https://codermate.lovable.app/" target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-4 h-4" /> {t('toolkit.coderMateAction')}
        </a>
      </Button>
    </div>
  );
}
