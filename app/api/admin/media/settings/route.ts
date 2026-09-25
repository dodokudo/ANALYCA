import { NextResponse } from 'next/server';
import { getMediaAdminUserId } from '@/lib/media/auth';
import { getMediaSettings, saveMediaSettings } from '@/lib/media/repository';
import { normalizeMediaSettings } from '@/lib/media/validation';

export async function GET() {
  const userId = await getMediaAdminUserId();
  if (!userId) return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 });
  try {
    return NextResponse.json({ settings: await getMediaSettings() });
  } catch (error) {
    console.error('[admin/media/settings] GET failed', error);
    return NextResponse.json({ error: '設定を取得できませんでした' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userId = await getMediaAdminUserId();
  if (!userId) return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 });
  try {
    const settings = normalizeMediaSettings(await request.json());
    await saveMediaSettings(settings);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[admin/media/settings] PUT failed', error);
    return NextResponse.json({ error: '設定を保存できませんでした' }, { status: 500 });
  }
}
