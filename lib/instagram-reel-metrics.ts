/** Shared, serializable reel metrics. Missing API values stay null. */
export interface InstagramReelMetrics {
  id: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  avgWatchSeconds: number | null;
  totalWatchSeconds: number | null;
  skipRate: number | null;
  durationSeconds: number | null;
  retentionRate: number | null;
  saveRate: number | null;
  mediaUrl: string | null;
  fetchedAt: string;
  status: 'complete' | 'partial' | 'unavailable';
}

export interface MediaInsight {
  name: string;
  values?: { value?: unknown }[];
  total_value?: { value?: unknown };
}

export function readInsightValues(data: MediaInsight[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const metric of data) {
    const raw = metric.values?.[0]?.value ?? metric.total_value?.value;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) result[metric.name] = raw;
  }
  return result;
}

export function normalizeReelMetrics(id: string, values: Record<string, number>, durationSeconds: number | null, mediaUrl: string | null): InstagramReelMetrics {
  const value = (key: string) => Number.isFinite(values[key]) ? values[key] : null;
  const avgMs = value('ig_reels_avg_watch_time');
  const totalMs = value('ig_reels_video_view_total_time');
  const views = value('views');
  const saved = value('saved');
  const avgWatchSeconds = avgMs === null ? null : avgMs / 1000;
  const duration = durationSeconds !== null && Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null;
  const required = ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time', 'reels_skip_rate'];
  return {
    id, views, reach: value('reach'), likes: value('likes'), comments: value('comments'), saved, shares: value('shares'),
    avgWatchSeconds, totalWatchSeconds: totalMs === null ? null : totalMs / 1000,
    skipRate: value('reels_skip_rate'), durationSeconds: duration,
    retentionRate: avgWatchSeconds !== null && duration !== null ? avgWatchSeconds / duration * 100 : null,
    saveRate: saved !== null && views !== null && views > 0 ? saved / views * 100 : null,
    mediaUrl, fetchedAt: new Date().toISOString(),
    status: !Object.keys(values).length ? 'unavailable' : required.every(key => value(key) !== null) && duration !== null ? 'complete' : 'partial',
  };
}

export type MetricKey = 'views' | 'reach' | 'avgWatchSeconds' | 'totalWatchSeconds' | 'skipRate' | 'retentionRate' | 'saveRate' | 'likes' | 'saved';
export type Rating = { level: 'high' | 'mid' | 'low' | 'unknown'; rank: number | null; total: number };

function quantile(sorted: number[], percentile: number): number {
  const pos = (sorted.length - 1) * percentile;
  const index = Math.floor(pos);
  return sorted[index] + (sorted[Math.min(index + 1, sorted.length - 1)] - sorted[index]) * (pos - index);
}

export function rateReelMetric(value: number | null, population: Array<number | null>, lowerIsBetter = false): Rating {
  const sorted = population.filter((n): n is number => n !== null && Number.isFinite(n)).sort((a, b) => a - b);
  if (value === null || !Number.isFinite(value) || !sorted.length) return { level: 'unknown', rank: null, total: sorted.length };
  const rank = 1 + sorted.filter(n => lowerIsBetter ? n < value : n > value).length;
  const p25 = quantile(sorted, .25);
  const p75 = quantile(sorted, .75);
  // Equal populations should not label every post high. Ties share a rank.
  const level = sorted.length < 4 || p25 === p75 ? 'mid' : lowerIsBetter
    ? value <= p25 ? 'high' : value >= p75 ? 'low' : 'mid'
    : value >= p75 ? 'high' : value <= p25 ? 'low' : 'mid';
  return { level, rank, total: sorted.length };
}

export function compareNullableMetrics(a: number | null, b: number | null, order: 'asc' | 'desc'): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return order === 'desc' ? b - a : a - b;
}
