import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Maximize, Minimize, Pause, Play, RefreshCw, RotateCw, Smartphone, Square, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getShareOrigin } from '@/lib/share-origin';
import { CAST_ICE, CastConnection, castExchange, type CastEvent, type CastRoom } from '@/lib/phone-cast';

export default function PhoneCastTool() {
  const [room, setRoom] = useState<CastRoom | null>(null);
  const [status, setStatus] = useState('正在建立通道…');
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const connection = useRef<CastConnection | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const session = useRef('');
  const generation = useRef(0);
  const currentRoom = useRef<CastRoom | null>(null);
  const pausedRef = useRef(false);
  const latestPicture = useRef('');

  const end = async () => {
    generation.current++;
    connection.current?.stop(); connection.current = null;
    peer.current?.close(); peer.current = null;
    const old = currentRoom.current; currentRoom.current = null;
    setRoom(null); setStream(null); setPhoto(''); latestPicture.current = '';
    setPaused(false); pausedRef.current = false; setStatus('投屏已结束');
    if (old) await castExchange(old, 'host', 'close').catch(() => undefined);
  };
  const create = async () => {
    setBusy(true); setError('');
    await end();
    const run = generation.current;
    setStatus('正在建立通道…');
    const next = { id: crypto.randomUUID(), key: crypto.randomUUID(), phoneKey: crypto.randomUUID() };
    try {
      await castExchange(next, 'host', 'create', { phoneKey: next.phoneKey });
      if (run !== generation.current) { void castExchange(next, 'host', 'close').catch(() => undefined); return; }
      currentRoom.current = next; setRoom(next); setStatus('等待手机连接');
      const channel = new CastConnection(next, 'host'); connection.current = channel;
      const pending = new Map<string, RTCIceCandidateInit[]>();
      const receive = async (event: CastEvent) => {
        setError('');
        if (event.type === 'photo' || event.type === 'frame') {
          if (!event.data) return;
          latestPicture.current = event.data;
          if (!pausedRef.current) setPhoto(event.data);
          setStatus(event.type === 'photo' ? '照片已投屏' : '投屏中 · 快照模式');
        } else if (event.type === 'stop') {
          peer.current?.close(); peer.current = null; session.current = '';
          setStream(null); setPhoto(''); latestPicture.current = ''; setStatus('手机已停止投屏');
        } else if (event.type === 'offer' && event.sdp && event.session) {
          peer.current?.close();
          session.current = event.session;
          const pc = new RTCPeerConnection(CAST_ICE); peer.current = pc;
          setPhoto(''); latestPicture.current = ''; setStatus('正在连接画面…');
          pc.ontrack = (e) => { setStream(e.streams[0] || new MediaStream([e.track])); setStatus('投屏中'); };
          pc.onicecandidate = (e) => { if (e.candidate) void channel.send({ type: 'ice', session: event.session, candidate: e.candidate.toJSON() }).catch(() => setError('连接不稳，正在等待手机快照。')); };
          pc.onconnectionstatechange = () => {
            if (peer.current !== pc) return;
            if (pc.connectionState === 'connected') setStatus('投屏中');
            if (['failed', 'disconnected'].includes(pc.connectionState)) setStatus('连接不稳 · 等待快照');
          };
          await pc.setRemoteDescription(event.sdp);
          for (const ice of pending.get(event.session) || []) await pc.addIceCandidate(ice).catch(() => undefined);
          pending.clear();
          await pc.setLocalDescription(await pc.createAnswer());
          if (pc.localDescription) await channel.send({ type: 'answer', session: event.session, sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
        } else if (event.type === 'ice' && event.candidate && event.session) {
          const pc = peer.current;
          if (pc?.remoteDescription && event.session === session.current) await pc.addIceCandidate(event.candidate).catch(() => undefined);
          else pending.set(event.session, [...(pending.get(event.session) || []), event.candidate].slice(-30));
        }
      };
      let wasConnected = false;
      channel.listen(receive, connected => {
        if (connected) { wasConnected = true; setStatus(s => ['等待手机连接', '手机连接已断开'].includes(s) ? '手机已连接 · 等待画面' : s); }
        else if (wasConnected) setStatus('手机连接已断开');
      }, e => { setError(e.message); if (/结束|无效/.test(e.message)) { channel.stop(); peer.current?.close(); setStatus('投屏通道已结束'); } });
    } catch (e) { setError(e instanceof Error ? e.message : '建立通道失败'); setStatus('通道未建立'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    void create();
    return () => {
      generation.current++; connection.current?.stop(); peer.current?.close();
      if (currentRoom.current) void castExchange(currentRoom.current, 'host', 'close').catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    if (!video.current) return;
    video.current.srcObject = stream;
    if (paused) video.current.pause();
    else if (stream) void video.current.play().catch(() => setError('请点击播放以显示画面。'));
  }, [stream, fullscreen, photo]);
  useEffect(() => {
    if (!fullscreen) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [fullscreen]);
  const togglePause = () => {
    const value = !paused; setPaused(value); pausedRef.current = value;
    if (value) video.current?.pause();
    else { if (latestPicture.current) setPhoto(latestPicture.current); void video.current?.play().catch(() => undefined); }
  };
  const capture = () => {
    try {
      const source = photo ? picture.current : video.current;
      if (!source) return;
      const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
      const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
      if (!width || !height) throw new Error('画面尚未准备好');
      const canvas = document.createElement('canvas');
      canvas.width = rotation % 180 ? height : width; canvas.height = rotation % 180 ? width : height;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(source, -width / 2, -height / 2, width, height);
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `手机投屏-${Date.now()}.png`; a.click();
    } catch { setError('截图失败，请等待画面加载完成。'); }
  };
  const url = room ? `${getShareOrigin()}/phone-cast/${room.id}#${room.phoneKey}` : '';
  const controls = <div className="flex flex-wrap items-center justify-center gap-2">
    <Button variant="secondary" size="icon" title={paused ? '恢复画面' : '暂停画面'} aria-label={paused ? '恢复画面' : '暂停画面'} onClick={togglePause} disabled={!stream && !photo}>{paused ? <Play /> : <Pause />}</Button>
    <Button variant="secondary" size="icon" title="旋转90度" aria-label="旋转90度" onClick={() => setRotation(r => (r + 90) % 360)}><RotateCw /></Button>
    <Button variant="secondary" size="icon" title="保存截图" aria-label="保存截图" disabled={!stream && !photo} onClick={capture}><Download /></Button>
    <label className="flex items-center gap-2 text-sm">缩放<input aria-label="画面缩放" type="range" min="1" max="3" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-24 accent-primary" /></label>
    <Button variant="secondary" size="icon" title={fullscreen ? '退出全屏' : '全屏展示'} aria-label={fullscreen ? '退出全屏' : '全屏展示'} onClick={() => setFullscreen(f => !f)}>{fullscreen ? <Minimize /> : <Maximize />}</Button>
  </div>;
  const display = <div className={`cast-stage ${fullscreen ? 'cast-stage-full' : ''}`}>
    {photo ? <img ref={picture} src={photo} alt="手机投屏照片" className={`cast-media cast-turn-${rotation}`} style={{ scale: String(zoom) }} /> : stream ? <video ref={video} autoPlay playsInline muted className={`cast-media cast-turn-${rotation}`} style={{ scale: String(zoom) }} /> : <div className="flex flex-col items-center gap-3 text-muted-foreground"><Smartphone className="h-12 w-12" /><p>{status}</p></div>}
  </div>;
  if (fullscreen) return <div className="fixed inset-0 z-[120] bg-background flex flex-col p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
    <div className="flex items-center justify-between gap-2 pb-3"><p role="status">{paused ? '已暂停' : status}</p><Button variant="ghost" onClick={() => setFullscreen(false)}><Minimize />退出全屏</Button></div>
    {display}<div className="pt-3">{controls}</div>{error && <p role="alert" className="text-destructive text-center">{error}</p>}
  </div>;
  return <div className="space-y-4">
    <p role="status" className="text-primary">{paused ? '已暂停' : status}</p>
    {display}{controls}
    {url && <div className="flex flex-wrap items-center justify-center gap-5 border-t border-border pt-4">
      <div className="cast-qr"><QRCodeSVG value={url} size={160} marginSize={2} /></div>
      <div className="space-y-3 text-center"><p className="font-medium">手机扫码投屏</p><Button variant="outline" data-phone-link={url} onClick={async () => {
        try { await navigator.clipboard.writeText(url); setStatus('链接已复制'); } catch { setError('无法自动复制，请用手机扫描二维码。'); }
      }}><Copy />复制手机链接</Button></div>
    </div>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-center gap-2"><Button variant="outline" disabled={busy} onClick={() => void create()}><RefreshCw />{room ? '重新生成二维码' : '建立投屏通道'}</Button><Button variant="outline" disabled={!room || busy} onClick={() => void end()}><Square />结束投屏</Button></div>
  </div>;
}