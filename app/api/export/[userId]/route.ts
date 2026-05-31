import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getUserDashboardData } from '@/lib/bigquery';

type ExportChannel = 'threads' | 'instagram';
type ExportType = 'account-insights' | 'posts' | 'reels' | 'stories';

type CsvValue = string | number | boolean | null | undefined;
type DashboardData = Awaited<ReturnType<typeof getUserDashboardData>>;

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

function buildThreadsAccountInsightsCsv(data: DashboardData): string {
  const headers = [
    'date',
    'followers_count',
    'follower_delta',
    'post_count',
    'total_views',
    'total_likes',
    'total_replies',
  ];

  return toCsv(headers, data.threadsDailyMetrics.map((metric) => [
    serializeValue(metric.date),
    metric.followers_count,
    metric.follower_delta,
    metric.post_count,
    metric.total_views,
    metric.total_likes,
    metric.total_replies,
  ]));
}

function buildInstagramAccountInsightsCsv(data: DashboardData): string {
  const headers = [
    'date',
    'followers_count',
    'posts_count',
    'reach',
    'engagement',
    'profile_views',
    'website_clicks',
  ];

  return toCsv(headers, data.insights.map((insight) => [
    serializeValue(insight.date),
    insight.followers_count,
    insight.posts_count,
    insight.reach,
    insight.engagement,
    insight.profile_views,
    insight.website_clicks,
  ]));
}

function getCommentTransitionRate(previousViews: number, currentViews: number): CsvValue {
  if (!previousViews || previousViews <= 0) return '';
  return Number(((currentViews / previousViews) * 100).toFixed(2));
}

function buildThreadsPostsCsv(data: DashboardData): string {
  const commentsByPostId = new Map<string, typeof data.threadsComments>();

  for (const comment of data.threadsComments) {
    if (!commentsByPostId.has(comment.parent_post_id)) {
      commentsByPostId.set(comment.parent_post_id, []);
    }
    commentsByPostId.get(comment.parent_post_id)!.push(comment);
  }

  for (const comments of commentsByPostId.values()) {
    comments.sort((a, b) => (a.depth || 0) - (b.depth || 0));
  }

  const maxCommentCount = Math.max(
    0,
    ...Array.from(commentsByPostId.values()).map((comments) => comments.length)
  );

  const baseHeaders = [
    'post_id',
    'text',
    'timestamp',
    'permalink',
    'media_type',
    'views',
    'likes',
    'replies',
    'reposts',
    'quotes',
    'comment_count',
    'overall_comment_transition_rate',
  ];

  const commentHeaders = Array.from({ length: maxCommentCount }).flatMap((_, index) => {
    const number = index + 1;
    return [
      `comment_${number}_id`,
      `comment_${number}_text`,
      `comment_${number}_views`,
      `comment_${number}_transition_rate`,
    ];
  });

  const rows = data.threadsPosts.map((post) => {
    const comments = commentsByPostId.get(post.threads_id) || [];
    const lastComment = comments[comments.length - 1];
    const baseRow: CsvValue[] = [
      post.threads_id || post.id,
      post.text,
      serializeValue(post.timestamp),
      post.permalink,
      post.media_type,
      post.views,
      post.likes,
      post.replies,
      post.reposts,
      post.quotes,
      comments.length,
      lastComment ? getCommentTransitionRate(post.views || 0, lastComment.views || 0) : '',
    ];

    const commentColumns: CsvValue[] = [];
    for (let index = 0; index < maxCommentCount; index += 1) {
      const comment = comments[index];
      if (!comment) {
        commentColumns.push('', '', '', '');
        continue;
      }

      const previousViews = index === 0 ? post.views || 0 : comments[index - 1]?.views || 0;
      commentColumns.push(
        comment.comment_id || comment.id,
        comment.text,
        comment.views,
        getCommentTransitionRate(previousViews, comment.views || 0)
      );
    }

    return [...baseRow, ...commentColumns];
  });

  return toCsv([...baseHeaders, ...commentHeaders], rows);
}

function buildInstagramReelsCsv(data: DashboardData): string {
  const headers = [
    'reel_id',
    'caption',
    'timestamp',
    'permalink',
    'media_type',
    'views',
    'reach',
    'likes',
    'comments',
    'saved',
    'shares',
    'total_interactions',
    'avg_watch_time_seconds',
  ];

  return toCsv(headers, data.reels.map((reel) => [
    reel.instagram_id || reel.id,
    reel.caption,
    serializeValue(reel.timestamp),
    reel.permalink,
    reel.media_type,
    reel.views,
    reel.reach,
    reel.like_count,
    reel.comments_count,
    reel.saved,
    reel.shares,
    reel.total_interactions,
    reel.avg_watch_time_seconds,
  ]));
}

function buildInstagramStoriesCsv(data: DashboardData): string {
  const headers = [
    'story_id',
    'caption',
    'timestamp',
    'views',
    'reach',
    'replies',
    'total_interactions',
  ];

  return toCsv(headers, data.stories.map((story) => [
    story.instagram_id || story.id,
    story.caption,
    serializeValue(story.timestamp),
    story.views,
    story.reach,
    story.replies,
    story.total_interactions,
  ]));
}

function getCsv(data: DashboardData, channel: ExportChannel, type: ExportType): string | null {
  if (channel === 'threads') {
    if (type === 'account-insights') return buildThreadsAccountInsightsCsv(data);
    if (type === 'posts') return buildThreadsPostsCsv(data);
    return null;
  }

  if (type === 'account-insights') return buildInstagramAccountInsightsCsv(data);
  if (type === 'reels') return buildInstagramReelsCsv(data);
  if (type === 'stories') return buildInstagramStoriesCsv(data);
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const channel = request.nextUrl.searchParams.get('channel') as ExportChannel | null;
    const type = request.nextUrl.searchParams.get('type') as ExportType | null;

    if (channel !== 'threads' && channel !== 'instagram') {
      return NextResponse.json(
        { success: false, error: 'channel は threads または instagram を指定してください' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'type を指定してください' },
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
    const csv = getCsv(data, channel, type);

    if (!csv) {
      return NextResponse.json(
        { success: false, error: '指定されたCSV種別はこのチャンネルでは利用できません' },
        { status: 400 }
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `analyca-${userId}-${channel}-${type}-${date}.csv`;

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
