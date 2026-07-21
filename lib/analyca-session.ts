import crypto from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'analycaSession';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function getSessionSecret(): string {
  const secret = process.env.ANALYCA_SESSION_SECRET;
  if (!secret) {
    throw new Error('ANALYCA_SESSION_SECRET is not configured');
  }
  return secret;
}

function signSessionValue(userId: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${userId}.${expiresAt}`)
    .digest('base64url');
}

export function setAnalycaSessionCookie(response: NextResponse, userId: string): void {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const signature = signSessionValue(userId, expiresAt);
  response.cookies.set(SESSION_COOKIE_NAME, `${userId}.${expiresAt}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function hasValidAnalycaSession(request: NextRequest, expectedUserId: string): boolean {
  const value = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!value) return false;

  const [userId, expiresAtValue, signature] = value.split('.');
  if (!userId || !expiresAtValue || !signature || userId !== expectedUserId) return false;

  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  try {
    const expectedSignature = signSessionValue(userId, expiresAt);
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    return receivedBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
