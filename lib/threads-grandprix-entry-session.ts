import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const GRANDPRIX_ENTRY_COOKIE = 'grandprixEntry';
export const GRANDPRIX_ENTRY_MAX_AGE = 2 * 60 * 60;
export type GrandprixEntrySession = { eventId: string; username: string; nonce: string; expiresAt: number };

function secret(): string {
  const value = process.env.THREADS_APP_SECRET;
  if (!value) throw new Error('Threads entry session is not configured');
  return value;
}

export function createGrandprixEntrySession(eventId: string, username: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ eventId, username, nonce: randomUUID(), expiresAt: now + GRANDPRIX_ENTRY_MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}

export function readGrandprixEntrySession(value?: string, now = Date.now()): GrandprixEntrySession | null {
  if (!value || value.length > 2000) return null;
  try {
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra) return null;
    const expected = createHmac('sha256', secret()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const result = JSON.parse(Buffer.from(payload, 'base64url').toString()) as GrandprixEntrySession;
    if (!result.eventId || !result.username || !result.nonce || !Number.isFinite(result.expiresAt) || result.expiresAt <= now) return null;
    return result;
  } catch {
    return null;
  }
}
