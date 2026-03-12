import { useState } from 'react';
import { FileImage, FileText, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportToPNG, exportToPDF, exportToSVG } from '@/lib/export';
import { toast } from '@/hooks/use-toast';

interface Props {
  targetRef: React.RefObject<HTMLElement>;
  filename: string;
  resolveQrCode?: () => Promise<{ value: string; className?: string } | null>;
}

export default function ExportButtons({ targetRef, filename, resolveQrCode }: Props) {
  const [customTitle, setCustomTitle] = useState('');

  const getExportTitle = () => {
    const trimmed = customTitle.trim();
    return trimmed.length > 0 ? trimmed : filename;
  };

  const handleExport = async (type: 'png' | 'pdf' | 'svg') => {
    if (!targetRef.current) return;
    const exportTitle = getExportTitle();
    try {
      const qrCode = (type === 'png' || type === 'pdf') && resolveQrCode
        ? await resolveQrCode()
        : null;

      if (type === 'png') {
        await exportToPNG(targetRef.current, exportTitle, exportTitle, qrCode ? { qrCode } : undefined);
      } else if (type === 'pdf') {
        await exportToPDF(targetRef.current, exportTitle, exportTitle, qrCode ? { qrCode } : undefined);
      } else {
        await exportToSVG(targetRef.current, exportTitle, exportTitle);
      }
      toast({ title: `已导出为 ${type.toUpperCase()}`, description: `${exportTitle}.${type}` });
    } catch (err) {
      toast({ title: '导出失败', description: '请重试', variant: 'destructive' });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={customTitle}
        onChange={e => setCustomTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!customTitle.trim()) {
              setCustomTitle(filename);
            }
          }
        }}
        placeholder={`导出名称（回车缺省：${filename}）`}
        className="h-8 w-64 text-xs"
      />
      <Button variant="outline" size="sm" onClick={() => handleExport('png')} className="gap-1.5 h-8 text-xs">
        <FileImage className="w-3.5 h-3.5" /> PNG
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport('svg')} className="gap-1.5 h-8 text-xs">
        <FileCode className="w-3.5 h-3.5" /> SVG
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="gap-1.5 h-8 text-xs">
        <FileText className="w-3.5 h-3.5" /> PDF
      </Button>
    </div>
  );
}
