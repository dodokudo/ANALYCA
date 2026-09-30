export interface InstagramDailyContentStat {
  date: string;
  postCount: number;
  storyPostCount: number;
  storyReach: number | null;
}

export interface InstagramDailyInsight {
  date: string;
  followers_count: number | null;
  reach?: number;
  profile_views?: number;
  website_clicks?: number;
}

export interface InstagramDailyRow extends InstagramDailyInsight {
  followerGrowth: number | null;
  postCount: number | null;
  storyPostCount: number | null;
  storyReach: number | null;
  storyViewRate: number | null;
}

// Calculate against the previous calendar day before applying the display range.
export function buildInstagramDailyRows(
  insights: InstagramDailyInsight[],
  content: InstagramDailyContentStat[] | undefined,
): InstagramDailyRow[] {
  const byDate = new Map(insights.map((row) => [row.date, row]));
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
      followerGrowth: row.followers_count != null && previous?.followers_count != null
        ? row.followers_count - previous.followers_count : null,
      postCount: content === undefined ? null : stats?.postCount ?? 0,
      storyPostCount,
      storyReach,
      storyViewRate: storyPostCount && storyReach !== null && row.followers_count && row.followers_count > 0
        ? storyReach / row.followers_count : null,
    };
  });
}
