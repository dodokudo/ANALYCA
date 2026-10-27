'use client';

import { useMemo, useState } from 'react';
import { compareNullableMetrics, rateReelMetric, getSavedReelMetrics, type SavedReelMetricSource, type MetricKey, type Rating } from '@/lib/instagram-reel-metrics';

export interface SavedInstagramReel extends SavedReelMetricSource {
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

export function InstagramReelsTab({ reels, allReels }: { userId: string; reels: SavedInstagramReel[]; allReels: SavedInstagramReel[] }) {
  const [sortBy, setSortBy] = useState<'published' | MetricKey>('published');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const metricsMap = useMemo(() => new Map(allReels.map(reel => [reel.id, getSavedReelMetrics(reel)])), [allReels]);
  const populations = useMemo(() => Object.fromEntries(METRICS.map(spec => [spec.key, [...metricsMap.values()].map(row => row[spec.key])])) as Record<MetricKey, Array<number | null>>, [metricsMap]);
  const sorted = useMemo(() => [...reels].sort((a, b) => compareNullableMetrics(
    sortBy === 'published' ? new Date(a.timestamp).getTime() : metricsMap.get(a.id)?.[sortBy] ?? null,
    sortBy === 'published' ? new Date(b.timestamp).getTime() : metricsMap.get(b.id)?.[sortBy] ?? null, order,
  )), [reels, metricsMap, sortBy, order]);

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
    <div className="mt-6 space-y-4">
      {sorted.map(reel => {
        const metrics = metricsMap.get(reel.id)!;
        return <article key={reel.id} className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-3 sm:flex-row">
          {reel.thumbnail_url && <a href={reel.permalink} target="_blank" rel="noopener noreferrer" className="shrink-0"><img src={reel.thumbnail_url} alt="リールのサムネイル" className="aspect-[9/16] w-24 rounded-md object-cover" loading="lazy" /></a>}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--color-text-muted)]">
              <span>{new Date(reel.timestamp).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}{metrics.durationSeconds !== null && ` · 動画 ${metrics.durationSeconds.toFixed(1)}秒`}</span>
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
