import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const THREADS_REAUTH_COOKIE = 'threadsReauth';
export const THREADS_REAUTH_MAX_AGE = 30 * 60;
export type ThreadsReauthSession = {
  userId: string;
  threadsUserId: string;
  returnTo: string;
  nonce: string;
  expiresAt: number;
};

export function threadsReauthReturnTo(userId: string, value?: string | null): string {
  const fallback = `/${encodeURIComponent(userId)}?tab=threads`;
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    const url = new URL(value, 'https://analyca.jp');
    if (url.origin !== 'https://analyca.jp' || url.pathname !== `/${encodeURIComponent(userId)}`) return fallback;
    for (const key of ['auth', 'syncing', 'reauth', 'code', 'state', 'error']) url.searchParams.delete(key);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

function sign(payload: string): Buffer {
  const secret = process.env.THREADS_APP_SECRET;
  if (!secret) throw new Error('Threads login is not configured.');
  return createHmac('sha256', secret).update(`threads-reauth.${payload}`).digest();
}

export function createThreadsReauthSession(userId: string, threadsUserId: string, returnTo?: string | null, now = Date.now()): string {
  const session: ThreadsReauthSession = {
    userId, threadsUserId, returnTo: threadsReauthReturnTo(userId, returnTo),
    nonce: randomUUID(), expiresAt: now + THREADS_REAUTH_MAX_AGE * 1000,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload).toString('base64url')}`;
}

export function readThreadsReauthSession(value?: string, now = Date.now()): ThreadsReauthSession | null {
  if (!value || value.length > 6000) return null;
  try {
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra) return null;
    const expected = sign(payload);
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ThreadsReauthSession;
    if (!session.userId || !session.threadsUserId || !session.nonce || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) return null;
    if (threadsReauthReturnTo(session.userId, session.returnTo) !== session.returnTo) return null;
    return session;
  } catch { return null; }
}
