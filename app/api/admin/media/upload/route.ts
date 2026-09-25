import { NextResponse } from 'next/server';
import { uploadBufferToGCS } from '@/lib/gcs';
import { getMediaAdminUserId } from '@/lib/media/auth';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: Request) {
  const userId = await getMediaAdminUserId();
  if (!userId) return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 });
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: '画像を選択してください' }, { status: 400 });
    if (!TYPES.has(file.type)) return NextResponse.json({ error: 'JPEG、PNG、WebP、GIFのみ使用できます' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: '画像は10MB以下にしてください' }, { status: 400 });
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/gif' ? 'gif' : 'jpg';
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadBufferToGCS(buffer, file.type, `${Date.now()}-${crypto.randomUUID()}.${extension}`, 'media/articles');
    if (!url) throw new Error('画像の保存に失敗しました');
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : '画像をアップロードできませんでした';
    console.error('[admin/media/upload] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
