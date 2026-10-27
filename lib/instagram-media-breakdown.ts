export const MEDIA_METRICS = ['views', 'reach', 'total_interactions', 'likes', 'comments', 'saves', 'shares'] as const;
export type MediaMetric = typeof MEDIA_METRICS[number];
export type MediaBreakdown = Record<string, Partial<Record<MediaMetric, number>>>;

interface BreakdownInsight {
  name: string;
  total_value?: { value?: number; breakdowns?: Array<{
    dimension_keys?: string[];
    results?: Array<{ dimension_values?: string[]; value?: number }>;
  }> };
}

export function readMediaBreakdown(data: BreakdownInsight[]): MediaBreakdown {
  const result: MediaBreakdown = { REEL: {}, STORY: {} };
  for (const metric of data) {
    if (!MEDIA_METRICS.includes(metric.name as MediaMetric)) continue;
    const key = metric.name as MediaMetric;
    for (const breakdown of metric.total_value?.breakdowns ?? []) {
      const index = breakdown.dimension_keys?.indexOf('media_product_type') ?? -1;
      if (index < 0) continue;
      // Empty results are a measured zero only when the API total is also zero.
      if (!breakdown.results && metric.total_value?.value !== 0) continue;
      result.REEL[key] = 0;
      result.STORY[key] = 0;
      for (const item of breakdown.results ?? []) {
        const type = item.dimension_values?.[index];
        if (!type || typeof item.value !== 'number' || !Number.isFinite(item.value)) continue;
        (result[type] ??= {})[key] = item.value;
      }
    }
  }
  return result;
}

export function parseMediaBreakdown(value?: string | null): MediaBreakdown {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

export function summarizeMediaBreakdown(rows: Array<{ media_breakdown?: string | null }>, type: string, expectedDays: number) {
  const days = rows.map(row => parseMediaBreakdown(row.media_breakdown)[type] ?? {});
  return Object.fromEntries(MEDIA_METRICS.map(metric => [metric,
    days.length === expectedDays && expectedDays > 0 && days.every(day => typeof day[metric] === 'number')
      ? days.reduce((sum, day) => sum + day[metric]!, 0) : null,
  ])) as Record<MediaMetric, number | null>;
}
