import { NextResponse } from 'next/server';
import { getMediaAdminUserId } from '@/lib/media/auth';
import { createMediaArticle, getMediaOverview, getMediaSettings, listMediaArticles } from '@/lib/media/repository';
import { normalizeMediaArticleInput } from '@/lib/media/validation';

export async function GET() {
  const userId = await getMediaAdminUserId();
  if (!userId) return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 });
  try {
    const [articles, overview] = await Promise.all([listMediaArticles({ limit: 100 }), getMediaOverview()]);
    return NextResponse.json({ articles, overview });
  } catch (error) {
    console.error('[admin/media/articles] GET failed', error);
    return NextResponse.json({ error: '記事一覧を取得できませんでした' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getMediaAdminUserId();
  if (!userId) return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 });
  try {
    const raw = await request.json();
    const settings = await getMediaSettings();
    const input = normalizeMediaArticleInput({
      ...raw,
      status: 'draft',
      authorName: raw.authorName || settings.authorName,
      authorBio: raw.authorBio || settings.authorBio,
    });
    const article = await createMediaArticle(input, userId);
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '記事を作成できませんでした';
    console.error('[admin/media/articles] POST failed', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
