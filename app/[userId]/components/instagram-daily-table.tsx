import type { InstagramDailyRow } from '@/lib/instagram-daily';

const formatNumber = (value: number | null | undefined): string => value == null ? '—' : value.toLocaleString('ja-JP');

const formatRate = (a: number | null | undefined, b: number | null | undefined, digits = 2) => a == null || b == null || b <= 0 ? '—' : `${(a / b * 100).toFixed(digits)}%`;

export function InstagramPerformanceTable({ rows, showLine = false }: { rows: InstagramDailyRow[]; showLine?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
      <table className="w-full whitespace-nowrap text-sm">
        <thead className="bg-gray-50">
          <tr className="border-b border-[color:var(--color-border)] text-right text-xs text-[color:var(--color-text-secondary)]">
            <th className="px-3 py-2 text-left">日付</th>
            <th className="px-3 py-2">フォロワー数</th>
            <th className="px-3 py-2">増加</th>
            <th className="px-3 py-2">投稿</th>
            <th className="px-3 py-2">リーチ</th>
            <th className="px-3 py-2">クリック</th>
            {showLine && <><th className="px-3 py-2">LINE</th><th className="px-3 py-2" title="LINE登録 ÷ クリック">CVR</th></>}
            <th className="px-3 py-2">ストーリー投稿</th>
            <th className="px-3 py-2" title="その日に投稿したストーリーの最大リーチ">ストーリー閲覧</th>
            <th className="px-3 py-2">閲覧率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--color-border)]">
          {rows.map(row => (
            <tr key={row.date} className="text-right tabular-nums text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-muted)]">
              <td className="px-3 py-2 text-left font-medium">{new Date(`${row.date}T00:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}</td>
              <td className="px-3 py-2">{formatNumber(row.followers_count)}</td>
              <td className={`px-3 py-2 ${row.followerGrowth != null && row.followerGrowth > 0 ? 'text-green-600' : row.followerGrowth != null && row.followerGrowth < 0 ? 'text-red-600' : 'text-[color:var(--color-text-secondary)]'}`}>
                {row.followerGrowth != null && row.followerGrowth > 0 ? '+' : ''}{formatNumber(row.followerGrowth)}
              </td>
              <td className="px-3 py-2 text-[color:var(--color-text-secondary)]">{formatNumber(row.postCount)}</td>
              <td className="px-3 py-2">{formatNumber(row.reach)}</td>
              <td className="px-3 py-2">{formatNumber(row.website_clicks)}</td>
              {showLine && <><td className={`px-3 py-2 ${row.lineRegistrations != null && row.lineRegistrations > 0 ? 'text-amber-600' : 'text-[color:var(--color-text-secondary)]'}`}>{row.lineRegistrations != null && row.lineRegistrations > 0 ? '+' : ''}{formatNumber(row.lineRegistrations)}</td><td className="px-3 py-2 font-medium">{formatRate(row.lineRegistrations, row.website_clicks, 1)}</td></>}
              <td className="px-3 py-2 text-[color:var(--color-text-secondary)]">{formatNumber(row.storyPostCount)}</td>
              <td className="px-3 py-2">{formatNumber(row.storyReach)}</td>
              <td className="px-3 py-2 text-[color:var(--color-text-secondary)]">{formatRate(row.storyReach, row.followers_count, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InstagramDailyTable({ rows, showLine = false }: { rows: InstagramDailyRow[]; showLine?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
      <table className="w-full whitespace-nowrap text-sm">
        <thead className="bg-gray-50">
          <tr className="border-b border-[color:var(--color-border)] text-right text-xs text-[color:var(--color-text-secondary)]">
            <th className="px-3 py-2 text-left">日付</th>
            <th className="px-3 py-2">フォロワー</th>
            <th className="px-3 py-2">増減</th>
            <th className="px-3 py-2" title="その日に投稿したリールの件数">投稿</th>
            <th className="px-3 py-2">総投稿数</th>
            <th className="px-3 py-2">フォロー率</th>
            <th className="px-3 py-2">リーチ</th>
            <th className="px-3 py-2">エンゲージ</th>
            <th className="px-3 py-2">反応率</th>
            <th className="px-3 py-2">プロフ表示</th>
            <th className="px-3 py-2">プロフ表示率</th>
            <th className="px-3 py-2">クリック</th>
            <th className="px-3 py-2">CTR</th>
            {showLine && <><th className="px-3 py-2">LINE総数</th><th className="px-3 py-2">LINE登録数</th><th className="px-3 py-2" title="LINE登録数 ÷ リンククリック数">LINE CVR</th><th className="px-3 py-2" title="LINE登録数 ÷ フォロワー増加数">LINE増加率</th></>}
            <th className="px-3 py-2">ストーリー投稿</th>
            <th className="px-3 py-2" title="その日に投稿したストーリーの最大リーチ">ストーリーリーチ</th>
            <th className="px-3 py-2">ストーリー閲覧数</th>
            <th className="px-3 py-2" title="ストーリーの最大リーチ ÷ その日のフォロワー数">閲覧率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--color-border)]">
          {rows.map((row) => (
            <tr key={row.date} className="text-right tabular-nums text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-muted)]">
              <td className="px-3 py-2 text-left font-medium">{row.date}</td>
              <td className="px-3 py-2">{formatNumber(row.followers_count)}</td>
              <td className="px-3 py-2">
                <span className={row.followerGrowth !== null && row.followerGrowth > 0 ? 'text-green-600' : row.followerGrowth !== null && row.followerGrowth < 0 ? 'text-red-600' : 'text-[color:var(--color-text-secondary)]'}>
                  {row.followerGrowth !== null && row.followerGrowth > 0 ? '+' : ''}{formatNumber(row.followerGrowth)}
                </span>
              </td>
              <td className="px-3 py-2">{formatNumber(row.postCount)}</td>
              <td className="px-3 py-2">{formatNumber(row.posts_count)}</td>
              <td className="px-3 py-2">{formatRate(row.followerGrowth, row.profile_views)}</td>
              <td className="px-3 py-2">{formatNumber(row.reach)}</td>
              <td className="px-3 py-2">{formatNumber(row.engagement ?? row.total_interactions)}</td>
              <td className="px-3 py-2">{formatRate(row.engagement ?? row.total_interactions, row.reach)}</td>
              <td className="px-3 py-2">{formatNumber(row.profile_views)}</td>
              <td className="px-3 py-2">{formatRate(row.profile_views, row.reach)}</td>
              <td className="px-3 py-2">{formatNumber(row.website_clicks)}</td>
              <td className="px-3 py-2">{formatRate(row.website_clicks, row.profile_views)}</td>
              {showLine && <><td className="px-3 py-2">{formatNumber(row.lineFollowers)}</td><td className="px-3 py-2">{formatNumber(row.lineRegistrations)}</td><td className="px-3 py-2">{formatRate(row.lineRegistrations, row.website_clicks)}</td><td className="px-3 py-2">{formatRate(row.lineRegistrations, row.followerGrowth)}</td></>}
              <td className="px-3 py-2">{formatNumber(row.storyPostCount)}</td>
              <td className="px-3 py-2">{formatNumber(row.storyReach)}</td>
              <td className="px-3 py-2">{formatNumber(row.storyViews)}</td>
              <td className="px-3 py-2">{row.storyViewRate === null ? '—' : `${(row.storyViewRate * 100).toFixed(1)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
