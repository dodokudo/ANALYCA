export interface InstagramDailyContentStat {
  date: string;
  postCount: number;
  storyPostCount: number;
  storyReach: number | null;
  storyViews?: number | null;
}

export interface InstagramLineDay {
  date: string;
  followers: number | null;
  registrations?: number | null;
}

export interface InstagramDailyInsight {
  date: string;
  followers_count: number | null;
  posts_count?: number | null;
  engagement?: number | null;
  sheet_follower_growth?: number | null;
  survey_responses?: number | null;
  reach?: number;
  profile_views?: number;
  website_clicks?: number;
  views?: number | null;
  total_interactions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  follows?: number | null;
  unfollows?: number | null;
}

export interface InstagramDailyRow extends InstagramDailyInsight {
  followerGrowth: number | null;
  postCount: number | null;
  storyPostCount: number | null;
  storyReach: number | null;
  storyViewRate: number | null;
  storyViews?: number | null;
  lineFollowers?: number | null;
  lineRegistrations?: number | null;
}

// Calculate against the previous calendar day before applying the display range.
export function buildInstagramDailyRows(
  insights: InstagramDailyInsight[],
  content: InstagramDailyContentStat[] | undefined,
  line: InstagramLineDay[] = [],
): InstagramDailyRow[] {
  const byDate = new Map(insights.map((row) => [row.date, row]));
  const lineByDate = new Map(line.map(row => [row.date, row]));
  for (const row of [...line, ...(content || [])]) {
    if (!byDate.has(row.date)) byDate.set(row.date, { date: row.date, followers_count: null });
  }
  const contentByDate = new Map(content?.map((row) => [row.date, row]));
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).map((row) => {
    const previousDate = new Date(`${row.date}T00:00:00Z`);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    const previous = byDate.get(previousDate.toISOString().slice(0, 10));
    const stats = contentByDate.get(row.date);
    const storyPostCount = content === undefined ? null : stats?.storyPostCount ?? 0;
    const storyReach = storyPostCount === null ? null : storyPostCount === 0 ? 0 : stats?.storyReach ?? null;
    return {
      ...row,
      followerGrowth: row.follows != null && row.unfollows != null
        ? row.follows - row.unfollows
        : row.followers_count != null && previous?.followers_count != null
        ? row.followers_count - previous.followers_count : null,
      postCount: content === undefined ? null : stats?.postCount ?? 0,
      storyPostCount,
      storyReach,
      storyViews: storyPostCount === 0 ? 0 : stats?.storyViews ?? null,
      lineFollowers: lineByDate.get(row.date)?.followers ?? null,
      lineRegistrations: lineByDate.get(row.date)?.registrations ?? null,
      storyViewRate: storyPostCount && storyReach !== null && row.followers_count && row.followers_count > 0
        ? storyReach / row.followers_count : null,
    };
  });
}

export function summarizeInstagramDailyRows(rows: InstagramDailyRow[], expectedDays: number, baseline?: InstagramDailyInsight) {
  const complete = rows.length === expectedDays && expectedDays > 0;
  const sum = (field: 'reach' | 'profile_views' | 'website_clicks' | 'followerGrowth'): number | null => {
    if (!complete || rows.some(row => row[field] == null)) return null;
    return rows.reduce((total, row) => total + (row[field] ?? 0), 0);
  };
  // Period net growth only needs the two boundary snapshots. Missing days in
  // between must not hide an exact total or be filled with invented daily values.
  let followerGrowth = sum('followerGrowth');
  if (baseline?.followers_count != null && expectedDays > 0) {
    const endDate = new Date(`${baseline.date}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + expectedDays);
    const end = rows.find(row => row.date === endDate.toISOString().slice(0, 10));
    if (end?.followers_count != null) followerGrowth = end.followers_count - baseline.followers_count;
  }
  return {
    totalReach: sum('reach'),
    totalProfileViews: sum('profile_views'),
    totalWebClicks: sum('website_clicks'),
    followerGrowth,
    complete,
  };
}

// A period that includes today may extend beyond the latest account sync.
// Trim only that uncollected tail; gaps within the collected history stay unknown.
export function summarizeInstagramDailyRange(
  rows: InstagramDailyRow[],
  startDate: string,
  endDate: string,
  latestInsightDate: string | undefined,
) {
  const availableEnd = latestInsightDate && latestInsightDate < endDate ? latestInsightDate : endDate;
  const expectedDays = latestInsightDate
    ? Math.max(0, Math.round((Date.parse(availableEnd) - Date.parse(startDate)) / 86400000) + 1)
    : 0;
  const baselineDate = new Date(`${startDate}T00:00:00Z`);
  baselineDate.setUTCDate(baselineDate.getUTCDate() - 1);
  const baseline = rows.find(row => row.date === baselineDate.toISOString().slice(0, 10));
  const periodRows = latestInsightDate
    ? rows.filter(row => row.date >= startDate && row.date <= availableEnd)
    : [];
  const summary = summarizeInstagramDailyRows(periodRows, expectedDays, baseline);
  // Today's follower snapshot may arrive before its daily activity metrics.
  // Keep the follower boundary current without hiding the collected activity.
  const metricEnd = periodRows.filter(row => row.reach != null || row.profile_views != null || row.website_clicks != null)
    .reduce<string | undefined>((latest, row) => !latest || row.date > latest ? row.date : latest, undefined);
  if (metricEnd && metricEnd < availableEnd) {
    const metricDays = Math.round((Date.parse(metricEnd) - Date.parse(startDate)) / 86400000) + 1;
    const metrics = summarizeInstagramDailyRows(periodRows.filter(row => row.date <= metricEnd), metricDays, baseline);
    return { ...summary, totalReach: metrics.totalReach, totalProfileViews: metrics.totalProfileViews, totalWebClicks: metrics.totalWebClicks };
  }
  return summary;
}

export function instagramMetricExtent(values: (number | null | undefined)[]) {
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return { min: known.length ? Math.min(...known) : null, max: known.length ? Math.max(...known) : null };
}
