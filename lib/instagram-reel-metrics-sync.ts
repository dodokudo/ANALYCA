import { getUserReels, saveInstagramReelMetricSnapshots } from './bigquery';
import { detectGraphBase } from './instagram-graph';
import type { InstagramReelMetrics } from './instagram-reel-metrics';
import { collectReelMetrics } from './instagram-reel-metrics-server';

/** Called by scheduled/manual sync only. Dashboard reads never collect metrics. */
export async function syncInstagramReelMetrics(userId: string, accessToken: string, instagramUserId: string) {
  const reels = await getUserReels(userId, 50);
  if (!reels.length) return { metricsCount: 0, metricsFailed: 0 };
  const base = (await detectGraphBase(accessToken, `/${instagramUserId}?fields=id`)).replace('/v23.0', '/v25.0');
  const snapshots: InstagramReelMetrics[] = [];
  for (let i = 0; i < reels.length; i += 4) {
    const batch = await Promise.all(reels.slice(i, i + 4).map(reel =>
      collectReelMetrics(reel.instagram_id, accessToken, base, reel.metrics?.durationSeconds ?? null),
    ));
    snapshots.push(...batch);
  }
  const metricsCount = await saveInstagramReelMetricSnapshots(userId, snapshots);
  return { metricsCount, metricsFailed: snapshots.length - metricsCount };
}
