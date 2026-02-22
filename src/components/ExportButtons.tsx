import { useRef } from 'react';
import { Download, FileImage, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToPNG, exportToPDF } from '@/lib/export';
import { toast } from '@/hooks/use-toast';

interface Props {
  targetRef: React.RefObject<HTMLElement>;
  filename: string;
}

export default function ExportButtons({ targetRef, filename }: Props) {
  const handleExport = async (type: 'png' | 'pdf') => {
    if (!targetRef.current) return;
    try {
      if (type === 'png') {
        await exportToPNG(targetRef.current, filename);
      } else {
        await exportToPDF(targetRef.current, filename);
      }
      toast({ title: `已导出为 ${type.toUpperCase()}`, description: `${filename}.${type}` });
    } catch (err) {
      toast({ title: '导出失败', description: '请重试', variant: 'destructive' });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" onClick={() => handleExport('png')} className="gap-1.5 h-8 text-xs">
        <FileImage className="w-3.5 h-3.5" /> PNG
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="gap-1.5 h-8 text-xs">
        <FileText className="w-3.5 h-3.5" /> PDF
      </Button>
    </div>
  );
}
