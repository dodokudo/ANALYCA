import { instagramApiError } from './instagram-api-error';

export interface InstagramStoryResponse {
  id: string;
  media_type: string;
  timestamp: string;
  thumbnail_url?: string;
  media_url?: string;
  caption?: string;
  insights?: { data: Array<{ name: string; values: Array<{ value: number | Record<string, number> }> }> };
}

export async function fetchActiveInstagramStories(base: string, accountId: string, token: string, fetcher: typeof fetch = fetch) {
  const stories: InstagramStoryResponse[] = [];
  const first = new URL(`${base}/${accountId}/stories`);
  first.search = new URLSearchParams({ fields: 'id,media_type,timestamp,thumbnail_url,media_url,caption', limit: '50', access_token: token }).toString();
  let next: URL | null = first;
  const seen = new Set<string>();
  while (next) {
    if (next.origin !== first.origin || seen.has(next.href)) throw new Error('Invalid Instagram stories pagination');
    seen.add(next.href);
    const response = await fetcher(next, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw await instagramApiError(response, 'Instagram stories list failed');
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error('Invalid Instagram stories list');
    stories.push(...body.data);
    next = body.paging?.next ? new URL(body.paging.next) : null;
  }
  let metricsFailed = 0;
  const apiErrors: string[] = [];
  // Collect the IDs independently so unavailable insights do not lose a live story.
  for (let i = 0; i < stories.length; i += 4) {
    await Promise.all(stories.slice(i, i + 4).map(async story => {
      const url = new URL(`${base}/${story.id}/insights`);
      url.search = new URLSearchParams({ metric: 'views,reach,replies,total_interactions,follows,profile_visits,navigation', access_token: token }).toString();
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw await instagramApiError(response, `story ${story.id} insights`);
        const body = await response.json();
        if (!Array.isArray(body.data) || !body.data.length) throw new Error('Empty story insights');
        story.insights = { data: body.data };
      } catch (error) {
        metricsFailed++;
        apiErrors.push(error instanceof Error ? error.message : `story ${story.id} insights failed`);
      }
    }));
  }
  return { stories, metricsFailed, apiErrors };
}

export function extractStoryMetrics(insights: InstagramStoryResponse['insights']): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const metric of insights?.data ?? []) {
    const value = metric.values?.[0]?.value;
    if (typeof value === 'number') metrics[metric.name] = value;
    else if (value && typeof value === 'object') metrics[metric.name] = Object.values(value).reduce((sum, v) => sum + v, 0);
  }
  return metrics;
}
