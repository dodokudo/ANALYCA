export interface InstagramAccountSnapshot {
  date: string;
  followers_count: number | null;
  posts_count: number | null;
  reach: number;
  engagement: number;
  profile_views: number;
  website_clicks: number;
}

const DAY_MS = 86_400_000;
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
  now?: Date;
  fetcher?: typeof fetch;
}) {
  const now = options.now ?? new Date();
  const dates = instagramInsightDates(now);
  const fetcher = options.fetcher ?? fetch;
  let savedDays = 0;
  const failedDates: string[] = [];

  // Save the newest batch before fetching older days; never do one DML job per day.
  for (let offset = 0; offset < dates.length; offset += 7) {
    const rows = await Promise.all(dates.slice(offset, offset + 7).map(async (date) => {
      const since = Date.parse(`${date}T00:00:00+09:00`);
      const until = Math.min(since + DAY_MS, now.getTime());
      if (until <= since) return null;
      const url = new URL(`${options.graphBase}/${options.accountId}/insights`);
      url.search = new URLSearchParams({
        metric: METRICS.join(','), metric_type: 'total_value', period: 'day',
        since: String(Math.floor(since / 1000)), until: String(Math.floor(until / 1000)),
        access_token: options.accessToken,
      }).toString();
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error('Instagram insights request failed');
        const body = await response.json();
        const metrics = new Map<string, number>();
        for (const metric of body.data ?? []) {
          const value = metric.total_value?.value;
          if (typeof value === 'number' && Number.isFinite(value)) metrics.set(metric.name, value);
        }
        // A missing metric is not a measured zero. Preserve the stored row on failure.
        if (METRICS.some(name => !metrics.has(name))) throw new Error('Incomplete Instagram insights');
        return {
          date,
          followers_count: date === dates[0] ? options.followers : null,
          posts_count: date === dates[0] ? options.posts : null,
          reach: metrics.get('reach')!,
          engagement: metrics.get('accounts_engaged')!,
          profile_views: metrics.get('profile_views')!,
          website_clicks: metrics.get('website_clicks')!,
        } satisfies InstagramAccountSnapshot;
      } catch {
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
  return { success: failedDates.length === 0, savedDays, failedDates };
}
