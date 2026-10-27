import { MEDIA_METRICS, parseMediaBreakdown, summarizeMediaBreakdown, type MediaMetric } from '@/lib/instagram-media-breakdown';

const LABELS: Record<MediaMetric, string> = {
  views: '閲覧数', reach: 'リーチ（日別合計）', total_interactions: '反応数',
  likes: 'いいね', comments: 'コメント', saves: '保存', shares: 'シェア',
};
const display = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('ja-JP');

export function InstagramMediaPeriod({ rows, expectedDays, type }: {
  rows: Array<{ date: string; media_breakdown?: string | null }>;
  expectedDays: number;
  type: 'REEL' | 'STORY';
}) {
  const summary = summarizeMediaBreakdown(rows, type, expectedDays);
  return <section className="ui-card p-4 sm:p-6" aria-label={`${type === 'REEL' ? 'リール' : 'ストーリー'}の期間内実績`}>
    <h2 className="text-lg font-semibold">{type === 'REEL' ? 'リール' : 'ストーリー'}の期間内実績</h2>
    <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
      {MEDIA_METRICS.map(metric => <div key={metric}>
        <dt className="text-xs text-[color:var(--color-text-muted)]">{LABELS[metric]}</dt>
        <dd className="mt-1 text-xl font-semibold tabular-nums">{display(summary[metric])}</dd>
      </div>)}
    </dl>
    <div className="mt-5 overflow-x-auto"><table className="w-full whitespace-nowrap text-right text-sm">
      <thead><tr className="border-b border-[color:var(--color-border)]"><th className="px-3 py-2 text-left">日付</th>{MEDIA_METRICS.map(metric => <th key={metric} className="px-3 py-2">{LABELS[metric]}</th>)}</tr></thead>
      <tbody>{rows.map(row => {
        const metrics = parseMediaBreakdown(row.media_breakdown)[type] ?? {};
        return <tr key={row.date} className="border-b border-[color:var(--color-border)]"><td className="px-3 py-2 text-left">{row.date}</td>{MEDIA_METRICS.map(metric => <td key={metric} className="px-3 py-2 tabular-nums">{display(metrics[metric])}</td>)}</tr>;
      })}</tbody>
    </table></div>
  </section>;
}
