import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Sparkles, FileText, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

interface Props {
  onAnalyze: (text: string) => void;
  loading: boolean;
}

export default function TextInputArea({ onAnalyze, loading }: Props) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'md'].includes(ext || '')) {
      toast({ title: t('visual.fileUnsupported'), variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t('visual.fileTooLarge'), variant: 'destructive' });
      return;
    }
    const content = await file.text();
    setText(content);
    toast({ title: t('visual.fileLoaded') });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">{t('visual.inputTitle')}</span>
      </div>
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t('visual.inputPlaceholder')}
        className="min-h-[160px] text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          onClick={() => onAnalyze(text)}
          disabled={loading || text.trim().length < 10}
          className="gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? t('visual.analyzing') : t('visual.analyze')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
          <Upload className="w-4 h-4" />
          {t('visual.uploadFile')}
        </Button>
        <input ref={fileRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFile} />
        <span className="text-xs text-muted-foreground ml-auto">{text.length} {t('visual.chars')}</span>
      </div>
    </div>
  );
}
