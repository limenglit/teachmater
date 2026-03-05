import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seats: (string | null)[][];
  studentNames: string[];
  sceneConfig: Record<string, unknown>;
}

export default function SeatCheckinDialog({ open, onOpenChange, seats, studentNames, sceneConfig }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkedIn, setCheckedIn] = useState<string[]>([]);

  const createSession = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('seat_checkin_sessions').insert({
        seat_data: seats as unknown as Record<string, unknown>,
        student_names: studentNames as unknown as Record<string, unknown>,
        scene_config: sceneConfig,
      }).select('id').single();

      if (error) throw error;
      setSessionId(data.id);

      // Start polling for check-in records
      const channel = supabase
        .channel(`seat-checkin-${data.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'seat_checkin_records',
          filter: `session_id=eq.${data.id}`,
        }, (payload) => {
          const record = payload.new as { student_name: string };
          setCheckedIn(prev => [...prev, record.student_name]);
        })
        .subscribe();

      // Cleanup on close
      return () => supabase.removeChannel(channel);
    } catch (err) {
      toast({ title: '创建签到失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const checkinUrl = sessionId
    ? `${window.location.origin}/seat-checkin/${sessionId}`
    : '';

  const copyUrl = () => {
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSessionId(null); setCheckedIn([]); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" /> 座位签到
          </DialogTitle>
        </DialogHeader>

        {!sessionId ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              生成签到二维码后，学生扫码输入姓名即可查看自己的座位位置，并获得从门到座位的导航指引。
            </p>
            <Button onClick={createSession} disabled={loading} className="w-full">
              {loading ? '生成中...' : '生成签到码'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-xl">
                <QRCodeSVG value={checkinUrl} size={200} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                readOnly
                value={checkinUrl}
                className="flex-1 text-xs bg-muted px-3 py-2 rounded-md border border-border truncate"
              />
              <Button variant="outline" size="sm" onClick={copyUrl}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-sm font-medium mb-2">
                已签到: {checkedIn.length} / {studentNames.length}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
                {studentNames.map(name => (
                  <span
                    key={name}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      checkedIn.includes(name)
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
