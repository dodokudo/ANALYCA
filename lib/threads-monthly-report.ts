export const MONTHLY_REPORT_START = '2026-08';

export interface MonthlyReportPost {
  threads_id: string;
  timestamp: string;
  text: string;
  permalink?: string;
  views: number;
  likes: number;
  replies: number;
}

export interface MonthlyReportFollowerMetric {
  date: string;
  followers_count: number;
  follower_delta: number;
}

export interface MonthlyReportAgencyMetrics {
  latestSnapshotDate: string | null;
  daily: Array<{ date: string; linkClicks: number; lineRegistrations: number }>;
}

export interface MonthlyReportDay {
  date: string;
  posts: number;
  views: number;
  followers: number | null;
  followerGrowth: number | null;
  linkClicks: number | null;
  lineRegistrations: number | null;
}

export interface ThreadsMonthlyReport {
  month: string;
  startDate: string;
  endDate: string;
  isCurrentMonth: boolean;
  posts: MonthlyReportPost[];
  views: number;
  likes: number;
  replies: number;
  followers: number | null;
  followerGrowth: number | null;
  followerDate: string | null;
  linkClicks: number | null;
  clickRecordsFrom: string | null;
  lineRegistrations: number | null;
  lineRecordsThrough: string | null;
  days: MonthlyReportDay[];
}

// 集計日は閲覧端末のタイムゾーンによらず日本時間に固定する。
export function toJstDate(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function getReportMonths(now: Date = new Date()): string[] {
  const currentMonth = toJstDate(now).slice(0, 7);
  const months: string[] = [];
  for (let month = MONTHLY_REPORT_START; month <= currentMonth;) {
    months.push(month);
    const [year, monthNumber] = month.split('-').map(Number);
    month = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  }
  return months;
}

export function formatReportMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年${monthNumber}月`;
}

export function buildThreadsMonthlyReport({
  month,
  posts,
  followerMetrics,
  agencyMetrics,
  now = new Date(),
}: {
  month: string;
  posts: MonthlyReportPost[];
  followerMetrics: MonthlyReportFollowerMetric[];
  agencyMetrics: MonthlyReportAgencyMetrics | null;
  now?: Date;
}): ThreadsMonthlyReport {
  if (!getReportMonths(now).includes(month)) throw new Error('対象外のレポート月です');
  const today = toJstDate(now);
  const [year, monthNumber] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const endDate = monthEnd < today ? monthEnd : today;
  const previousDay = new Date(Date.UTC(year, monthNumber - 1, 0)).toISOString().slice(0, 10);
  const inRange = (date: string): boolean => date >= startDate && date <= endDate;
  const uniquePosts = new Map<string, MonthlyReportPost>();
  for (const post of posts) {
    if (inRange(toJstDate(post.timestamp)) && !uniquePosts.has(post.threads_id)) {
      uniquePosts.set(post.threads_id, post);
    }
  }
  const monthPosts = [...uniquePosts.values()].sort((a, b) => b.views - a.views);
  const followersByDate = new Map<string, MonthlyReportFollowerMetric>();
  for (const row of followerMetrics) {
    const date = toJstDate(row.date);
    if (date && !followersByDate.has(date)) followersByDate.set(date, row);
  }
  const followerDates = [...followersByDate.keys()].filter(inRange).sort();
  const followerDate = followerDates.at(-1) ?? null;
  const finalFollowers = followerDate ? followersByDate.get(followerDate)!.followers_count : null;
  const startingFollowers = followersByDate.get(previousDay)?.followers_count ?? null;
  // 過去月は月末の記録がある場合だけ月間増減を確定する。
  const isCurrentMonth = month === today.slice(0, 7);
  const followerGrowth = startingFollowers !== null && finalFollowers !== null && (isCurrentMonth || followerDate === endDate)
    ? finalFollowers - startingFollowers
    : null;
  const agencyDaily = agencyMetrics?.daily ?? [];
  const firstClickDate = agencyDaily.filter(row => row.linkClicks > 0).map(row => row.date).sort()[0] ?? null;
  const clickRecordsFrom = firstClickDate && firstClickDate <= endDate
    ? (firstClickDate > startDate ? firstClickDate : startDate)
    : null;
  const snapshotDate = agencyMetrics?.latestSnapshotDate;
  const lineRecordsThrough = snapshotDate && snapshotDate >= startDate
    ? (snapshotDate < endDate ? snapshotDate : endDate)
    : null;
  const agencyByDate = new Map(agencyDaily.map(row => [row.date, row]));
  const days: MonthlyReportDay[] = [];
  for (let day = 1; day <= Number(endDate.slice(-2)); day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const dayPosts = monthPosts.filter(post => toJstDate(post.timestamp) === date);
    const follower = followersByDate.get(date);
    const priorDate = new Date(Date.UTC(year, monthNumber - 1, day - 1)).toISOString().slice(0, 10);
    const priorFollower = followersByDate.get(priorDate);
    const agency = agencyByDate.get(date);
    days.push({
      date,
      posts: dayPosts.length,
      views: dayPosts.reduce((total, post) => total + post.views, 0),
      followers: follower?.followers_count ?? null,
      followerGrowth: follower && priorFollower ? follower.followers_count - priorFollower.followers_count : null,
      linkClicks: clickRecordsFrom && date >= clickRecordsFrom ? agency?.linkClicks ?? 0 : null,
      lineRegistrations: lineRecordsThrough && date <= lineRecordsThrough ? agency?.lineRegistrations ?? 0 : null,
    });
  }
  return {
    month, startDate, endDate, isCurrentMonth,
    posts: monthPosts,
    views: monthPosts.reduce((total, post) => total + post.views, 0),
    likes: monthPosts.reduce((total, post) => total + post.likes, 0),
    replies: monthPosts.reduce((total, post) => total + post.replies, 0),
    followers: finalFollowers,
    followerGrowth,
    followerDate,
    linkClicks: clickRecordsFrom ? days.reduce((total, day) => total + (day.linkClicks ?? 0), 0) : null,
    clickRecordsFrom,
    lineRegistrations: lineRecordsThrough ? days.reduce((total, day) => total + (day.lineRegistrations ?? 0), 0) : null,
    lineRecordsThrough,
    days,
  };
}
