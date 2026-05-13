import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, QrCode, Users } from 'lucide-react';
import { toast } from 'sonner';

import ClassRosterPicker from '@/components/ClassRosterPicker';
import QRActionPanel from '@/components/qr/QRActionPanel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { downloadSvgAsPng } from '@/lib/qr-download';
import {
  createVocabSession,
  normalizeStudentNames,
  updateVocabSessionStatus,
  type VocabSessionMode,
  type VocabSessionRecord,
} from '@/lib/vocab-session';

interface PublishableSet {
  id: string;
  title: string;
  card_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  set: PublishableSet | null;
}

export default function VocabPublishDialog({ open, onOpenChange, set }: Props) {
  const { user } = useAuth();
  const qrPreviewRef = useRef<HTMLDivElement>(null);
  const [showRoster, setShowRoster] = useState(false);
  const [linkedNames, setLinkedNames] = useState<string[]>([]);
  const [className, setClassName] = useState('');
  const [defaultMode, setDefaultMode] = useState<VocabSessionMode>('match');
  const [publishing, setPublishing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [session, setSession] = useState<VocabSessionRecord | null>(null);

  useEffect(() => {
    if (!open) return;
    setLinkedNames([]);
    setClassName('');
    setDefaultMode('match');
    setSession(null);
    setPublishing(false);
    setEnding(false);
  }, [open, set?.id]);

  const normalizedNames = useMemo(() => normalizeStudentNames(linkedNames), [linkedNames]);
  const submitUrl = session ? `${window.location.origin}/vocab/${session.id}` : '';

  const handlePublish = async () => {
    if (!set) return;
    if (set.card_count < 2) {
      toast.error('至少需要 2 个词条才能生成扫码学习会话');
      return;
    }

    setPublishing(true);
    try {
      const created = await createVocabSession({
        setId: set.id,
        setTitle: set.title,
        studentNames: normalizedNames,
        className,
        defaultMode,
        userId: user?.id,
      });
      setSession(created);
      toast.success('词库学习二维码已生成');
    } catch (error: any) {
      toast.error(error?.message || '生成二维码失败');
    } finally {
      setPublishing(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    setEnding(true);
    try {
      await updateVocabSessionStatus(session.id, session.creator_token, 'ended');
      setSession({ ...session, status: 'ended' });
      toast.success('已结束本次词库学习会话');
    } catch (error: any) {
      toast.error(error?.message || '结束会话失败');
    } finally {
      setEnding(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              词库扫码学习
            </DialogTitle>
            <DialogDescription>
              {set ? `为“${set.title}”生成学生扫码参与的学习二维码。` : '选择词库后可生成学习二维码。'}
            </DialogDescription>
          </DialogHeader>

          {set && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <div className="font-medium text-foreground truncate">{set.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{set.card_count} 个词条</div>
              </div>

              <div className="space-y-2">
                <Label>默认模式</Label>
                <Select value={defaultMode} onValueChange={(value: VocabSessionMode) => setDefaultMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="match">消消乐</SelectItem>
                    <SelectItem value="flash">闪卡</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">学生进入后默认打开该模式，也可以在页面中切换。</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>关联班级名单</Label>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setShowRoster(true)}>
                    <Users className="w-3.5 h-3.5" />
                    {normalizedNames.length > 0 ? '重新选择' : '选择名单'}
                  </Button>
                </div>
                <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  {normalizedNames.length > 0 ? (
                    <>
                      <div className="text-foreground">已关联 {normalizedNames.length} 位学生</div>
                      {className && <div className="mt-1">班级：{className}</div>}
                    </>
                  ) : (
                    <div>未关联名单时，学生扫码后可自行输入姓名进入学习。</div>
                  )}
                </div>
              </div>

              {session && submitUrl && (
                <div className="rounded-xl border border-border bg-background/60">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
                    <span className="text-muted-foreground">状态：{session.status === 'active' ? '进行中' : '已结束'}</span>
                    {session.status === 'active' && (
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleEndSession} disabled={ending}>
                        结束会话
                      </Button>
                    )}
                  </div>
                  <QRActionPanel
                    url={submitUrl}
                    qrSize={200}
                    qrContainerRef={qrPreviewRef}
                    scanTip="学生扫码后先选择自己的姓名，再进入消消乐或闪卡学习。"
                    actions={(
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap"
                          onClick={async () => {
                            await navigator.clipboard.writeText(submitUrl);
                            toast.success('学习链接已复制');
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" /> 复制链接
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap"
                          onClick={async () => {
                            try {
                              const svg = qrPreviewRef.current?.querySelector('svg');
                              if (!svg) throw new Error('QR not ready');
                              await downloadSvgAsPng(svg as SVGSVGElement, `vocab-${session.id}.png`);
                              toast.success('二维码 PNG 已下载');
                            } catch {
                              toast.error('下载 PNG 失败');
                            }
                          }}
                        >
                          <Download className="w-3.5 h-3.5" /> 下载 PNG
                        </Button>
                      </>
                    )}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
            <Button onClick={handlePublish} disabled={!set || publishing || set.card_count < 2}>
              {publishing ? '生成中…' : '生成二维码'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClassRosterPicker
        open={showRoster}
        onOpenChange={setShowRoster}
        currentCount={normalizedNames.length}
        onSelect={(names, meta) => {
          setLinkedNames(names);
          setClassName(meta?.className || '');
        }}
        onClear={() => {
          setLinkedNames([]);
          setClassName('');
        }}
      />
    </>
  );
}