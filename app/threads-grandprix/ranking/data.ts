import {
  FALLBACK_EVENT,
  fetchGrandprixEvents,
  getBigQueryClient,
  jstDateString,
  projectId,
  resolveGrandprixEvent,
  shiftDate,
  type GrandprixEvent,
} from '../grandprix-bigquery';

export type RankingScopeKey = 'yesterday' | 'monthly' | 'custom';

export type RankChange = number | 'new' | null;

export type FollowerRankingRow = {
  rank: number;
  rankChange: RankChange;
  lineName: string;
  threadsUsername: string;
  profilePictureUrl: string;
  followerDelta: number;
  followersCount: number;
};

export type PostRankingRow = {
  rank: number;
  lineName: string;
  threadsUsername: string;
  profilePictureUrl: string;
  views: number;
  likes: number;
  replies: number;
  permalink: string;
  text: string;
};

export type ImpressionRankingRow = {
  rank: number;
  rankChange: RankChange;
  lineName: string;
  threadsUsername: string;
  profilePictureUrl: string;
  totalViews: number;
};

export type PersonalStats = {
  threadsUsername: string;
  profilePictureUrl: string;
  followerRank: number | null;
  followerDelta: number;
  followerGapToAbove: number | null;
  participantCount: number;
  impressionRank: number | null;
  impressionViews: number;
  impressionGapToAbove: number | null;
};

export type RankingScope = {
  key: RankingScopeKey;
  label: string;
  dateLabel: string;
  impLabel: string;
  impIsDelta: boolean;
  postLabel: string;
  followerRanking: FollowerRankingRow[];
  impressionRanking: ImpressionRankingRow[];
  postRanking: PostRankingRow[];
  participantCount: number;
  personal: PersonalStats | null;
};

export type RankingData = {
  generatedAt: string;
  initialScopeKey: RankingScopeKey;
  selectedDate: string;
  meUsername: string;
  event: {
    eventId: string;
    name: string;
    startDate: string;
    endDate: string;
    daysRemaining: number;
    totalDays: number;
    elapsedDays: number;
    isFinished: boolean;
  };
  events: Array<{ eventId: string; name: string }>;
  scopes: RankingScope[];
};

type StandingRow = {
  lineName: string;
  threadsUsername: string;
  normalizedThreadsUsername: string;
  profilePictureUrl: string;
  value: number;
  secondary: number;
};

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatMd(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function diffDays(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

const PARTICIPANTS_CTE = `
  participants AS (
    SELECT
      e.line_name,
      e.normalized_threads_username,
      u.user_id,
      u.threads_username,
      u.threads_profile_picture_url
    FROM \`${projectId}.analyca.threads_grandprix_entries\` e
    JOIN \`${projectId}.analyca.users\` u
      ON LOWER(REGEXP_REPLACE(TRIM(u.threads_username), r'^@', '')) = e.normalized_threads_username
    WHERE e.event_id = @eventId
  )
`;

function mapStandingRow(row: Record<string, unknown>): StandingRow {
  return {
    lineName: String(row.line_name || ''),
    threadsUsername: String(row.threads_username || ''),
    normalizedThreadsUsername: String(row.normalized_threads_username || ''),
    profilePictureUrl: String(row.threads_profile_picture_url || ''),
    value: toNumber(row.value),
    secondary: toNumber(row.secondary),
  };
}

async function fetchFollowerStandings(eventId: string, startDate: string, endDate: string): Promise<StandingRow[]> {
  const [rows] = await getBigQueryClient().query({
    query: `
      WITH ${PARTICIPANTS_CTE},
      metrics AS (
        SELECT
          user_id,
          SUM(COALESCE(follower_delta, 0)) AS follower_delta,
          ARRAY_AGG(COALESCE(followers_count, 0) ORDER BY date DESC LIMIT 1)[SAFE_OFFSET(0)] AS followers_count
        FROM \`${projectId}.analyca.threads_daily_metrics\`
        WHERE date BETWEEN @startDate AND @endDate
        GROUP BY user_id
      )
      SELECT
        p.line_name,
        p.threads_username,
        p.normalized_threads_username,
        p.threads_profile_picture_url,
        COALESCE(m.follower_delta, 0) AS value,
        COALESCE(m.followers_count, 0) AS secondary
      FROM participants p
      JOIN metrics m
        ON m.user_id = p.user_id
      ORDER BY value DESC, secondary DESC
    `,
    params: { eventId, startDate, endDate },
  });

  return rows.map(mapStandingRow);
}

async function fetchImpressionStandingsCumulative(eventId: string, startDate: string, endDate: string): Promise<StandingRow[]> {
  const [rows] = await getBigQueryClient().query({
    query: `
      WITH ${PARTICIPANTS_CTE}
      SELECT
        p.line_name,
        p.threads_username,
        p.normalized_threads_username,
        p.threads_profile_picture_url,
        SUM(COALESCE(tp.views, 0)) AS value,
        SUM(COALESCE(tp.likes, 0)) AS secondary
      FROM participants p
      JOIN \`${projectId}.analyca.threads_posts\` tp
        ON tp.user_id = p.user_id
      WHERE DATE(tp.timestamp, 'Asia/Tokyo') BETWEEN DATE(@startDate) AND DATE(@endDate)
      GROUP BY p.line_name, p.threads_username, p.normalized_threads_username, p.threads_profile_picture_url
      ORDER BY value DESC
    `,
    params: { eventId, startDate, endDate },
  });

  return rows.map(mapStandingRow);
}

// スナップショット2日分の差分から「その日に増えたimp」を参加者ごとに集計する
async function fetchImpressionStandingsDelta(eventId: string, date: string): Promise<StandingRow[]> {
  const prevDate = shiftDate(date, -1);
  const [rows] = await getBigQueryClient().query({
    query: `
      WITH ${PARTICIPANTS_CTE},
      today AS (
        SELECT user_id, threads_id, views, likes
        FROM \`${projectId}.analyca.threads_grandprix_post_snapshots\`
        WHERE event_id = @eventId AND snapshot_date = DATE(@date)
      ),
      prev AS (
        SELECT threads_id, views, likes
        FROM \`${projectId}.analyca.threads_grandprix_post_snapshots\`
        WHERE event_id = @eventId AND snapshot_date = DATE(@prevDate)
      ),
      deltas AS (
        SELECT
          t.user_id,
          SUM(GREATEST(COALESCE(t.views, 0) - COALESCE(pv.views, 0), 0)) AS views_delta,
          SUM(GREATEST(COALESCE(t.likes, 0) - COALESCE(pv.likes, 0), 0)) AS likes_delta
        FROM today t
        LEFT JOIN prev pv ON pv.threads_id = t.threads_id
        GROUP BY t.user_id
      )
      SELECT
        p.line_name,
        p.threads_username,
        p.normalized_threads_username,
        p.threads_profile_picture_url,
        COALESCE(d.views_delta, 0) AS value,
        COALESCE(d.likes_delta, 0) AS secondary
      FROM participants p
      JOIN deltas d
        ON d.user_id = p.user_id
      ORDER BY value DESC
    `,
    params: { eventId, date, prevDate },
  });

  return rows.map(mapStandingRow);
}

async function fetchPostRankingCumulative(
  eventId: string,
  startDate: string,
  endDate: string,
  limit: number,
): Promise<PostRankingRow[]> {
  const [rows] = await getBigQueryClient().query({
    query: `
      WITH ${PARTICIPANTS_CTE}
      SELECT
        p.line_name,
        p.threads_username,
        p.threads_profile_picture_url,
        COALESCE(tp.views, 0) AS views,
        COALESCE(tp.likes, 0) AS likes,
        COALESCE(tp.replies, 0) AS replies,
        tp.permalink,
        tp.text
      FROM participants p
      JOIN \`${projectId}.analyca.threads_posts\` tp
        ON tp.user_id = p.user_id
      WHERE DATE(tp.timestamp, 'Asia/Tokyo') BETWEEN DATE(@startDate) AND DATE(@endDate)
      ORDER BY views DESC, likes DESC
      LIMIT ${limit}
    `,
    params: { eventId, startDate, endDate },
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    lineName: String(row.line_name || ''),
    threadsUsername: String(row.threads_username || ''),
    profilePictureUrl: String(row.threads_profile_picture_url || ''),
    views: toNumber(row.views),
    likes: toNumber(row.likes),
    replies: toNumber(row.replies),
    permalink: String(row.permalink || ''),
    text: normalizeText(row.text).slice(0, 90),
  }));
}

// スナップショット差分ベースの「その日に伸びた投稿」ランキング（投稿日を問わない）
async function fetchPostRankingDelta(eventId: string, date: string, limit: number): Promise<PostRankingRow[]> {
  const prevDate = shiftDate(date, -1);
  const [rows] = await getBigQueryClient().query({
    query: `
      WITH ${PARTICIPANTS_CTE},
      today AS (
        SELECT user_id, threads_id, permalink, text, views, likes, replies
        FROM \`${projectId}.analyca.threads_grandprix_post_snapshots\`
        WHERE event_id = @eventId AND snapshot_date = DATE(@date)
      ),
      prev AS (
        SELECT threads_id, views, likes, replies
        FROM \`${projectId}.analyca.threads_grandprix_post_snapshots\`
        WHERE event_id = @eventId AND snapshot_date = DATE(@prevDate)
      )
      SELECT
        p.line_name,
        p.threads_username,
        p.threads_profile_picture_url,
        GREATEST(COALESCE(t.views, 0) - COALESCE(pv.views, 0), 0) AS views,
        GREATEST(COALESCE(t.likes, 0) - COALESCE(pv.likes, 0), 0) AS likes,
        GREATEST(COALESCE(t.replies, 0) - COALESCE(pv.replies, 0), 0) AS replies,
        t.permalink,
        t.text
      FROM today t
      JOIN participants p
        ON p.user_id = t.user_id
      LEFT JOIN prev pv ON pv.threads_id = t.threads_id
      ORDER BY views DESC, likes DESC
      LIMIT ${limit}
    `,
    params: { eventId, date, prevDate },
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    lineName: String(row.line_name || ''),
    threadsUsername: String(row.threads_username || ''),
    profilePictureUrl: String(row.threads_profile_picture_url || ''),
    views: toNumber(row.views),
    likes: toNumber(row.likes),
    replies: toNumber(row.replies),
    permalink: String(row.permalink || ''),
    text: normalizeText(row.text).slice(0, 90),
  }));
}

async function fetchSnapshotDates(eventId: string): Promise<Set<string>> {
  try {
    const [rows] = await getBigQueryClient().query({
      query: `
        SELECT DISTINCT CAST(snapshot_date AS STRING) AS snapshot_date
        FROM \`${projectId}.analyca.threads_grandprix_post_snapshots\`
        WHERE event_id = @eventId
      `,
      params: { eventId },
    });

    return new Set(rows.map((row) => String(row.snapshot_date || '')));
  } catch (error) {
    console.error('Failed to fetch grandprix snapshot dates:', error);
    return new Set();
  }
}

function buildRankChanges(current: StandingRow[], previous: StandingRow[] | null): RankChange[] {
  if (!previous) {
    return current.map(() => null);
  }

  const prevRankMap = new Map<string, number>();
  previous.forEach((row, index) => {
    prevRankMap.set(row.normalizedThreadsUsername, index + 1);
  });

  return current.map((row, index) => {
    const prevRank = prevRankMap.get(row.normalizedThreadsUsername);
    if (!prevRank) return 'new';
    return prevRank - (index + 1);
  });
}

function buildPersonal(
  meUsername: string,
  followerStandings: StandingRow[],
  impressionStandings: StandingRow[],
): PersonalStats | null {
  if (!meUsername) return null;

  const followerIndex = followerStandings.findIndex((row) => row.normalizedThreadsUsername === meUsername);
  const impressionIndex = impressionStandings.findIndex((row) => row.normalizedThreadsUsername === meUsername);
  const base = followerIndex >= 0 ? followerStandings[followerIndex] : impressionIndex >= 0 ? impressionStandings[impressionIndex] : null;
  if (!base) return null;

  return {
    threadsUsername: base.threadsUsername,
    profilePictureUrl: base.profilePictureUrl,
    followerRank: followerIndex >= 0 ? followerIndex + 1 : null,
    followerDelta: followerIndex >= 0 ? followerStandings[followerIndex].value : 0,
    followerGapToAbove:
      followerIndex > 0 ? followerStandings[followerIndex - 1].value - followerStandings[followerIndex].value : null,
    participantCount: followerStandings.length,
    impressionRank: impressionIndex >= 0 ? impressionIndex + 1 : null,
    impressionViews: impressionIndex >= 0 ? impressionStandings[impressionIndex].value : 0,
    impressionGapToAbove:
      impressionIndex > 0 ? impressionStandings[impressionIndex - 1].value - impressionStandings[impressionIndex].value : null,
  };
}

function toFollowerRanking(standings: StandingRow[], rankChanges: RankChange[], limit: number): FollowerRankingRow[] {
  return standings.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    rankChange: rankChanges[index] ?? null,
    lineName: row.lineName,
    threadsUsername: row.threadsUsername,
    profilePictureUrl: row.profilePictureUrl,
    followerDelta: row.value,
    followersCount: row.secondary,
  }));
}

function toImpressionRanking(standings: StandingRow[], rankChanges: RankChange[], limit: number): ImpressionRankingRow[] {
  return standings.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    rankChange: rankChanges[index] ?? null,
    lineName: row.lineName,
    threadsUsername: row.threadsUsername,
    profilePictureUrl: row.profilePictureUrl,
    totalViews: row.value,
  }));
}

type CacheEntry = {
  expiresAt: number;
  promise: Promise<RankingData>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const rankingCache = new Map<string, CacheEntry>();

export async function getGrandprixRankingData(
  selectedDateInput?: string,
  eventIdInput?: string,
  meInput?: string,
): Promise<RankingData> {
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDateInput || '') ? selectedDateInput! : '';
  const meUsername = String(meInput || '').trim().replace(/^@/, '').toLowerCase().slice(0, 30);
  const cacheKey = `${eventIdInput || ''}|${selectedDate}|${jstDateString()}`;

  const cached = rankingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const data = await cached.promise;
    return personalizeRankingData(data, meUsername);
  }

  const promise = buildRankingData(selectedDate, eventIdInput);
  rankingCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, promise });

  try {
    const data = await promise;
    return personalizeRankingData(data, meUsername);
  } catch (error) {
    rankingCache.delete(cacheKey);
    throw error;
  }
}

type StandingsByScope = Map<RankingScopeKey, { follower: StandingRow[]; impression: StandingRow[] }>;

const scopeStandingsCache = new Map<string, { expiresAt: number; standings: StandingsByScope }>();

function personalizeRankingData(data: RankingData, meUsername: string): RankingData {
  const standingsEntry = scopeStandingsCache.get(data.generatedAt);

  return {
    ...data,
    meUsername,
    scopes: data.scopes.map((scope) => {
      const standings = standingsEntry?.standings.get(scope.key);
      return {
        ...scope,
        personal: standings ? buildPersonal(meUsername, standings.follower, standings.impression) : null,
      };
    }),
  };
}

async function buildRankingData(selectedDateOrEmpty: string, eventIdInput?: string): Promise<RankingData> {
  const events = await fetchGrandprixEvents();
  const event = resolveGrandprixEvent(events, eventIdInput) || FALLBACK_EVENT;

  const today = jstDateString();
  const yesterday = shiftDate(today, -1);
  const periodEnd = today <= event.endDate ? today : event.endDate;
  const yesterdayScoped = yesterday < event.startDate ? event.startDate : yesterday > event.endDate ? event.endDate : yesterday;
  const selectedDate = selectedDateOrEmpty || yesterdayScoped;
  const isFinished = today > event.endDate;
  const daysRemaining = Math.max(diffDays(today, event.endDate), 0);
  const totalDays = diffDays(event.startDate, event.endDate) + 1;
  const elapsedDays = Math.min(Math.max(diffDays(event.startDate, today) + 1, 0), totalDays);

  const snapshotDates = await fetchSnapshotDates(event.eventId);
  const hasDeltaFor = (date: string) => snapshotDates.has(date) && snapshotDates.has(shiftDate(date, -1));

  const scopeDefs: Array<{
    key: RankingScopeKey;
    label: string;
    dateLabel: string;
    startDate: string;
    endDate: string;
  }> = [
    {
      key: 'yesterday',
      label: '昨日',
      dateLabel: `${formatMd(yesterdayScoped)}集計`,
      startDate: yesterdayScoped,
      endDate: yesterdayScoped,
    },
    {
      key: 'monthly',
      label: '大会累計',
      dateLabel: `${formatMd(event.startDate)}〜${formatMd(periodEnd)}`,
      startDate: event.startDate,
      endDate: periodEnd,
    },
    {
      key: 'custom',
      label: '日付指定',
      dateLabel: `${formatMd(selectedDate)}集計`,
      startDate: selectedDate,
      endDate: selectedDate,
    },
  ];

  const standingsByScope: StandingsByScope = new Map();

  const scopes = await Promise.all(
    scopeDefs.map(async (scope) => {
      const isCumulative = scope.key === 'monthly';
      const useDelta = !isCumulative && hasDeltaFor(scope.startDate);
      const prevDate = shiftDate(scope.startDate, -1);

      const [followerStandings, followerPrevStandings, impressionStandings, impressionPrevStandings, postRanking] =
        await Promise.all([
          fetchFollowerStandings(event.eventId, scope.startDate, scope.endDate),
          isCumulative
            ? event.startDate <= yesterday
              ? fetchFollowerStandings(event.eventId, event.startDate, yesterday < event.endDate ? yesterday : event.endDate)
              : Promise.resolve(null)
            : scope.startDate > event.startDate
              ? fetchFollowerStandings(event.eventId, prevDate, prevDate)
              : Promise.resolve(null),
          isCumulative
            ? fetchImpressionStandingsCumulative(event.eventId, scope.startDate, scope.endDate)
            : useDelta
              ? fetchImpressionStandingsDelta(event.eventId, scope.startDate)
              : fetchImpressionStandingsCumulative(event.eventId, scope.startDate, scope.endDate),
          !isCumulative && useDelta && hasDeltaFor(prevDate)
            ? fetchImpressionStandingsDelta(event.eventId, prevDate)
            : Promise.resolve(null),
          isCumulative
            ? fetchPostRankingCumulative(event.eventId, scope.startDate, scope.endDate, 30)
            : hasDeltaFor(scope.startDate)
              ? fetchPostRankingDelta(event.eventId, scope.startDate, 30)
              : fetchPostRankingCumulative(event.eventId, scope.startDate, scope.endDate, 30),
        ]);

      standingsByScope.set(scope.key, { follower: followerStandings, impression: impressionStandings });

      const followerChanges = buildRankChanges(followerStandings, followerPrevStandings);
      const impressionChanges = buildRankChanges(impressionStandings, impressionPrevStandings);

      return {
        key: scope.key,
        label: scope.label,
        dateLabel: scope.dateLabel,
        impLabel: isCumulative ? '大会期間の合計imp' : useDelta ? 'この日に増えたimp' : 'この日の投稿の累計imp',
        impIsDelta: isCumulative || useDelta,
        postLabel: isCumulative || useDelta ? '伸びた投稿' : 'この日の投稿',
        followerRanking: toFollowerRanking(followerStandings, followerChanges, 5),
        impressionRanking: toImpressionRanking(impressionStandings, impressionChanges, 5),
        postRanking,
        participantCount: followerStandings.length,
        personal: null,
      };
    }),
  );

  const generatedAt = new Date().toISOString();

  scopeStandingsCache.set(generatedAt, { expiresAt: Date.now() + CACHE_TTL_MS, standings: standingsByScope });
  for (const [key, entry] of scopeStandingsCache) {
    if (entry.expiresAt <= Date.now()) scopeStandingsCache.delete(key);
  }

  return {
    generatedAt,
    initialScopeKey: selectedDateOrEmpty ? 'custom' : 'yesterday',
    selectedDate,
    meUsername: '',
    event: {
      eventId: event.eventId,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      daysRemaining,
      totalDays,
      elapsedDays,
      isFinished,
    },
    events: events.map((e) => ({ eventId: e.eventId, name: e.name })),
    scopes,
  };
}
