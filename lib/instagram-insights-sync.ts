import { MEDIA_METRICS, readMediaBreakdown } from './instagram-media-breakdown';
import { instagramApiError } from './instagram-api-error';

export interface InstagramAccountSnapshot {
  media_breakdown?: string | null;
  date: string;
  followers_count: number | null;
  posts_count: number | null;
  reach: number;
  engagement: number;
  profile_views: number;
  website_clicks: number;
  views?: number | null;
  total_interactions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  follows?: number | null;
  unfollows?: number | null;
}

const DAY_MS = 86_400_000;
const EXTRA_METRICS = ['views', 'total_interactions', 'likes', 'comments', 'shares', 'saves'] as const;
const METRICS = ['reach', 'profile_views', 'website_clicks', 'accounts_engaged'] as const;

// Cover all dashboard presets, including last month, in Japanese calendar days.
export function instagramInsightDates(now: Date): string[] {
  const today = new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const cursor = new Date(`${today}T00:00:00Z`);
  const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1));
  const dates: string[] = [];
  while (cursor >= first) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
}

export async function syncAccountInsightDays(options: {
  graphBase: string;
  accountId: string;
  accessToken: string;
  followers: number;
  posts: number;
  save: (rows: InstagramAccountSnapshot[]) => Promise<void>;
  range?: 'thisWeek';
  now?: Date;
  fetcher?: typeof fetch;
}) {
  const now = options.now ?? new Date();
  let dates = instagramInsightDates(now);
  if (options.range === 'thisWeek') {
    const weekday = new Date(`${dates[0]}T00:00:00Z`).getUTCDay();
    dates = dates.slice(0, weekday + 1);
  }
  const fetcher = options.fetcher ?? fetch;
  let savedDays = 0;
  const failedDates: string[] = [];
  const apiErrors: string[] = [];

  // Save the newest batch before fetching older days; never do one DML job per day.
  for (let offset = 0; offset < dates.length; offset += 7) {
    const rows = await Promise.all(dates.slice(offset, offset + 7).map(async (date): Promise<InstagramAccountSnapshot | null> => {
      const since = Date.parse(`${date}T00:00:00+09:00`);
      const until = Math.min(since + DAY_MS, now.getTime());
      if (until <= since) return null;
      const url = new URL(`${options.graphBase}/${options.accountId}/insights`);
      url.search = new URLSearchParams({
        metric: [...METRICS, ...EXTRA_METRICS].join(','), metric_type: 'total_value', period: 'day',
        since: String(Math.floor(since / 1000)), until: String(Math.floor(until / 1000)),
        access_token: options.accessToken,
      }).toString();
      try {
        let response = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
        if (response.status === 400) {
          const coreUrl = new URL(url);
          coreUrl.searchParams.set('metric', METRICS.join(','));
          response = await fetcher(coreUrl, { signal: AbortSignal.timeout(15_000) });
        }
        if (!response.ok) throw await instagramApiError(response, `insights ${date}`);
        const body = await response.json();
        const metrics = new Map<string, number>();
        for (const metric of body.data ?? []) {
          const value = metric.total_value?.value;
          if (typeof value === 'number' && Number.isFinite(value)) metrics.set(metric.name, value);
        }
        // A missing metric is not a measured zero. Preserve the stored row on failure.
        if (METRICS.some(name => !metrics.has(name))) throw new Error('Incomplete Instagram insights');
        let follows: number | null = null;
        let unfollows: number | null = null;
        const followsUrl = new URL(url);
        followsUrl.searchParams.set('metric', 'follows_and_unfollows');
        followsUrl.searchParams.set('breakdown', 'follow_type');
        try {
          const followResponse = await fetcher(followsUrl, { signal: AbortSignal.timeout(15_000) });
          if (followResponse.ok) {
            const followBody = await followResponse.json();
            const breakdowns = followBody.data?.find((metric: { name: string }) => metric.name === 'follows_and_unfollows')?.total_value?.breakdowns ?? [];
            for (const breakdown of breakdowns) {
              const dimension = breakdown.dimension_keys?.indexOf('follow_type');
              if (dimension == null || dimension < 0) continue;
              for (const result of breakdown.results ?? []) {
                if (typeof result.value !== 'number') continue;
                if (result.dimension_values?.[dimension] === 'FOLLOWER') follows = result.value;
                if (result.dimension_values?.[dimension] === 'NON_FOLLOWER') unfollows = result.value;
              }
            }
          } else {
            throw await instagramApiError(followResponse, `follows ${date}`);
          }
        } catch (error) { apiErrors.push(error instanceof Error ? error.message : `follows ${date} failed`); }
        let mediaBreakdown: string | null = null;
        const mediaUrl = new URL(url);
        mediaUrl.searchParams.set('metric', MEDIA_METRICS.join(','));
        mediaUrl.searchParams.set('breakdown', 'media_product_type');
        try {
          const mediaResponse = await fetcher(mediaUrl, { signal: AbortSignal.timeout(15_000) });
          if (!mediaResponse.ok) throw await instagramApiError(mediaResponse, `media breakdown ${date}`);
          const mediaBody = await mediaResponse.json();
          const breakdown = readMediaBreakdown(mediaBody.data ?? []);
          if (MEDIA_METRICS.some(metric => breakdown.REEL[metric] == null)) throw new Error(`Incomplete media breakdown ${date}`);
          mediaBreakdown = JSON.stringify(breakdown);
        } catch (error) { apiErrors.push(error instanceof Error ? error.message : `media breakdown ${date} failed`); }
        return {
          media_breakdown: mediaBreakdown,
          ...Object.fromEntries(EXTRA_METRICS.map(name => [name, metrics.get(name) ?? null])),
          follows,
          unfollows,
          date,
          followers_count: date === dates[0] ? options.followers : null,
          posts_count: date === dates[0] ? options.posts : null,
          reach: metrics.get('reach')!,
          engagement: metrics.get('accounts_engaged')!,
          profile_views: metrics.get('profile_views')!,
          website_clicks: metrics.get('website_clicks')!,
        } satisfies InstagramAccountSnapshot;
      } catch (error) {
        apiErrors.push(error instanceof Error ? error.message : `insights ${date} failed`);
        failedDates.push(date);
        return null;
      }
    }));
    const validRows = rows.filter((row): row is InstagramAccountSnapshot => row !== null);
    if (validRows.length) {
      await options.save(validRows);
      savedDays += validRows.length;
    }
  }
  return { success: failedDates.length === 0 && apiErrors.length === 0, savedDays, failedDates, apiErrors };
}
