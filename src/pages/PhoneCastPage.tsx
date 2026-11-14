import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, MonitorUp, RefreshCw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CAST_ICE, CastConnection, castExchange, imageData, photoData, validCastId, type CastRoom } from '@/lib/phone-cast';

export default function PhoneCastPage({ roomId }: { roomId: string }) {
  const [status, setStatus] = useState('正在连接电脑…');
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'camera' | 'screen' | 'photo' | null>(null);
  const [photo, setPhoto] = useState('');
  const [screenSupported, setScreenSupported] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const room = useRef<CastRoom | null>(null);
  const phoneId = useRef('');
  const connection = useRef<CastConnection | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const session = useRef('');
  const frameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wake = useRef<WakeLockSentinel | null>(null);
  const alive = useRef(true);
  const busyRef = useRef(false);
  const fallbackRunning = useRef(false);
  const stopMedia = () => {
    session.current = ''; fallbackRunning.current = false;
    clearTimeout(frameTimer.current); clearTimeout(fallbackTimer.current);
    peer.current?.close(); peer.current = null;
    stream.current?.getTracks().forEach(t => { t.onended = null; t.stop(); }); stream.current = null;
    if (video.current) video.current.srcObject = null;
    void wake.current?.release().catch(() => undefined); wake.current = null;
  };
  const stop = async () => {
    stopMedia(); setMode(null); setPhoto(''); setStatus('已停止投屏');
    await connection.current?.send({ type: 'stop' }).catch(e => setError(e.message));
  };
  const lock = async () => {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wake.current = await navigator.wakeLock.request('screen'); } catch { /* Optional on iOS/WeChat. */ }
  };
  const fallback = (id: string) => {
    if (id !== session.current || fallbackRunning.current) return;
    fallbackRunning.current = true; setStatus('投屏中 · 快照模式');
    const tick = async () => {
      if (id !== session.current || !alive.current) return;
      if (document.visibilityState === 'visible') {
        try {
          const v = video.current;
          if (v && v.videoWidth) {
            await connection.current?.send({ type: 'frame', session: id, data: imageData(v, v.videoWidth, v.videoHeight) });
            if (alive.current) setError('');
          }
        } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : '画面传送失败'); }
      }
      if (id === session.current && alive.current) frameTimer.current = setTimeout(tick, 1500);
    };
    void tick();
  };
  const join = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setJoined(false); setError(''); setStatus('正在连接电脑…');
    stopMedia(); connection.current?.stop();
    const key = window.location.hash.slice(1);
    if (!validCastId(roomId) || !validCastId(key)) {
      setError('投屏链接无效，请扫描电脑上的新二维码。'); setStatus('未连接'); setBusy(false); busyRef.current = false; return;
    }
    const next = { id: roomId, key }; room.current = next;
    try {
      const savedKey = `tm-cast-phone-${roomId}`;
      try { phoneId.current = sessionStorage.getItem(savedKey) || crypto.randomUUID(); sessionStorage.setItem(savedKey, phoneId.current); }
      catch { phoneId.current = crypto.randomUUID(); }
      await castExchange(next, 'phone', 'join', { phoneId: phoneId.current });
      if (!alive.current) return;
      const channel = new CastConnection(next, 'phone', phoneId.current); connection.current = channel;
      const pendingIce: RTCIceCandidateInit[] = [];
      channel.listen(async event => {
        const pc = peer.current;
        if (!pc || event.session !== session.current) return;
        if (event.type === 'answer' && event.sdp) {
          await pc.setRemoteDescription(event.sdp);
          for (const ice of pendingIce.splice(0)) await pc.addIceCandidate(ice).catch(() => undefined);
        } else if (event.type === 'ice' && event.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(event.candidate).catch(() => undefined);
          else if (pendingIce.length < 30) pendingIce.push(event.candidate);
        }
      }, () => {}, e => { setError(e.message); if (/结束|无效/.test(e.message)) { stopMedia(); channel.stop(); setJoined(false); setStatus('电脑已结束投屏'); } });
      setJoined(true); setStatus('电脑已连接');
    } catch (e) { setError(e instanceof Error ? e.message : '连接失败'); setStatus('未连接'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  useEffect(() => {
    alive.current = true;
    setScreenSupported(!!navigator.mediaDevices?.getDisplayMedia);
    void join();
    const visible = () => { if (stream.current && document.visibilityState === 'visible') void lock(); };
    document.addEventListener('visibilitychange', visible);
    const unload = () => { stopMedia(); };
    window.addEventListener('pagehide', unload);
    return () => { alive.current = false; stopMedia(); connection.current?.stop(); document.removeEventListener('visibilitychange', visible); window.removeEventListener('pagehide', unload); };
  }, [roomId]);
  const start = async (kind: 'camera' | 'screen') => {
    if (busyRef.current || !joined) return;
    busyRef.current = true; setBusy(true); setError(''); stopMedia(); setPhoto('');
    // Do not await network work before opening the screen picker: it needs the tap's user activation.
    void connection.current?.send({ type: 'stop' }).catch(() => undefined);
    try {
      if (!navigator.mediaDevices) throw new Error('当前浏览器无法获取画面，请使用照片投屏或在系统浏览器打开。');
      const media = kind === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        : await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 24, max: 30 } }, audio: false });
      if (!alive.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media; setMode(kind); setStatus('正在传送画面…');
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      media.getVideoTracks().forEach(t => { t.onended = () => void stop(); });
      void lock();
      const id = crypto.randomUUID(); session.current = id;
      if (typeof RTCPeerConnection === 'undefined') { fallback(id); return; }
      const pc = new RTCPeerConnection(CAST_ICE); peer.current = pc;
      media.getTracks().forEach(t => pc.addTrack(t, media));
      pc.onicecandidate = e => { if (e.candidate) void connection.current?.send({ type: 'ice', session: id, candidate: e.candidate.toJSON() }).catch(() => fallback(id)); };
      pc.onconnectionstatechange = () => {
        if (session.current !== id) return;
        if (pc.connectionState === 'connected' && !fallbackRunning.current) { clearTimeout(fallbackTimer.current); setStatus('投屏中'); }
        if (['failed', 'disconnected'].includes(pc.connectionState)) fallback(id);
      };
      await pc.setLocalDescription(await pc.createOffer());
      if (pc.localDescription) await connection.current?.send({ type: 'offer', session: id, sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      fallbackTimer.current = setTimeout(() => { if (pc.connectionState !== 'connected') fallback(id); }, 10000);
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (stream.current && session.current) fallback(session.current);
      else {
        stopMedia(); setMode(null); setStatus('画面未开始');
        setError(err.name === 'NotAllowedError' ? '未获得画面权限，请允许摄像头访问，或选择照片投屏。' : err.name === 'NotFoundError' ? '没有找到摄像头，请选择照片投屏。' : err.name === 'NotReadableError' ? '摄像头正在被其他应用占用，请关闭后重试。' : err.message || '无法开启画面，请选择照片投屏。');
      }
    } finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const sendPhoto = async (file: File) => {
    if (!joined || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const data = await photoData(file);
      stopMedia();
      await connection.current?.send({ type: 'stop' });
      await connection.current?.send({ type: 'photo', data });
      setPhoto(data); setMode('photo'); setStatus('照片已发送到电脑');
    } catch (e) { setError(e instanceof Error ? e.message : '照片发送失败，请重试'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); if (input.current) input.current.value = ''; }
  };
  return <main className="cast-phone mx-auto w-full max-w-lg px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
    <header className="mb-5"><p className="text-sm text-muted-foreground mb-1">教创搭子 TeacherMate</p><h1 className="text-2xl font-semibold">手机扫码投屏</h1></header>
    <p role="status" className="text-primary mb-4">{status}</p>
    <div className="cast-stage mb-5">
      <video ref={video} autoPlay playsInline muted className={`cast-media ${mode === 'camera' || mode === 'screen' ? '' : 'hidden'}`} />
      {photo && <img src={photo} alt="待投屏照片" className="cast-media" />}
      {!mode && <Camera className="w-12 h-12 text-muted-foreground" />}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Button className="h-12" disabled={!joined || busy} onClick={() => void start('camera')}><Camera />摄像头投屏</Button>
      <Button className="h-12" variant="outline" disabled={!joined || busy} onClick={() => input.current?.click()}><ImagePlus />照片投屏</Button>
      {screenSupported && <Button className="h-12 col-span-2" variant="outline" disabled={!joined || busy} onClick={() => void start('screen')}><MonitorUp />共享手机屏幕</Button>}
      {mode && <Button className="h-12 col-span-2" variant="outline" disabled={busy} onClick={() => void stop()}><Square />停止投屏</Button>}
    </div>
    <input ref={input} type="file" accept="image/*" className="hidden" aria-label="选择投屏照片" onChange={e => { const file = e.target.files?.[0]; if (file) void sendPhoto(file); }} />
    {busy && <p className="mt-4 text-sm text-muted-foreground" role="status">正在处理，请稍候…</p>}
    {!screenSupported && <p className="mt-5 text-sm text-muted-foreground">此浏览器不支持共享整个手机屏幕，可使用摄像头或照片投屏。</p>}
    {error && <div className="mt-5 space-y-3"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" disabled={busy} onClick={() => void join()}><RefreshCw />重新连接电脑</Button></div>}
  </main>;
}