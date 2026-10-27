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

export function summarizeInstagramDailyRows(rows: InstagramDailyRow[], expectedDays: number) {
  const complete = rows.length === expectedDays && expectedDays > 0;
  const sum = (field: 'reach' | 'profile_views' | 'website_clicks' | 'followerGrowth'): number | null => {
    if (!complete || rows.some(row => row[field] == null)) return null;
    return rows.reduce((total, row) => total + (row[field] ?? 0), 0);
  };
  return {
    totalReach: sum('reach'),
    totalProfileViews: sum('profile_views'),
    totalWebClicks: sum('website_clicks'),
    followerGrowth: sum('followerGrowth'),
    complete,
  };
}

export function instagramMetricExtent(values: (number | null | undefined)[]) {
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return { min: known.length ? Math.min(...known) : null, max: known.length ? Math.max(...known) : null };
}
