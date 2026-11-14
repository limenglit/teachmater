import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CastConnection, castExchange, photoData } from './phone-cast';
import { studentSupabase } from './student-supabase';
vi.mock('./student-supabase', () => ({ studentSupabase: { rpc: vi.fn() } }));
const room = { id: '00000000-0000-4000-8000-000000000001', key: '00000000-0000-4000-8000-000000000002' };
describe('phone casting', () => {
  beforeEach(() => vi.mocked(studentSupabase.rpc).mockReset());
  it('sends only the selected endpoint capability and the claimed phone identity', async () => {
    vi.mocked(studentSupabase.rpc).mockResolvedValue({ data: {}, error: null });
    const c = new CastConnection(room, 'phone', 'claimed-phone');
    await c.send({ type: 'stop' });
    expect(studentSupabase.rpc).toHaveBeenCalledWith('phone_cast_exchange', {
      p_room: room.id, p_key: room.key, p_role: 'phone', p_action: 'send', p_payload: { phoneId: 'claimed-phone', event: { type: 'stop' } },
    });
    c.stop();
    await c.send({ type: 'stop' });
    expect(studentSupabase.rpc).toHaveBeenCalledTimes(1);
  });
  it('serializes signaling so an offer cannot overtake earlier candidates', async () => {
    let release: ((value: { data: {}; error: null }) => void) | undefined;
    vi.mocked(studentSupabase.rpc).mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValue({ data: {}, error: null });
    const c = new CastConnection(room, 'phone', 'claimed-phone');
    const first = c.send({ type: 'ice' }); const second = c.send({ type: 'offer' });
    await Promise.resolve();
    expect(studentSupabase.rpc).toHaveBeenCalledTimes(1);
    release?.({ data: {}, error: null }); await Promise.all([first, second]);
    expect(studentSupabase.rpc).toHaveBeenCalledTimes(2);
  });
  it('surfaces room takeover and revoked-room failures', async () => {
    vi.mocked(studentSupabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Room busy' } });
    await expect(castExchange(room, 'phone', 'join')).rejects.toThrow('已有另一台手机');
    vi.mocked(studentSupabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'Room expired' } });
    await expect(castExchange(room, 'phone', 'read')).rejects.toThrow('投屏通道已结束');
  });
  it('rejects non-image uploads before decoding', async () => {
    await expect(photoData(new File(['text'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow('请选择照片');
  });
});