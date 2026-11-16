import { studentSupabase } from '@/lib/student-supabase';

export type CastRole = 'host' | 'phone';
export type CastEvent = { type: 'offer' | 'answer' | 'ice' | 'stop' | 'photo' | 'frame'; session?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; data?: string };
export type CastRoom = { id: string; key: string; phoneKey?: string };
type Exchange = { connected?: boolean; events?: { seq: number; event: CastEvent }[]; picture?: CastEvent; pictureSeq?: number };

export const validCastId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export const CAST_ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] };

export async function castExchange(room: CastRoom, role: CastRole, action: string, payload: Record<string, unknown> = {}): Promise<Exchange> {
  const result = await studentSupabase.rpc<Exchange>('phone_cast_exchange', {
    p_room: room.id, p_key: room.key, p_role: role, p_action: action, p_payload: payload,
  });
  if (result.error) {
    const msg = result.error.message;
    if (/busy/i.test(msg)) throw new Error('已有另一台手机连接，请让电脑重新生成二维码。');
    if (/expired|forbidden/i.test(msg)) throw new Error('投屏通道已结束或链接无效，请重新扫码。');
    throw new Error('连接失败，请检查网络后重试。');
  }
  return result.data || {};
}

/** Sequential polling is deliberately used for capability-protected, anonymous rooms.
 * No public realtime topic exposes images/SDP, and signaling still works without websockets. */
export class CastConnection {
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private after = 0;
  private afterPicture = 0;
  private sendQueue: Promise<unknown> = Promise.resolve();
  constructor(public room: CastRoom, public role: CastRole, private phoneId?: string) {}
  private payload(extra: Record<string, unknown>) { return { ...extra, ...(this.phoneId ? { phoneId: this.phoneId } : {}) }; }
  send(event: CastEvent) {
    const work = () => {
      if (this.stopped) return Promise.resolve({});
      return castExchange(this.room, this.role, 'send', this.payload({ event }));
    };
    const next = this.sendQueue.then(work, work);
    this.sendQueue = next.catch(() => undefined);
    return next;
  }
  listen(onEvent: (e: CastEvent) => Promise<void> | void, onState: (connected: boolean) => void, onError: (e: Error) => void) {
    const poll = async () => {
      if (this.stopped) return;
      try {
        const data = await castExchange(this.room, this.role, 'read', this.payload({ after: this.after, afterPicture: this.afterPicture }));
        if (this.stopped) return;
        onState(!!data.connected);
        for (const row of data.events || []) {
          await onEvent(row.event);
          this.after = Math.max(this.after, row.seq);
        }
        if (data.picture) await onEvent(data.picture);
        this.afterPicture = data.pictureSeq || this.afterPicture;
      } catch (e) { if (!this.stopped) onError(e instanceof Error ? e : new Error('连接中断')); }
      if (!this.stopped) this.timer = setTimeout(poll, 1000);
    };
    void poll();
  }
  stop() { this.stopped = true; clearTimeout(this.timer); }
}

export async function photoData(file: File): Promise<string> {
  if (file.size > 25 * 1024 * 1024) throw new Error('照片过大，请选择小于25MB的图片。');
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name)) throw new Error('请选择照片。');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('照片读取超时，请改用JPG照片。')), 8000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('此照片格式无法读取，请改用JPG或PNG照片。')); };
      image.src = url;
    });
    return imageData(image, image.naturalWidth, image.naturalHeight, 1600);
  } finally { URL.revokeObjectURL(url); }
}

export function imageData(source: CanvasImageSource, width: number, height: number, max = 960): string {
  if (!width || !height) throw new Error('画面尚未准备好');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, max / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('此浏览器无法处理图片');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.65, 0.45, 0.25]) {
    const data = canvas.toDataURL('image/jpeg', quality);
    if (data.length < 800000) return data;
  }
  throw new Error('图片过于复杂，请缩小后重试。');
}
export type CastKind = 'camera' | 'screen';
/** Encoder targets: camera favours smooth motion, screen favours sharp text at lower fps. */
export const CAST_ENCODING: Record<CastKind, { maxBitrate: number; maxFramerate: number; hint: string; degradation: RTCDegradationPreference }> = {
  camera: { maxBitrate: 2_500_000, maxFramerate: 30, hint: 'motion', degradation: 'maintain-framerate' },
  screen: { maxBitrate: 3_000_000, maxFramerate: 20, hint: 'detail', degradation: 'maintain-resolution' },
};

/** Put hardware-friendly codecs (H.264, then VP8) first so phones and PCs encode/decode with less CPU. */
export function preferCastCodecs(pc: RTCPeerConnection) {
  const caps = typeof RTCRtpSender !== 'undefined' && RTCRtpSender.getCapabilities?.('video');
  if (!caps) return;
  const rank = (m: string) => (/h264/i.test(m) ? 0 : /vp8/i.test(m) ? 1 : 2);
  const codecs = [...caps.codecs].sort((a, b) => rank(a.mimeType) - rank(b.mimeType));
  for (const t of pc.getTransceivers()) {
    if (t.sender.track?.kind !== 'video') continue;
    try { t.setCodecPreferences?.(codecs); } catch { /* unsupported */ }
  }
}

/** Apply bitrate/framerate caps to video senders; safe to call repeatedly (e.g. once connected). */
export async function tuneCastSender(pc: RTCPeerConnection, kind: CastKind) {
  const cfg = CAST_ENCODING[kind];
  for (const sender of pc.getSenders()) {
    const track = sender.track;
    if (!track || track.kind !== 'video') continue;
    try { (track as MediaStreamTrack & { contentHint: string }).contentHint = cfg.hint; } catch { /* ignore */ }
    try {
      const p = sender.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = cfg.maxBitrate;
      p.encodings[0].maxFramerate = cfg.maxFramerate;
      (p as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = cfg.degradation;
      await sender.setParameters(p);
    } catch { /* older WebKit: keep defaults */ }
  }
}

/** Keep the receiver jitter buffer short so the big screen stays close to live. */
export function tuneCastReceiver(receiver: RTCRtpReceiver) {
  const r = receiver as RTCRtpReceiver & { jitterBufferTarget?: number | null; playoutDelayHint?: number };
  try { r.jitterBufferTarget = 80; r.playoutDelayHint = 0.08; } catch { /* ignore */ }
}
