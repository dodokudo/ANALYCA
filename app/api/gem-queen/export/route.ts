import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getUserDashboardData } from '@/lib/bigquery';

type ExportType = 'account-insights' | 'reels' | 'stories' | 'daily';
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
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers: string[], rows: CsvValue[][]): string {
  return `\uFEFF${[
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n')}`;
}

function sheetToCsv(rows: string[][]): string {
  if (!rows.length) return '\uFEFF';
  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`;
}

function formatBigQueryCsv(type: ExportType, data: Awaited<ReturnType<typeof getUserDashboardData>>): string {
  if (type === 'account-insights') {
    return toCsv(
      ['date', 'followers_count', 'posts_count', 'reach', 'engagement', 'profile_views', 'website_clicks'],
      data.insights.map((insight) => [
        serializeValue(insight.date),
        insight.followers_count,
        insight.posts_count,
        insight.reach,
        insight.engagement,
        insight.profile_views,
        insight.website_clicks,
      ])
    );
  }

  if (type === 'reels') {
    return toCsv(
      [
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
      ],
      data.reels.map((reel) => [
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
      ])
    );
  }

  if (type === 'stories') {
    return toCsv(
      ['story_id', 'caption', 'timestamp', 'views', 'reach', 'replies', 'total_interactions'],
      data.stories.map((story) => [
        story.instagram_id || story.id,
        story.caption,
        serializeValue(story.timestamp),
        story.views,
        story.reach,
        story.replies,
        story.total_interactions,
      ])
    );
  }

  return toCsv(
    [
      'date',
      'followers_count',
      'follower_delta',
      'posts_count',
      'reach',
      'engagement',
      'profile_views',
      'website_clicks',
      'line_total',
      'line_daily',
    ],
    data.insights.map((insight) => {
      const date = String(serializeValue(insight.date));
      const line = data.lineData.find((item) => item.date === date);
      return [
        date,
        insight.followers_count,
        '',
        insight.posts_count,
        insight.reach,
        insight.engagement,
        insight.profile_views,
        insight.website_clicks,
        line?.followers,
        '',
      ];
    })
  );
}

async function fetchSheetCsv(type: ExportType): Promise<string> {
  const sheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const credentials = process.env.GOOGLE_CREDENTIALS;
  if (!sheetId || !credentials) throw new Error('GOOGLE_SPREADSHEET_ID or GOOGLE_CREDENTIALS is not configured.');

  const rangeByType: Record<ExportType, string> = {
    'account-insights': 'Instagram insight!A:Z',
    reels: 'reel!A:Z',
    stories: 'stories!A:Z',
    daily: 'daily!A:Z',
  };

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: rangeByType[type],
  });
  return sheetToCsv(response.data.values || []);
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type') as ExportType | null;
    if (type !== 'account-insights' && type !== 'reels' && type !== 'stories' && type !== 'daily') {
      return NextResponse.json(
        { success: false, error: 'type は account-insights, reels, stories, daily のいずれかを指定してください' },
        { status: 400 }
      );
    }

    let csv: string;
    const userId = process.env.DEFAULT_BIGQUERY_USER_ID;
    if (userId) {
      const data = await getUserDashboardData(userId);
      csv = formatBigQueryCsv(type, data);
    } else {
      csv = await fetchSheetCsv(type);
    }

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="gem-queen-${type}-${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GEM Queen export failed:', error);
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
