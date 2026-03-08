import { useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Download, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportedQuestion {
  type: 'single' | 'multi' | 'tf' | 'short';
  content: string;
  options: string[];
  correct_answer: string | string[];
  tags: string;
}

interface Props {
  onImport: (questions: ImportedQuestion[]) => void;
}

const TYPE_MAP: Record<string, 'single' | 'multi' | 'tf' | 'short'> = {
  '单选': 'single', '多选': 'multi', '判断': 'tf', '简答': 'short',
  'single': 'single', 'multi': 'multi', 'tf': 'tf', 'short': 'short',
  '单选题': 'single', '多选题': 'multi', '判断题': 'tf', '简答题': 'short',
};

export default function QuizImporter({ onImport }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportedQuestion[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      t('quiz.imp.colType'),
      t('quiz.imp.colContent'),
      t('quiz.imp.colA'),
      t('quiz.imp.colB'),
      t('quiz.imp.colC'),
      t('quiz.imp.colD'),
      t('quiz.imp.colAnswer'),
      t('quiz.imp.colTags'),
    ];
    const examples = [
      ['单选', '以下哪个是JavaScript的基本数据类型？', 'String', 'Array', 'Object', 'Map', 'A', '前端'],
      ['多选', '以下哪些是CSS布局方式？', 'Flex', 'Grid', 'Float', 'Margin', 'A,B,C', 'CSS'],
      ['判断', 'HTML是一种编程语言', '', '', '', '', 'B', 'Web基础'],
      ['简答', '请简述HTTP和HTTPS的区别', '', '', '', '', '', '网络'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    // Set column widths
    ws['!cols'] = [
      { wch: 8 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('quiz.imp.sheetName'));
    XLSX.writeFile(wb, `quiz-template.xlsx`);
    toast({ title: t('quiz.imp.templateDownloaded') });
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
          setErrors([t('quiz.imp.emptyFile')]);
          return;
        }

        const parsed: ImportedQuestion[] = [];
        const errs: string[] = [];

        // Skip header row
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[0]) continue;

          const rawType = String(row[0] || '').trim().toLowerCase();
          const type = TYPE_MAP[rawType] || TYPE_MAP[String(row[0] || '').trim()];
          if (!type) {
            errs.push(`${t('quiz.imp.row')} ${i + 1}: ${t('quiz.imp.unknownType')} "${row[0]}"`);
            continue;
          }

          const content = String(row[1] || '').trim();
          if (!content) {
            errs.push(`${t('quiz.imp.row')} ${i + 1}: ${t('quiz.imp.emptyContent')}`);
            continue;
          }

          let options: string[] = [];
          if (type === 'single' || type === 'multi') {
            options = [row[2], row[3], row[4], row[5]]
              .map(v => String(v || '').trim())
              .filter(v => v && v !== 'undefined');
            if (options.length < 2) {
              errs.push(`${t('quiz.imp.row')} ${i + 1}: ${t('quiz.imp.fewOptions')}`);
              continue;
            }
          } else if (type === 'tf') {
            options = ['正确', '错误'];
          }

          const rawAnswer = String(row[6] || '').trim().toUpperCase();
          let correct_answer: string | string[] = rawAnswer;
          if (type === 'multi') {
            correct_answer = rawAnswer.split(/[,，、\s]+/).filter(Boolean).sort();
            if (correct_answer.length === 0) {
              errs.push(`${t('quiz.imp.row')} ${i + 1}: ${t('quiz.imp.noAnswer')}`);
              continue;
            }
          } else if (type === 'single' || type === 'tf') {
            if (!rawAnswer) {
              errs.push(`${t('quiz.imp.row')} ${i + 1}: ${t('quiz.imp.noAnswer')}`);
              continue;
            }
          }
          // short answer: correct_answer can be empty

          const tags = String(row[7] || '').trim();

          parsed.push({ type, content, options, correct_answer, tags });
        }

        setPreview(parsed);
        setErrors(errs);
      } catch (err) {
        setErrors([t('quiz.imp.parseError')]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast({ title: t('quiz.imp.unsupportedFormat'), variant: 'destructive' });
      return;
    }
    parseFile(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (preview.length === 0) return;
    onImport(preview);
    setPreview([]);
    setErrors([]);
    setOpen(false);
    toast({ title: `${t('quiz.imp.imported')} ${preview.length} ${t('quiz.imp.questionsUnit')}` });
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'single': return t('quiz.single');
      case 'multi': return t('quiz.multi');
      case 'tf': return t('quiz.tf');
      case 'short': return t('quiz.short');
      default: return type;
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setOpen(true)}>
        <Upload className="w-3.5 h-3.5" /> {t('quiz.imp.import')}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview([]); setErrors([]); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              {t('quiz.imp.title')}
            </DialogTitle>
            <DialogDescription>{t('quiz.imp.desc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-auto">
            {/* Step 1: Download template */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t('quiz.imp.step1')}</p>
                <p className="text-xs text-muted-foreground">{t('quiz.imp.step1Hint')}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5" /> {t('quiz.imp.downloadTemplate')}
              </Button>
            </div>

            {/* Step 2: Upload file */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t('quiz.imp.step2')}</p>
                <p className="text-xs text-muted-foreground">{t('quiz.imp.step2Hint')}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> {t('quiz.imp.selectFile')}
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-1">
                <div className="flex items-center gap-1.5 text-destructive text-sm font-medium">
                  <AlertCircle className="w-4 h-4" /> {t('quiz.imp.errors')} ({errors.length})
                </div>
                <div className="max-h-24 overflow-auto space-y-0.5">
                  {errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive/80">{err}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {t('quiz.imp.preview')} ({preview.length} {t('quiz.imp.questionsUnit')})
                </p>
                <div className="max-h-48 overflow-auto space-y-1.5 border border-border rounded-lg p-2">
                  {preview.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-muted/30 text-xs">
                      <span className="text-muted-foreground font-mono w-5 shrink-0">{i + 1}</span>
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] shrink-0">
                        {typeLabel(q.type)}
                      </span>
                      <span className="text-foreground line-clamp-1 flex-1">{q.content}</span>
                      {q.tags && (
                        <span className="text-[10px] bg-muted px-1 py-0.5 rounded shrink-0">{q.tags}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {preview.length > 0 && (
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => { setPreview([]); setErrors([]); }}>
                {t('quiz.imp.reselect')}
              </Button>
              <Button size="sm" className="gap-1" onClick={confirmImport}>
                <Upload className="w-3.5 h-3.5" /> {t('quiz.imp.confirmImport')} ({preview.length})
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
