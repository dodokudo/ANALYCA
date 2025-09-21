import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

import {
  getUserDashboardData,
  InstagramInsights,
  InstagramReel,
  InstagramStory,
  LineDaily
} from '@/lib/bigquery';

export const dynamic = 'force-dynamic';

const MANUAL_REEL_COLUMNS = {
  title: 4,
  duration: 6,
  follows: 18,
  followRate: 19
};

type DashboardSource = 'gem-queen' | 'bigquery';

type DashboardResponse = {
  meta: {
    requestedSource: DashboardSource;
    source: DashboardSource;
    manualColumns: {
      reel: typeof MANUAL_REEL_COLUMNS;
    };
    fallbackReason?: string;
  };
  instagramRaw: string[][];
  storiesRaw: string[][];
  storiesProcessed: string[][];
  reelRawDataRaw: string[][];
  reelSheetRaw: string[][];
  dailyRaw: string[][];
  dataInfo: {
    instagramRows: number;
    storiesRows: number;
    storiesProcessedRows: number;
    reelRawDataRows: number;
    reelSheetRows: number;
    dailyRows: number;
  };
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedSource =
    (searchParams.get('source') as DashboardSource | null)?.toLowerCase() === 'bigquery'
      ? 'bigquery'
      : 'gem-queen';

  if (requestedSource === 'bigquery') {
    const userId = searchParams.get('userId') || process.env.DEFAULT_BIGQUERY_USER_ID;

    if (!userId) {
      const sheetPayload = await buildSheetPayload('bigquery', 'DEFAULT_BIGQUERY_USER_ID is not configured.');
      return NextResponse.json(sheetPayload, { status: 200 });
    }

    try {
      const bigQueryPayload = await buildBigQueryPayload(userId, requestedSource);
      return NextResponse.json(bigQueryPayload, { status: 200 });
    } catch (error) {
      console.error('BigQuery dashboard fetch failed. Falling back to Sheets.', error);
      const sheetPayload = await buildSheetPayload('bigquery', 'BigQuery fetch failed, using Sheets data.');
      return NextResponse.json(sheetPayload, { status: 200 });
    }
  }

  const sheetPayload = await buildSheetPayload(requestedSource);
  return NextResponse.json(sheetPayload, { status: 200 });
}

async function buildSheetPayload(requestedSource: DashboardSource, fallbackReason?: string): Promise<DashboardResponse> {
  const sheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const credentials = process.env.GOOGLE_CREDENTIALS;

  if (!sheetId || !credentials) {
    throw new Error('GOOGLE_SPREADSHEET_ID or GOOGLE_CREDENTIALS is not configured.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const ranges = [
    'Instagram insight!A:Z',
    'stories rawdata!A:Z',
    'stories!A:Z',
    'reel rawdata!A:Z',
    'reel!A:Z',
    'daily!A:Z'
  ];

  const batchResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges
  });

  const [instagramRaw, storiesRaw, storiesProcessed, reelRawDataRaw, reelSheetRaw, dailyRaw] =
    batchResponse.data.valueRanges?.map(range => range.values || []) || [];

  return {
    meta: {
      requestedSource,
      source: 'gem-queen',
      manualColumns: {
        reel: MANUAL_REEL_COLUMNS
      },
      fallbackReason
    },
    instagramRaw: instagramRaw || [],
    storiesRaw: storiesRaw || [],
    storiesProcessed: storiesProcessed || [],
    reelRawDataRaw: reelRawDataRaw || [],
    reelSheetRaw: reelSheetRaw || [],
    dailyRaw: dailyRaw || [],
    dataInfo: {
      instagramRows: instagramRaw?.length || 0,
      storiesRows: storiesRaw?.length || 0,
      storiesProcessedRows: storiesProcessed?.length || 0,
      reelRawDataRows: reelRawDataRaw?.length || 0,
      reelSheetRows: reelSheetRaw?.length || 0,
      dailyRows: dailyRaw?.length || 0
    }
  };
}

async function buildBigQueryPayload(userId: string, requestedSource: DashboardSource): Promise<DashboardResponse> {
  const { reels, stories, insights, lineData } = await getUserDashboardData(userId);

  const instagramRaw = formatInstagramInsights(insights);
  const { storiesRaw, storiesProcessed } = formatStories(stories);
  const { reelRawDataRaw, reelSheetRaw } = formatReels(reels);
  const dailyRaw = formatDaily(insights, lineData);

  return {
    meta: {
      requestedSource,
      source: 'bigquery',
      manualColumns: {
        reel: MANUAL_REEL_COLUMNS
      }
    },
    instagramRaw,
    storiesRaw,
    storiesProcessed,
    reelRawDataRaw,
    reelSheetRaw,
    dailyRaw,
    dataInfo: {
      instagramRows: instagramRaw.length,
      storiesRows: storiesRaw.length,
      storiesProcessedRows: storiesProcessed.length,
      reelRawDataRows: reelRawDataRaw.length,
      reelSheetRows: reelSheetRaw.length,
      dailyRows: dailyRaw.length
    }
  };
}

function formatInstagramInsights(insights: InstagramInsights[]): string[][] {
  const header = ['日付', 'フォロワー数', 'リーチ数', 'プロフィール表示数', 'Webサイトクリック数', '投稿数', 'いいね数', 'コメント数'];

  const rows = insights
    .map(item => [
      formatDate(item.date),
      formatNumber(item.followers_count),
      formatNumber(item.reach),
      formatNumber(item.profile_views),
      formatNumber(item.website_clicks),
      formatNumber(item.posts_count),
      '0',
      '0'
    ])
    .sort((a, b) => (a[0] > b[0] ? -1 : 1));

  return [header, ...rows];
}

function formatStories(stories: InstagramStory[]): { storiesRaw: string[][]; storiesProcessed: string[][] } {
  const rawHeader = [
    'Story ID',
    'Drive URL',
    'Thumbnail URL',
    'Timestamp (JST)',
    'Views',
    'Reach',
    'Replies',
    'Caption',
    'Interactions',
    'Follows',
    'Profile Visits',
    'Navigation'
  ];

  const processedHeader = [
    '投稿日時',
    'ストーリーID',
    'リーチ数',
    '閲覧数',
    'Replies',
    '閲覧率',
    'ストーリー画面',
    '表示URL'
  ];

  const rawRows = stories
    .map(story => [
      story.instagram_id || story.id,
      story.drive_image_url || '',
      story.thumbnail_url || '',
      formatDateTime(story.timestamp),
      formatNumber(story.views),
      formatNumber(story.reach),
      formatNumber(story.replies),
      story.caption || '',
      formatNumber(story.total_interactions),
      formatNumber(story.follows),
      formatNumber(story.profile_visits),
      formatNumber(story.navigation)
    ])
    .sort((a, b) => (a[3] > b[3] ? -1 : 1));

  const processedRows = stories
    .map(story => {
      const reach = safeNumber(story.reach);
      const views = safeNumber(story.views);
      const completionRate = reach > 0 ? `${((views / reach) * 100).toFixed(1)}%` : '0%';

      return [
        formatDateTime(story.timestamp),
        story.instagram_id || story.id,
        formatNumber(story.reach),
        formatNumber(story.views),
        formatNumber(story.replies),
        completionRate,
        formatNumber(story.total_interactions),
        story.thumbnail_url || ''
      ];
    })
    .sort((a, b) => (a[0] > b[0] ? -1 : 1));

  return {
    storiesRaw: [rawHeader, ...rawRows],
    storiesProcessed: [processedHeader, ...processedRows]
  };
}

function formatReels(reels: InstagramReel[]): {
  reelRawDataRaw: string[][];
  reelSheetRaw: string[][];
} {
  const rawHeader = [
    'リール ID',
    'キャプション',
    'メディアのプロダクト種別',
    'メディアの種別',
    'パーマリンク',
    '作成日',
    '閲覧数',
    'リーチ',
    'インタラクション数',
    'いいね数',
    'コメント数',
    '保存数',
    'シェア数',
    '再生時間（時）',
    '平均再生時間（秒）',
    '画像URL',
    '表示URL'
  ];

  const sheetHeader = [
    '投稿日',
    'フォロワー数',
    'フォロワー増減',
    'リールID',
    '投稿内容',
    '投稿時間',
    'リール長さ(秒)',
    '再生時間(合計秒)',
    '平均再生時間(秒)',
    '平均視聴維持率(%)',
    '閲覧数',
    'リーチ数',
    'アクション数',
    'いいね数',
    'コメント数',
    'シェア数',
    '保存数',
    '保存率(%)',
    'フォロー数',
    'フォロー率(%)'
  ];

  const rawRows = reels
    .map(reel => [
      reel.instagram_id || reel.id,
      reel.caption || '',
      reel.media_product_type || '',
      reel.media_type || '',
      reel.permalink || '',
      formatDateTime(reel.timestamp),
      formatNumber(reel.views),
      formatNumber(reel.reach),
      formatNumber(reel.total_interactions),
      formatNumber(reel.like_count),
      formatNumber(reel.comments_count),
      formatNumber(reel.saved),
      formatNumber(reel.shares),
      normaliseDurationString(reel.video_view_total_time_hours),
      formatNumber(reel.avg_watch_time_seconds),
      reel.drive_image_url || reel.thumbnail_url || '',
      reel.thumbnail_url || ''
    ])
    .sort((a, b) => (a[5] > b[5] ? -1 : 1));

  const sheetRows = buildReelSheetRows(reels);

  return {
    reelRawDataRaw: [rawHeader, ...rawRows],
    reelSheetRaw: [sheetHeader, ...sheetRows]
  };
}

function formatDaily(insights: InstagramInsights[], lineData: LineDaily[]): string[][] {
  const header = [
    '日付',
    'フォロワー数',
    '増加数',
    '総投稿数',
    'フォロー率',
    '投稿数',
    'リーチ数',
    'エンゲージ数',
    '反応率',
    'プロフィール表示数',
    'プロフクリック率',
    'クリック数',
    'CTR',
    'LINE総数',
    'LINE登録数（日別）',
    'Instagram→LINE登録率',
    '増加率',
    'アンケート数',
    '回答率',
    'ストーリーズ投稿数',
    'ストーリーズ閲覧数',
    'ストーリーズ閲覧率'
  ];

  const lineByDate = new Map<string, LineDaily>();
  lineData.forEach(entry => {
    if (entry.date) {
      lineByDate.set(entry.date, entry);
    }
  });

  const sortedInsights = [...insights].sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    return da.localeCompare(db);
  });

  let previousFollowers = 0;
  let previousLineFollowers = 0;

  const rows = sortedInsights.map(insight => {
    const date = insight.date || '';
    const followers = safeNumber(insight.followers_count);
    const followerDelta = followers - previousFollowers;
    previousFollowers = followers;

    const postsCount = safeNumber(insight.posts_count);
    const reach = safeNumber(insight.reach);
    const engagement = safeNumber(insight.engagement);
    const profileViews = safeNumber(insight.profile_views);
    const websiteClicks = safeNumber(insight.website_clicks);

    const ctr = reach > 0 ? `${((websiteClicks / reach) * 100).toFixed(1)}%` : '0%';
    const reactionRate = reach > 0 ? `${((engagement / reach) * 100).toFixed(1)}%` : '0%';
    const profileClickRate = profileViews > 0 ? `${((websiteClicks / profileViews) * 100).toFixed(1)}%` : '0%';
    const followRate = followers > 0 ? `${((followerDelta / Math.max(followers - followerDelta, 1)) * 100).toFixed(1)}%` : '0%';

    const lineEntry = lineByDate.get(date);
    const lineFollowers = lineEntry ? safeNumber(lineEntry.followers) : 0;
    const lineDailyIncrement = lineFollowers - previousLineFollowers;
    previousLineFollowers = lineFollowers;
    const lineConversionRate = reach > 0 ? `${((lineDailyIncrement / reach) * 100).toFixed(1)}%` : '0%';

    return [
      date,
      formatNumber(followers),
      formatNumber(followerDelta),
      formatNumber(postsCount),
      followRate,
      formatNumber(postsCount),
      formatNumber(reach),
      formatNumber(engagement),
      reactionRate,
      formatNumber(profileViews),
      profileClickRate,
      formatNumber(websiteClicks),
      ctr,
      formatNumber(lineFollowers),
      formatNumber(lineDailyIncrement),
      lineConversionRate,
      followers > 0 ? `${((followerDelta / Math.max(followers - followerDelta, 1)) * 100).toFixed(1)}%` : '0%',
      lineEntry ? formatNumber(lineEntry.api_multicast || 0) : '0',
      '0%',
      '0',
      '0',
      '0%'
    ];
  }).sort((a, b) => (a[0] > b[0] ? -1 : 1));

  return [header, ...rows];
}

function formatNumber(value?: number | string | null): string {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '0';
  return Math.round(num).toLocaleString('ja-JP');
}

function safeNumber(value?: number | string | null): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number.isFinite(value) ? value : 0;
}

function formatDate(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function formatDateTime(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function normaliseDurationString(value?: string | null): string {
  if (!value) return '0:00:00';
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  const numberValue = Number(value);
  if (Number.isFinite(numberValue) && numberValue > 0) {
    const totalSeconds = Math.round(numberValue * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return '0:00:00';
}

function buildReelSheetRows(reels: InstagramReel[]): string[][] {
  return reels
    .map(reel => {
      const timestamp = reel.timestamp instanceof Date ? reel.timestamp : new Date(reel.timestamp);
      const postedDate = Number.isNaN(timestamp.getTime()) ? '' : formatDate(timestamp);
      const postedTime = Number.isNaN(timestamp.getTime())
        ? ''
        : `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes()
            .toString()
            .padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;

      const totalWatchSeconds = parseDurationToSeconds(reel.video_view_total_time_hours);
      const avgWatchSeconds = safeNumber(reel.avg_watch_time_seconds);
      const views = safeNumber(reel.views);
      const reach = safeNumber(reel.reach);
      const interactions = safeNumber(reel.total_interactions);
      const likes = safeNumber(reel.like_count);
      const comments = safeNumber(reel.comments_count);
      const shares = safeNumber(reel.shares);
      const saves = safeNumber(reel.saved);

      const saveRate = views > 0 ? `${((saves / views) * 100).toFixed(1)}%` : '0%';
      const retentionRate = reach > 0 ? `${((views / reach) * 100).toFixed(1)}%` : '0%';

      return [
        postedDate,
        '0',
        '0',
        reel.instagram_id || reel.id,
        '',
        postedTime,
        '',
        formatNumber(totalWatchSeconds),
        formatNumber(avgWatchSeconds),
        retentionRate,
        formatNumber(views),
        formatNumber(reach),
        formatNumber(interactions),
        formatNumber(likes),
        formatNumber(comments),
        formatNumber(shares),
        formatNumber(saves),
        saveRate,
        '',
        ''
      ];
    })
    .sort((a, b) => (a[0] > b[0] ? -1 : 1));
}

function parseDurationToSeconds(value?: string | null): number {
  if (!value) return 0;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(value)) {
    const [h, m, s] = value.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.round(numeric * 3600);
  }
  return 0;
}
