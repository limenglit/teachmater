import { useState, useRef } from 'react';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QRActionPanel from '@/components/qr/QRActionPanel';
import { downloadQrPng } from '@/lib/qr-download';

interface GenericTeam {
  id: string;
  name: string;
  members: { id: string; name: string; isCaptain?: boolean; isLeader?: boolean }[];
}

interface TeamShareQRProps {
  teams: GenericTeam[];
  type: 'teams' | 'groups';
}

export default function TeamShareQR({ teams, type }: TeamShareQRProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const label = type === 'teams' ? '建队' : '分组';

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !url) {
      setGenerating(true);
      try {
        const studentCount = teams.reduce((s, t) => s + t.members.length, 0);
        const title = `${teams.length}个${type === 'teams' ? '队' : '组'} · ${new Date().toLocaleDateString()}`;
        const normalized = teams.map(t => ({
          ...t,
          members: t.members.map(m => ({
            id: m.id,
            name: m.name,
            isCaptain: !!(m.isCaptain || m.isLeader),
          })),
        }));
        const { data, error } = await supabase
          .from('teamwork_sessions')
          .insert([{ type, title, data: normalized as any, student_count: studentCount }])
          .select('id')
          .single();
        if (error) throw error;
        const base = window.location.origin;
        setUrl(`${base}/team-lookup/${data.id}`);
      } catch {
        toast.error('生成分享链接失败');
        setOpen(false);
      } finally {
        setGenerating(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">扫码查{type === 'teams' ? '队' : '组'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>学生扫码查询{label}结果</DialogTitle>
        </DialogHeader>
        {generating ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">生成中...</div>
        ) : url ? (
          <QRActionPanel
            url={url}
            qrSize={220}
            qrContainerRef={qrRef}
            scanTip="学生扫码后输入姓名，即可查看自己所在的组/队、组长/队长及全部成员"
            actions={
              <Button variant="outline" size="sm" onClick={() => downloadQrPng(qrRef, `${label}二维码`)}>
                下载二维码
              </Button>
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
