import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const GRANDPRIX_LOGIN_COOKIE = 'grandprixLogin';
export const GRANDPRIX_LOGIN_MAX_AGE = 2 * 60 * 60;
type LoginSession = { eventId: string; nonce: string; expiresAt: number };

function sign(payload: string): Buffer {
  const secret = process.env.THREADS_APP_SECRET;
  if (!secret) throw new Error('Threads login is not configured.');
  return createHmac('sha256', secret).update(`grandprix-login.${payload}`).digest();
}

export function createGrandprixLoginSession(eventId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ eventId, nonce: randomUUID(), expiresAt: now + GRANDPRIX_LOGIN_MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${sign(payload).toString('base64url')}`;
}

export function readGrandprixLoginSession(value?: string, now = Date.now()): LoginSession | null {
  if (!value || value.length > 2000) return null;
  try {
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra) return null;
    const expected = sign(payload);
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as LoginSession;
    return typeof session.eventId === 'string' && session.nonce && Number.isFinite(session.expiresAt) && session.expiresAt > now ? session : null;
  } catch { return null; }
}
