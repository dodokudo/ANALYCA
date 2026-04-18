import { NextRequest, NextResponse } from 'next/server';
import { listNotificationsForUser, markAllNotificationsRead, markNotificationRead } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const items = await listNotificationsForUser(userId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[notifications] GET failed', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const payload = await request.json().catch(() => ({}));
    const { notificationId, markAll } = (payload ?? {}) as { notificationId?: string; markAll?: boolean };
    if (markAll) {
      await markAllNotificationsRead(userId);
    } else if (notificationId) {
      await markNotificationRead(userId, notificationId);
    } else {
      return NextResponse.json({ error: 'notificationId or markAll required' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[notifications] POST failed', error);
    return NextResponse.json({ error: 'Failed to mark notification' }, { status: 500 });
  }
}
