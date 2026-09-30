import { spawn } from 'node:child_process';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { normalizeReelMetrics, readInsightValues, type InstagramReelMetrics, type MediaInsight } from './instagram-reel-metrics';

const BASE_METRICS = ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'];
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { expires: number; data: InstagramReelMetrics }>();
const pending = new Map<string, Promise<InstagramReelMetrics>>();

async function graphGet(base: string, path: string, token: string, params: Record<string, string>) {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  // Never log this URL or upstream error bodies: they can contain credentials.
  url.searchParams.set('access_token', token);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
    const body = await response.json();
    return { ok: response.ok, body };
  } catch {
    return { ok: false, body: {} };
  }
}

export async function fetchReelInsightValues(base: string, id: string, token: string): Promise<Record<string, number>> {
  const stable = await graphGet(base, `/${id}/insights`, token, { metric: BASE_METRICS.join(',') });
  let data: MediaInsight[] = stable.ok ? stable.body.data || [] : [];
  // One unsupported metric must not discard all remaining metrics. Auth/rate errors are not retried.
  if (!stable.ok && stable.body.error?.code === 100) {
    const parts = await Promise.all(BASE_METRICS.map(metric => graphGet(base, `/${id}/insights`, token, { metric })));
    data = parts.flatMap(part => part.ok ? part.body.data || [] : []);
  }
  const skip = await graphGet(base, `/${id}/insights`, token, { metric: 'reels_skip_rate' });
  if (skip.ok) data.push(...(skip.body.data || []));
  return readInsightValues(data);
}

export function getReelDuration(mediaUrl: string): Promise<number | null> {
  // Only inspect the HTTPS video URL supplied by Instagram, never caller-supplied paths.
  if (!mediaUrl.startsWith('https://')) return Promise.resolve(null);
  return new Promise(resolve => {
    let settled = false;
    let output = '';
    const child = spawn(ffprobeInstaller.path, ['-v', 'error', '-protocol_whitelist', 'https,tls,tcp,crypto', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mediaUrl], { stdio: ['ignore', 'pipe', 'ignore'] });
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(null); }, 12000);
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.on('error', () => finish(null));
    child.on('close', code => {
      const duration = Number.parseFloat(output);
      finish(code === 0 && Number.isFinite(duration) && duration > 0 ? duration : null);
    });
  });
}

export async function getLiveReelMetrics(userId: string, id: string, token: string, base: string): Promise<InstagramReelMetrics> {
  const key = `${userId}:${id}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  const running = pending.get(key);
  if (running) return running;
  const task = (async () => {
    const [values, media] = await Promise.all([
      fetchReelInsightValues(base, id, token),
      graphGet(base, `/${id}`, token, { fields: 'media_url' }),
    ]);
    const mediaUrl = media.ok && typeof media.body.media_url === 'string' ? media.body.media_url : null;
    const duration = mediaUrl ? await getReelDuration(mediaUrl) : null;
    const data = normalizeReelMetrics(id, values, duration, mediaUrl);
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + (data.status === 'unavailable' ? 30000 : CACHE_MS), data });
    return data;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
