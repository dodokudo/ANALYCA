'use client';

import { useEffect, useMemo, useState } from 'react';
import { compareNullableMetrics, rateReelMetric, type InstagramReelMetrics, type MetricKey, type Rating } from '@/lib/instagram-reel-metrics';

export interface SavedInstagramReel {
  id: string;
  timestamp: string;
  caption?: string;
  permalink?: string;
  thumbnail_url?: string;
  views: number;
  reach?: number;
  like_count: number;
  comments_count: number;
  saved?: number;
  shares?: number;
}

const clientCache = new Map<string, { rows: InstagramReelMetrics[]; expires: number }>();
const METRICS: { key: MetricKey; label: string; format: 'number' | 'seconds' | 'time' | 'percent' }[] = [
  { key: 'views', label: '再生数', format: 'number' },
  { key: 'reach', label: 'リーチ', format: 'number' },
  { key: 'totalWatchSeconds', label: '総再生時間', format: 'time' },
  { key: 'avgWatchSeconds', label: '平均視聴', format: 'seconds' },
  { key: 'retentionRate', label: '視聴維持率', format: 'percent' },
  { key: 'skipRate', label: 'スキップ率', format: 'percent' },
  { key: 'saveRate', label: '保存率', format: 'percent' },
];

function displayMetric(value: number | null, format: typeof METRICS[number]['format'], digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (format === 'number') return value.toLocaleString('ja-JP');
  if (format === 'percent') return `${value.toFixed(digits)}%`;
  if (format === 'seconds') return `${value.toFixed(1)}秒`;
  const seconds = Math.round(value);
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}時間${minutes % 60}分`;
}

function savedMetrics(reel: SavedInstagramReel): InstagramReelMetrics {
  return { id: reel.id, views: reel.views ?? null, reach: reel.reach ?? null, likes: reel.like_count ?? null, comments: reel.comments_count ?? null, saved: reel.saved ?? null, shares: reel.shares ?? null,
    avgWatchSeconds: null, totalWatchSeconds: null, skipRate: null, durationSeconds: null, retentionRate: null,
    saveRate: reel.saved != null && reel.views > 0 ? reel.saved / reel.views * 100 : null,
    mediaUrl: null, fetchedAt: '', status: 'unavailable' };
}

function MetricCell({ value, spec, rating }: { value: number | null; spec: typeof METRICS[number]; rating: Rating }) {
  const badge = { high: ['高', 'bg-emerald-50 text-emerald-700'], mid: ['同水準', 'bg-slate-100 text-slate-600'], low: ['低', 'bg-red-50 text-red-600'], unknown: ['—', 'bg-slate-100 text-slate-400'] }[rating.level];
  return <div className="min-w-0 space-y-1">
    <dt className="text-xs text-[color:var(--color-text-muted)]">{spec.label}</dt>
    <dd className="flex flex-wrap items-baseline gap-2">
      <span className="text-lg font-bold tabular-nums text-[color:var(--color-text-primary)]">{displayMetric(value, spec.format, spec.key === 'saveRate' ? 2 : 1)}</span>
      {rating.level !== 'unknown' && <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge[1]}`}>{badge[0]}</span>}
    </dd>
    {rating.rank !== null && <p className="text-[10px] text-[color:var(--color-text-muted)]">比較{rating.total}件中 {rating.rank}位</p>}
  </div>;
}

export function InstagramReelsTab({ userId, reels, allReels }: { userId: string; reels: SavedInstagramReel[]; allReels: SavedInstagramReel[] }) {
  const [live, setLive] = useState<InstagramReelMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sortBy, setSortBy] = useState<'published' | MetricKey>('published');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const reelIds = allReels.map(r => r.id).join(',');

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const cacheKey = `${userId}:${reelIds}`;
    const cached = clientCache.get(cacheKey);
    setError('');
    if (cached && cached.expires > Date.now() && retry === 0) { setLive(cached.rows); setLoading(false); return () => controller.abort(); }
    setLive([]);
    setLoading(true);
    void (async () => {
      const collected: InstagramReelMetrics[] = [];
      try {
        let offset: number | null = 0;
        while (offset !== null) {
          const response = await fetch(`/api/dashboard/${encodeURIComponent(userId)}/instagram-reels?offset=${offset}`, { signal: controller.signal });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || '最新データを取得できませんでした');
          collected.push(...body.rows);
          if (disposed) return;
          setLive([...collected]);
          offset = body.nextOffset;
        }
        if (clientCache.size >= 10) clientCache.delete(clientCache.keys().next().value!);
        clientCache.set(cacheKey, { rows: collected, expires: Date.now() + (collected.some(row => row.status === 'unavailable') ? 30000 : 15 * 60 * 1000) });
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : '最新データを取得できませんでした');
      } finally { if (!disposed) setLoading(false); }
    })();
    return () => { disposed = true; controller.abort(); };
  }, [userId, reelIds, retry]);

  const liveMap = useMemo(() => new Map(live.map(row => [row.id, row])), [live]);
  const metricsMap = useMemo(() => new Map(allReels.map(reel => {
    const current = liveMap.get(reel.id);
    return [reel.id, current && current.status !== 'unavailable' ? current : savedMetrics(reel)];
  })), [allReels, liveMap]);
  const populations = useMemo(() => Object.fromEntries(METRICS.map(spec => [spec.key, [...metricsMap.values()].map(row => row[spec.key])])) as Record<MetricKey, Array<number | null>>, [metricsMap]);
  const sorted = useMemo(() => [...reels].sort((a, b) => compareNullableMetrics(
    sortBy === 'published' ? new Date(a.timestamp).getTime() : metricsMap.get(a.id)?.[sortBy] ?? null,
    sortBy === 'published' ? new Date(b.timestamp).getTime() : metricsMap.get(b.id)?.[sortBy] ?? null, order,
  )), [reels, metricsMap, sortBy, order]);
  const unavailable = live.filter(row => row.status === 'unavailable').length;

  return <section className="ui-card p-4 sm:p-6" aria-label="リール分析">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">リール一覧</h2><p className="text-xs text-[color:var(--color-text-muted)]">表示件数 {sorted.length} · 比較対象はこのアカウントの最新{allReels.length}件（最大50件）</p></div>
      <div className="flex items-center gap-2">
        <select aria-label="リールの並べ替え" value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} className="h-9 rounded border border-[color:var(--color-border)] bg-white px-3 text-sm">
          <option value="published">投稿日</option>{METRICS.map(spec => <option key={spec.key} value={spec.key}>{spec.label}</option>)}<option value="likes">いいね数</option><option value="saved">保存数</option>
        </select>
        <button type="button" onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')} className="h-9 rounded border border-[color:var(--color-border)] bg-white px-3 text-sm">{order === 'desc' ? '降順' : '昇順'}</button>
      </div>
    </div>
    {(loading || error || unavailable > 0) && <div className="mt-2 text-xs text-[color:var(--color-text-muted)]" role="status">
      {loading ? `最新データを取得中（${live.length}/${allReels.length}件）… 保存済みデータから順に表示しています。` : error || (unavailable ? `${unavailable}件の最新データを取得できなかったため、保存済みの数値を表示しています。` : '')}
      {!loading && (error || unavailable > 0) && <button type="button" onClick={() => setRetry(n => n + 1)} className="ml-3 text-[color:var(--color-accent)] underline">再試行</button>}
    </div>}
    <div className="mt-6 space-y-4">
      {sorted.map(reel => {
        const metrics = metricsMap.get(reel.id)!;
        return <article key={reel.id} className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-3 sm:flex-row">
          {reel.thumbnail_url && <a href={reel.permalink} target="_blank" rel="noopener noreferrer" className="shrink-0"><img src={reel.thumbnail_url} alt="リールのサムネイル" className="aspect-[9/16] w-24 rounded-md object-cover" loading="lazy" /></a>}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--color-text-muted)]">
              <span>{new Date(reel.timestamp).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}{metrics.durationSeconds !== null && ` · 動画 ${metrics.durationSeconds.toFixed(1)}秒`}{!metrics.fetchedAt && ' · 保存済み'}</span>
              {reel.permalink && <a href={reel.permalink} target="_blank" rel="noopener noreferrer" className="font-medium text-[color:var(--color-accent)]">Instagramで開く</a>}
            </div>
            <dl className="grid grid-cols-2 gap-4 min-[480px]:grid-cols-3 xl:grid-cols-7">{METRICS.map(spec => <MetricCell key={spec.key} spec={spec} value={metrics[spec.key]} rating={rateReelMetric(metrics[spec.key], populations[spec.key], spec.key === 'skipRate')} />)}</dl>
            <dl className="grid grid-cols-2 gap-3 border-t border-[color:var(--color-border)] pt-3 text-xs sm:grid-cols-4">{([['likes', 'いいね'], ['comments', 'コメント'], ['saved', '保存'], ['shares', 'シェア']] as const).map(([key, label]) => <div key={key}><dt className="text-[color:var(--color-text-muted)]">{label}</dt><dd className="mt-1 font-semibold">{displayMetric(metrics[key], 'number')}</dd></div>)}</dl>
          </div>
        </article>;
      })}
      {!sorted.length && <p className="py-8 text-center text-sm text-[color:var(--color-text-muted)]">この期間のリールがありません。期間を変更してください。</p>}
    </div>
  </section>;
}
