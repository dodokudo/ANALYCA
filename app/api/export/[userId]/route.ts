import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getUserDashboardData } from '@/lib/bigquery';

type ExportType = 'account-insights' | 'posts';

type CsvValue = string | number | boolean | null | undefined;

function serializeValue(value: unknown): CsvValue {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'value' in value) {
    return serializeValue((value as { value: unknown }).value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function escapeCsv(value: CsvValue): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

function buildAccountInsightsCsv(data: Awaited<ReturnType<typeof getUserDashboardData>>): string {
  const headers = [
    'channel',
    'date',
    'followers_count',
    'follower_delta',
    'posts_count',
    'post_count',
    'reach',
    'engagement',
    'profile_views',
    'website_clicks',
    'total_views',
    'total_likes',
    'total_replies',
  ];

  const instagramRows = data.insights.map((insight) => [
    'instagram',
    serializeValue(insight.date),
    insight.followers_count,
    '',
    insight.posts_count,
    '',
    insight.reach,
    insight.engagement,
    insight.profile_views,
    insight.website_clicks,
    '',
    '',
    '',
  ]);

  const threadsRows = data.threadsDailyMetrics.map((metric) => [
    'threads',
    serializeValue(metric.date),
    metric.followers_count,
    metric.follower_delta,
    '',
    metric.post_count,
    '',
    '',
    '',
    '',
    metric.total_views,
    metric.total_likes,
    metric.total_replies,
  ]);

  return toCsv(headers, [...instagramRows, ...threadsRows]);
}

function buildPostsCsv(data: Awaited<ReturnType<typeof getUserDashboardData>>): string {
  const headers = [
    'channel',
    'content_type',
    'id',
    'text',
    'timestamp',
    'permalink',
    'media_type',
    'views',
    'reach',
    'likes',
    'comments',
    'replies',
    'reposts',
    'quotes',
    'saved',
    'shares',
    'total_interactions',
    'avg_watch_time_seconds',
  ];

  const threadsRows = data.threadsPosts.map((post) => [
    'threads',
    'post',
    post.threads_id || post.id,
    post.text,
    serializeValue(post.timestamp),
    post.permalink,
    post.media_type,
    post.views,
    '',
    post.likes,
    '',
    post.replies,
    post.reposts,
    post.quotes,
    '',
    '',
    '',
    '',
  ]);

  const reelRows = data.reels.map((reel) => [
    'instagram',
    'reel',
    reel.instagram_id || reel.id,
    reel.caption,
    serializeValue(reel.timestamp),
    reel.permalink,
    reel.media_type,
    reel.views,
    reel.reach,
    reel.like_count,
    reel.comments_count,
    '',
    '',
    '',
    reel.saved,
    reel.shares,
    reel.total_interactions,
    reel.avg_watch_time_seconds,
  ]);

  const storyRows = data.stories.map((story) => [
    'instagram',
    'story',
    story.instagram_id || story.id,
    story.caption,
    serializeValue(story.timestamp),
    '',
    'STORY',
    story.views,
    story.reach,
    '',
    '',
    story.replies,
    '',
    '',
    '',
    '',
    story.total_interactions,
    '',
  ]);

  return toCsv(headers, [...threadsRows, ...reelRows, ...storyRows]);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const type = request.nextUrl.searchParams.get('type') as ExportType | null;

    if (type !== 'account-insights' && type !== 'posts') {
      return NextResponse.json(
        { success: false, error: 'type は account-insights または posts を指定してください' },
        { status: 400 }
      );
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    const data = await getUserDashboardData(userId);
    const csv = type === 'account-insights'
      ? buildAccountInsightsCsv(data)
      : buildPostsCsv(data);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `analyca-${userId}-${type}-${date}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'エクスポートに失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー',
      },
      { status: 500 }
    );
  }
}
