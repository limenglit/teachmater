import { useState, useRef, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QRActionPanel from '@/components/qr/QRActionPanel';
import { downloadQrPng } from '@/lib/qr-download';
import { getShareOrigin } from '@/lib/share-origin';
import { buildSeatShareTitle, type SeatLookupPayload } from '@/lib/seat-lookup';

interface SeatShareQRProps {
  classLabel: string;
  buildPayload: () => SeatLookupPayload;
  /** Changes whenever seats move, so the next open makes a fresh link. */
  signature: string;
}

export default function SeatShareQR({ classLabel, buildPayload, signature }: SeatShareQRProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setUrl(''); }, [signature]);

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen || url) return;
    const payload = buildPayload();
    if (payload.entries.length === 0) { toast.error('还没有学生就座，请先排座'); setOpen(false); return; }
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('请先登录后再生成二维码'); setOpen(false); return; }
      const title = buildSeatShareTitle(classLabel, new Date().toLocaleDateString());
      const { data, error } = await supabase
        .from('teamwork_sessions')
        .insert([{ type: 'seats', title, data: payload as any, student_count: payload.entries.length, user_id: user.id }])
        .select('id')
        .single();
      if (error) throw error;
      setUrl(`${getShareOrigin()}/seat-lookup/${data.id}`);
    } catch {
      toast.error('生成查座二维码失败，请重试');
      setOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MapPin className="w-4 h-4" /> 扫码查座位
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>学生扫码查询自己的座位</DialogTitle>
        </DialogHeader>
        {generating ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">生成中...</div>
        ) : url ? (
          <QRActionPanel
            url={url}
            qrSize={220}
            qrContainerRef={qrRef}
            scanTip="学生扫码后输入姓氏或点选自己的名字，即可看到座位号和座位图上的位置"
            actions={
              <Button variant="outline" size="sm" onClick={() => downloadQrPng(qrRef, '查座位二维码')}>
                下载二维码
              </Button>
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
