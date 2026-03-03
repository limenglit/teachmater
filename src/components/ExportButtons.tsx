import { useRef, useState } from 'react';
import { Download, FileImage, FileText, Print, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { exportToPNG, exportToPDF, exportToPrint, elementToDataURL } from '@/lib/export';
import { toast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  targetRef: React.RefObject<HTMLElement>;
  filename: string;
}

export default function ExportButtons({ targetRef, filename }: Props) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrValue, setQrValue] = useState('');

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

  const handlePrint = () => {
    if (!targetRef.current) return;
    exportToPrint(targetRef.current);
  };

  const handleShare = async () => {
    if (!targetRef.current) return;
    try {
      const dataUrl = await elementToDataURL(targetRef.current);
      setQrValue(dataUrl);
      setQrOpen(true);
    } catch (err) {
      toast({ title: '分享失败', description: '请重试', variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={() => handleExport('png')} className="gap-1.5 h-8 text-xs">
          <FileImage className="w-3.5 h-3.5" /> PNG
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="gap-1.5 h-8 text-xs">
          <FileText className="w-3.5 h-3.5" /> PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 h-8 text-xs">
          <Print className="w-3.5 h-3.5" /> 打印
        </Button>
        <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 h-8 text-xs">
          <QrCode className="w-3.5 h-3.5" /> 分享
        </Button>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分享二维码</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 p-4">
            {qrValue && <QRCodeSVG value={qrValue} size={200} />}
            <p className="text-xs break-all">长按二维码可保存或打开链接</p>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setQrOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
