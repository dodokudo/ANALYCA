import { NextResponse } from 'next/server';
import { getMediaAdminUserId } from '@/lib/media/auth';
import { getMediaArticleById, listMediaRevisions, updateMediaArticle } from '@/lib/media/repository';
import type { MediaArticleStatus } from '@/lib/media/types';
import { normalizeMediaArticleInput, validatePublishableArticle } from '@/lib/media/validation';

const transitions: Record<MediaArticleStatus, Set<MediaArticleStatus>> = {
  draft: new Set(['draft', 'review', 'archived']),
  review: new Set(['review', 'draft', 'approved', 'archived']),
  approved: new Set(['approved', 'review', 'scheduled', 'published', 'archived']),
  scheduled: new Set(['scheduled', 'approved', 'published', 'archived']),
  published: new Set(['published', 'archived']),
  archived: new Set(['archived', 'draft']),
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getMediaAdminUserId();
  if (!userId) return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 });
  const { id } = await params;
  try {
    const [article, revisions] = await Promise.all([getMediaArticleById(id), listMediaRevisions(id)]);
    if (!article) return NextResponse.json({ error: '記事が見つかりません' }, { status: 404 });
    return NextResponse.json({ article, revisions });
  } catch (error) {
    console.error('[admin/media/articles/:id] GET failed', error);
    return NextResponse.json({ error: '記事を取得できませんでした' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getMediaAdminUserId();
  if (!userId) return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json() as { article?: unknown; expectedRevision?: number };
    const current = await getMediaArticleById(id);
    if (!current) return NextResponse.json({ error: '記事が見つかりません' }, { status: 404 });
    const input = normalizeMediaArticleInput(body.article);
    if (!transitions[current.status].has(input.status)) {
      return NextResponse.json({ error: `${current.status}から${input.status}へは変更できません` }, { status: 409 });
    }
    if (input.status === 'approved' || input.status === 'scheduled' || input.status === 'published') {
      const errors = validatePublishableArticle(input);
      if (errors.length > 0) return NextResponse.json({ error: errors.join('、') }, { status: 400 });
    }
    const article = await updateMediaArticle(id, input, userId, body.expectedRevision);
    return NextResponse.json({ article });
  } catch (error) {
    const message = error instanceof Error ? error.message : '記事を更新できませんでした';
    const status = message.includes('別の更新') ? 409 : 400;
    console.error('[admin/media/articles/:id] PUT failed', error);
    return NextResponse.json({ error: message }, { status });
  }
}
