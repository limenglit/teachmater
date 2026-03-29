import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageEditorDialog from './image-editor/ImageEditorDialog';

export default function ImageEditorTool() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="bg-card rounded-2xl border border-border shadow-card p-6 cursor-pointer hover:border-primary/40 transition-all"
        onClick={() => setOpen(true)}
      >
        <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          {t('imgEdit.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('imgEdit.desc')}</p>
      </div>
      {open && <ImageEditorDialog open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
