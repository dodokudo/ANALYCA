import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  configuredMediaAdminIds,
  createMediaAdminSession,
  MEDIA_ADMIN_SESSION_COOKIE,
  verifyMediaAdminPassword,
} from '@/lib/media/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { password?: string };
    const cookieStore = await cookies();
    const userId = cookieStore.get('analycaUserId')?.value || '';
    if (!configuredMediaAdminIds().has(userId) || !verifyMediaAdminPassword(body.password || '')) {
      return NextResponse.json({ error: 'ログイン情報を確認してください' }, { status: 401 });
    }
    const session = createMediaAdminSession(userId);
    const response = NextResponse.json({ success: true });
    response.cookies.set(MEDIA_ADMIN_SESSION_COOKIE, session.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: session.maxAge,
    });
    return response;
  } catch (error) {
    console.error('[admin/media/session] failed', error);
    return NextResponse.json({ error: '管理画面へログインできませんでした' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(MEDIA_ADMIN_SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
