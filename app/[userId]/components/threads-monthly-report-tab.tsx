'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  buildThreadsMonthlyReport,
  formatReportMonth,
  getReportMonths,
  type MonthlyReportAgencyMetrics,
  type MonthlyReportFollowerMetric,
  type MonthlyReportPost,
} from '@/lib/threads-monthly-report';

interface ThreadsMonthlyReportTabProps {
  username: string;
  posts: MonthlyReportPost[];
  followerMetrics: MonthlyReportFollowerMetric[];
  agencyMetrics: MonthlyReportAgencyMetrics | null;
}

function formatNumber(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('ja-JP');
}

function formatGrowth(value: number | null): string {
  return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('ja-JP')}`;
}

function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

export default function ThreadsMonthlyReportTab({ username, posts, followerMetrics, agencyMetrics }: ThreadsMonthlyReportTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const months = getReportMonths();
  const requestedMonth = searchParams?.get('reportMonth');
  // 最初は直近の完了月を開き、当月の途中経過も選択できるようにする。
  const month = requestedMonth && months.includes(requestedMonth)
    ? requestedMonth
    : months.at(-2) ?? months.at(-1);
  const report = useMemo(() => month ? buildThreadsMonthlyReport({ month, posts, followerMetrics, agencyMetrics }) : null,
    [month, posts, followerMetrics, agencyMetrics]);

  const selectMonth = (value: string): void => {
    if (!months.includes(value)) return;
    const params = new URLSearchParams(searchParams?.toString());
    params.set('tab', 'threads');
    params.set('threadsTab', 'report');
    params.set('reportMonth', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (!report || !month) return <div className="ui-card p-6">2026年8月以降のレポートを表示します。</div>;
  const monthIndex = months.indexOf(month);
  const cards = [
    { label: '投稿数', value: formatNumber(report.posts.length), unit: '件', detail: '対象月に公開した投稿' },
    { label: '閲覧数', value: formatNumber(report.views), unit: '回', detail: '対象月の投稿の最新累計' },
    { label: 'フォロワー数', value: formatNumber(report.followers), unit: '人', detail: report.followerDate ? `${shortDate(report.followerDate)}時点` : '記録なし' },
    { label: 'フォロワー増減', value: formatGrowth(report.followerGrowth), unit: '人', detail: report.followerGrowth === null ? '月初・月末の記録が不足しています' : `${shortDate(report.startDate)}〜${shortDate(report.followerDate!)}` },
    { label: 'リンククリック', value: formatNumber(report.linkClicks), unit: '回', detail: report.clickRecordsFrom ? `${shortDate(report.clickRecordsFrom)}〜${shortDate(report.endDate)}の記録` : '記録なし' },
    { label: 'LINE登録数', value: formatNumber(report.lineRegistrations), unit: '人', detail: report.lineRecordsThrough ? `Threads経由・${shortDate(report.lineRecordsThrough)}まで` : '記録なし' },
  ];

  return (
    <div className="section-stack">
      <section className="ui-card p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-[color:var(--color-text-secondary)]">
              <span>@{username}</span>
              {report.isCurrentMonth && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">集計中</span>}
            </div>
            <h2 className="text-xl font-semibold text-[color:var(--color-text-primary)] md:text-2xl">{formatReportMonth(month)} 運用レポート</h2>
            <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
              {report.startDate.replaceAll('-', '/')} 〜 {report.endDate.replaceAll('-', '/')}（日本時間）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="前の月" disabled={monthIndex === 0} onClick={() => selectMonth(months[monthIndex - 1])}
              className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 text-sm disabled:opacity-30">←</button>
            <label className="sr-only" htmlFor="report-month">レポート月</label>
            <select id="report-month" value={month} onChange={event => selectMonth(event.target.value)}
              className="h-10 flex-1 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm">
              {months.map(value => <option key={value} value={value}>{formatReportMonth(value)}{value === months.at(-1) ? '（集計中）' : ''}</option>)}
            </select>
            <button type="button" aria-label="次の月" disabled={monthIndex === months.length - 1} onClick={() => selectMonth(months[monthIndex + 1])}
              className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 text-sm disabled:opacity-30">→</button>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map(card => (
            <div key={card.label} className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-3 md:p-4">
              <dt className="text-xs font-medium text-[color:var(--color-text-secondary)]">{card.label}</dt>
              <dd className="mt-2 text-xl font-semibold tabular-nums text-[color:var(--color-text-primary)] md:text-2xl">
                {card.value}<span className="ml-1 text-xs font-normal">{card.value !== '—' ? card.unit : ''}</span>
              </dd>
              <p className="mt-2 text-xs leading-relaxed text-[color:var(--color-text-secondary)]">{card.detail}</p>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-[color:var(--color-text-secondary)]">
          閲覧数・いいね・返信は、対象月に公開した投稿の最新取得時点の累計です。月末時点の確定値ではありません。
          LINE登録数は、現在のThreads流入タグ対象者を友だち追加日で集計しています。「—」は記録がない項目です。
        </p>
      </section>

      <section className="ui-card p-4 md:p-6">
        <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">日別の推移</h3>
        <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">投稿日の閲覧数とフォロワー数</p>
        <div className="mt-5 h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={report.days} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="views" width={52} tickFormatter={value => Number(value).toLocaleString('ja-JP')} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="followers" orientation="right" domain={['auto', 'auto']} width={44} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={label => shortDate(String(label))} formatter={value => typeof value === 'number' ? value.toLocaleString('ja-JP') : value} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="views" dataKey="views" name="閲覧数" fill="#c4b5fd" radius={[3, 3, 0, 0]} />
              <Line yAxisId="followers" dataKey="followers" name="フォロワー数" stroke="#059669" strokeWidth={2} dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="p-4 md:p-6">
          <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">閲覧数が多かった投稿</h3>
          <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">上位5件・いいね {formatNumber(report.likes)}件 / 返信 {formatNumber(report.replies)}件（対象月の投稿合計）</p>
        </div>
        {report.posts.length === 0 ? <p className="px-6 pb-6 text-sm text-[color:var(--color-text-secondary)]">この月の投稿データはありません。</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <thead className="bg-[color:var(--color-surface-muted)] text-xs text-[color:var(--color-text-secondary)]">
                <tr><th className="px-4 py-3 text-left">投稿</th><th className="px-4 py-3 text-right">閲覧数</th><th className="px-4 py-3 text-right">いいね</th><th className="px-4 py-3 text-right">返信</th></tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {report.posts.slice(0, 5).map(post => (
                  <tr key={post.threads_id}>
                    <td className="max-w-sm px-4 py-4">
                      <p className="mb-1 text-xs text-[color:var(--color-text-secondary)]">{new Date(post.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      {post.permalink && /^https:\/\//.test(post.permalink)
                        ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-purple-700 hover:underline">{post.text || '投稿を見る'}</a>
                        : <p className="line-clamp-2">{post.text || 'テキストなし'}</p>}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums">{formatNumber(post.views)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{formatNumber(post.likes)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{formatNumber(post.replies)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ui-card overflow-hidden">
        <details>
          <summary className="cursor-pointer p-4 text-base font-semibold md:p-6">日別の運用データ（{report.days.length}日分）</summary>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm tabular-nums">
              <thead className="bg-[color:var(--color-surface-muted)] text-xs text-[color:var(--color-text-secondary)]">
                <tr>{['日付', '投稿数', '閲覧数', 'フォロワー', '増減', 'リンククリック', 'LINE登録数'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {report.days.map(day => <tr key={day.date}>
                  <td className="px-4 py-3">{shortDate(day.date)}</td><td className="px-4 py-3">{formatNumber(day.posts)}</td>
                  <td className="px-4 py-3">{formatNumber(day.views)}</td><td className="px-4 py-3">{formatNumber(day.followers)}</td>
                  <td className="px-4 py-3">{formatGrowth(day.followerGrowth)}</td><td className="px-4 py-3">{formatNumber(day.linkClicks)}</td>
                  <td className="px-4 py-3">{formatNumber(day.lineRegistrations)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
