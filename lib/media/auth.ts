import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const DEFAULT_ADMIN_USER_IDS = ['10012809578833342'];
const SESSION_COOKIE = 'analycaMediaAdmin';
const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function configuredMediaAdminIds(): Set<string> {
  const configured = (process.env.MEDIA_ADMIN_USER_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : DEFAULT_ADMIN_USER_IDS);
}

function sessionSecret(): string {
  return process.env.MEDIA_ADMIN_SESSION_SECRET
    || process.env.MEDIA_ADMIN_PASSWORD
    || process.env.ADMIN_PASSWORD
    || process.env.INSTAGRAM_APP_SECRET
    || process.env.THREADS_APP_SECRET
    || '';
}

function sessionSignature(userId: string, expiresAt: string): string {
  return createHmac('sha256', sessionSecret()).update(`${userId}.${expiresAt}`).digest('base64url');
}

export function createMediaAdminSession(userId: string): { value: string; maxAge: number } {
  if (!configuredMediaAdminIds().has(userId)) throw new Error('MEDIA_ADMIN_UNAUTHORIZED');
  if (!sessionSecret()) throw new Error('MEDIA_ADMIN_SESSION_SECRET is not configured');
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  return { value: `${userId}.${expiresAt}.${sessionSignature(userId, expiresAt)}`, maxAge: SESSION_TTL_SECONDS };
}

function validSession(value: string, expectedUserId: string): boolean {
  const [userId, expiresAt, supplied] = value.split('.');
  if (!userId || !expiresAt || !supplied || userId !== expectedUserId) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000) || !sessionSecret()) return false;
  const expected = sessionSignature(userId, expiresAt);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function verifyMediaAdminPassword(password: string): boolean {
  const expected = process.env.MEDIA_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  if (!password || !expected) return false;
  const suppliedBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export const MEDIA_ADMIN_SESSION_COOKIE = SESSION_COOKIE;

export async function isMediaAdmin(): Promise<boolean> {
  return Boolean(await getMediaAdminUserId());
}

export async function getMediaAdminUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get('analycaUserId')?.value || '';
  const session = cookieStore.get(SESSION_COOKIE)?.value || '';
  return configuredMediaAdminIds().has(userId) && validSession(session, userId) ? userId : null;
}

export async function assertMediaAdmin(): Promise<void> {
  if (!(await isMediaAdmin())) {
    throw new Error('MEDIA_ADMIN_UNAUTHORIZED');
  }
}
