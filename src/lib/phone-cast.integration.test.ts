import { afterEach, describe, expect, it } from 'vitest';
import { loadEnv } from 'vite';
import { randomUUID } from 'node:crypto';

const env = loadEnv('development', process.cwd(), 'VITE_');
const rooms: { id: string; key: string }[] = [];
async function exchange(id: string, key: string | null, role: string, action: string, payload: unknown = {}) {
  return fetch('http://localhost:8080/api/public/sb/rest/v1/rpc/phone_cast_exchange', {
    method: 'POST', headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_room: id, p_key: key, p_role: role, p_action: action, p_payload: payload }),
  });
}
async function create() {
  const r = { id: randomUUID(), key: randomUUID(), phone: randomUUID() };
  expect((await exchange(r.id, r.key, 'host', 'create', { phoneKey: r.phone })).ok).toBe(true);
  rooms.push(r); return r;
}
afterEach(async () => { for (const r of rooms.splice(0)) await exchange(r.id, r.key, 'host', 'close'); });
describe('real phone casting room permissions', () => {
  it('only the claimed phone can send; a second phone cannot take over', async () => {
    const r = await create(); const phoneId = randomUUID();
    expect((await exchange(r.id, r.phone, 'phone', 'join', { phoneId })).ok).toBe(true);
    expect((await exchange(r.id, r.phone, 'phone', 'join', { phoneId: randomUUID() })).ok).toBe(false);
    expect((await exchange(r.id, r.phone, 'phone', 'send', { phoneId: randomUUID(), event: { type: 'stop' } })).ok).toBe(false);
    expect((await exchange(r.id, r.phone, 'phone', 'send', { phoneId, event: { type: 'stop' } })).ok).toBe(true);
  }, 30000);
  it('wrong or null keys cannot read images or signaling', async () => {
    const r = await create();
    expect((await exchange(r.id, randomUUID(), 'host', 'read')).ok).toBe(false);
    expect((await exchange(r.id, null, 'host', 'read')).ok).toBe(false);
    expect((await exchange(r.id, r.phone, 'host', 'read')).ok).toBe(false);
  }, 30000);
  it('ending the room immediately revokes phone access', async () => {
    const r = await create(); const phoneId = randomUUID();
    expect((await exchange(r.id, r.phone, 'phone', 'join', { phoneId })).ok).toBe(true);
    expect((await exchange(r.id, r.key, 'host', 'close')).ok).toBe(true);
    expect((await exchange(r.id, r.phone, 'phone', 'read', { phoneId })).ok).toBe(false);
  }, 30000);
});