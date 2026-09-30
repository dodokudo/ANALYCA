import type { InstagramDailyRow } from '@/lib/instagram-daily';

const formatNumber = (value: number | null | undefined): string => value == null ? '—' : value.toLocaleString('ja-JP');

export function InstagramDailyTable({ rows }: { rows: InstagramDailyRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
      <table className="w-full whitespace-nowrap text-sm">
        <thead className="bg-gray-50">
          <tr className="border-b border-[color:var(--color-border)] text-right text-xs text-[color:var(--color-text-secondary)]">
            <th className="px-3 py-2 text-left">日付</th>
            <th className="px-3 py-2">フォロワー</th>
            <th className="px-3 py-2">増減</th>
            <th className="px-3 py-2" title="その日に投稿したリールの件数">投稿</th>
            <th className="px-3 py-2">リーチ</th>
            <th className="px-3 py-2">プロフ表示</th>
            <th className="px-3 py-2">クリック</th>
            <th className="px-3 py-2">ストーリー投稿</th>
            <th className="px-3 py-2" title="その日に投稿したストーリーの最大リーチ">ストーリー閲覧</th>
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
              <td className="px-3 py-2">{formatNumber(row.reach)}</td>
              <td className="px-3 py-2">{formatNumber(row.profile_views)}</td>
              <td className="px-3 py-2">{formatNumber(row.website_clicks)}</td>
              <td className="px-3 py-2">{formatNumber(row.storyPostCount)}</td>
              <td className="px-3 py-2">{formatNumber(row.storyReach)}</td>
              <td className="px-3 py-2">{row.storyViewRate === null ? '—' : `${(row.storyViewRate * 100).toFixed(1)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
