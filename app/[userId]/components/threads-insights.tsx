'use client';

import { useMemo } from 'react';

type Post = {
  text: string;
  timestamp: string;
  views: number;
  likes: number;
  replies: number;
};

type ThreadsInsightsProps = {
  posts: Post[];
};

// ============ 冒頭パターン分析 ============

const patterns = [
  { name: '緊急・ヤバい系', regex: /(緊急|速報|ヤバい|ヤバすぎ)/ },
  { name: '〜してる人系', regex: /(してる人|やってる人|使ってる人|書いてる人)/ },
  { name: '時代遅れ系', regex: /時代遅れ/ },
  { name: '損してます系', regex: /(損して|損します|無駄|もったいない)/ },
  { name: '間違ってます系', regex: /(間違って|間違えて)/ },
  { name: '終わります系', regex: /(終わって|終わります|アウト)/ },
  { name: '〜だけで系', regex: /(だけで|するだけ)/ },
  { name: '実は系', regex: /実は/ },
  { name: '多すぎ系', regex: /多すぎ/ },
  { name: '質問系', regex: /[？?]$/ },
  { name: '数字・具体性', regex: /(\d+分|\d+時間|\d+倍|\d+人|\d+%)/ },
];

function getFirstLine(text: string): string {
  return text.split('\n').filter((line) => line.trim())[0]?.trim() || '';
}

type PatternStat = {
  name: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  examples: Array<{ text: string; views: number }>;
};

function analyzePatterns(posts: Post[]): { stats: PatternStat[]; overallAvgViews: number; otherStats: PatternStat | null } {
  const overallAvgViews = posts.length > 0
    ? Math.round(posts.reduce((sum, p) => sum + p.views, 0) / posts.length)
    : 0;

  const map = new Map<string, { totalViews: number; totalLikes: number; count: number; examples: Array<{ text: string; views: number }> }>();
  const matchedPostIds = new Set<number>();

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const firstLine = getFirstLine(post.text);
    let matched = false;
    for (const pattern of patterns) {
      if (pattern.regex.test(firstLine)) {
        matched = true;
        const entry = map.get(pattern.name) || { totalViews: 0, totalLikes: 0, count: 0, examples: [] };
        entry.totalViews += post.views;
        entry.totalLikes += post.likes;
        entry.count++;
        if (entry.examples.length < 2) {
          entry.examples.push({ text: firstLine.slice(0, 40), views: post.views });
        }
        map.set(pattern.name, entry);
      }
    }
    if (matched) matchedPostIds.add(i);
  }

  // その他（どのパターンにもマッチしなかった投稿）
  let otherStats: PatternStat | null = null;
  const unmatchedPosts = posts.filter((_, i) => !matchedPostIds.has(i));
  if (unmatchedPosts.length > 0) {
    const totalViews = unmatchedPosts.reduce((sum, p) => sum + p.views, 0);
    const totalLikes = unmatchedPosts.reduce((sum, p) => sum + p.likes, 0);
    otherStats = {
      name: 'その他',
      count: unmatchedPosts.length,
      avgViews: Math.round(totalViews / unmatchedPosts.length),
      avgLikes: Math.round(totalLikes / unmatchedPosts.length),
      examples: unmatchedPosts.slice(0, 2).map(p => ({ text: getFirstLine(p.text).slice(0, 40), views: p.views })),
    };
  }

  const stats: PatternStat[] = Array.from(map.entries())
    .map(([name, entry]) => ({
      name,
      count: entry.count,
      avgViews: Math.round(entry.totalViews / entry.count),
      avgLikes: Math.round(entry.totalLikes / entry.count),
      examples: entry.examples,
    }))
    .sort((a, b) => b.avgViews - a.avgViews);

  return { stats, overallAvgViews, otherStats };
}

// ============ 曜日・時間帯分析 ============

const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type HeatmapCell = {
  dayIndex: number;
  hour: number;
  avgViews: number;
  postCount: number;
};

type DayStat = {
  dayIndex: number;
  avgViews: number;
  postCount: number;
};

type HourStat = {
  hour: number;
  avgViews: number;
  postCount: number;
};

function analyzeTimePerformance(posts: Post[]): {
  heatmapData: HeatmapCell[];
  dayStats: DayStat[];
  hourStats: HourStat[];
  maxAvgViews: number;
} {
  const matrix: Record<string, { totalViews: number; count: number }> = {};
  const dayTotals: Record<number, { totalViews: number; count: number }> = {};
  const hourTotals: Record<number, { totalViews: number; count: number }> = {};

  for (let day = 0; day < 7; day++) {
    dayTotals[day] = { totalViews: 0, count: 0 };
    for (let hour = 0; hour < 24; hour++) {
      matrix[`${day}-${hour}`] = { totalViews: 0, count: 0 };
      if (day === 0) hourTotals[hour] = { totalViews: 0, count: 0 };
    }
  }

  for (const post of posts) {
    const date = new Date(post.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    // JSTに変換
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const dayIndex = jst.getUTCDay();
    const hour = jst.getUTCHours();

    matrix[`${dayIndex}-${hour}`].totalViews += post.views;
    matrix[`${dayIndex}-${hour}`].count += 1;
    dayTotals[dayIndex].totalViews += post.views;
    dayTotals[dayIndex].count += 1;
    hourTotals[hour].totalViews += post.views;
    hourTotals[hour].count += 1;
  }

  const heatmapData: HeatmapCell[] = [];
  let maxAvg = 0;

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const { totalViews, count } = matrix[`${day}-${hour}`];
      const avg = count > 0 ? totalViews / count : 0;
      maxAvg = Math.max(maxAvg, avg);
      heatmapData.push({ dayIndex: day, hour, avgViews: avg, postCount: count });
    }
  }

  const dayStats: DayStat[] = Object.entries(dayTotals).map(([day, data]) => ({
    dayIndex: Number(day),
    avgViews: data.count > 0 ? data.totalViews / data.count : 0,
    postCount: data.count,
  }));

  const hourStats: HourStat[] = Object.entries(hourTotals).map(([hour, data]) => ({
    hour: Number(hour),
    avgViews: data.count > 0 ? data.totalViews / data.count : 0,
    postCount: data.count,
  }));

  return { heatmapData, dayStats, hourStats, maxAvgViews: maxAvg };
}

function getHeatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'bg-gray-100';
  const intensity = value / max;
  if (intensity >= 0.8) return 'bg-indigo-600';
  if (intensity >= 0.6) return 'bg-indigo-500';
  if (intensity >= 0.4) return 'bg-indigo-400';
  if (intensity >= 0.2) return 'bg-indigo-300';
  return 'bg-indigo-200';
}

const numberFormatter = new Intl.NumberFormat('ja-JP');

function formatNumber(n: number): string {
  return numberFormatter.format(Math.round(n));
}

// ============ メインコンポーネント ============

export function ThreadsInsights({ posts }: ThreadsInsightsProps) {
  const patternData = useMemo(() => analyzePatterns(posts), [posts]);
  const timeData = useMemo(() => analyzeTimePerformance(posts), [posts]);

  if (posts.length === 0) return null;

  const topPattern = patternData.stats[0];
  const maxBarValue = topPattern?.avgViews ?? 0;

  const allPatternStats = [...patternData.stats];
  if (patternData.otherStats) allPatternStats.push(patternData.otherStats);

  const bestDay = timeData.dayStats.reduce((best, cur) =>
    cur.avgViews > best.avgViews ? cur : best, timeData.dayStats[0]);

  const bestHours = timeData.hourStats
    .filter(h => h.postCount > 0)
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* ============ 冒頭パターン分析 ============ */}
      <div className="ui-card">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">
            冒頭パターン分析
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            投稿の1行目のパターン別パフォーマンス（{posts.length}件）
          </p>
        </div>

        {patternData.stats.length === 0 ? (
          <div className="mt-6 flex h-32 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)]">
            <p className="text-sm text-[color:var(--color-text-muted)]">マッチするパターンがありません</p>
          </div>
        ) : (
          <>
            {/* サマリーカード */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                  全体の平均閲覧数
                </p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">
                  {formatNumber(patternData.overallAvgViews)}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  最強の冒頭パターン
                </p>
                <p className="mt-2 text-xl font-semibold text-amber-900">
                  {topPattern.name}
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  平均 {formatNumber(topPattern.avgViews)} views（{topPattern.count}件）
                </p>
              </div>
            </div>

            {/* パターン別バー */}
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-[color:var(--color-text-primary)]">
                パターン別パフォーマンス
              </h3>
              <div className="space-y-3">
                {allPatternStats.map((stat, index) => {
                  const isTop = index === 0;
                  const isOther = stat.name === 'その他';
                  const barMax = isOther ? maxBarValue : maxBarValue;
                  const widthPercent = barMax > 0 ? (stat.avgViews / barMax) * 100 : 0;

                  return (
                    <div key={stat.name}>
                      <div className="flex items-center gap-3">
                        <span className={`w-28 shrink-0 text-xs ${
                          isTop ? 'font-semibold text-amber-700' :
                          isOther ? 'text-[color:var(--color-text-muted)]' :
                          'text-[color:var(--color-text-secondary)]'
                        }`}>
                          {stat.name}
                        </span>
                        <div className="flex-1">
                          <div className="h-5 overflow-hidden rounded bg-gray-100">
                            <div
                              className={`h-full transition-all ${
                                isTop ? 'bg-amber-500' : isOther ? 'bg-gray-300' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${Math.min(widthPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-16 text-right text-xs font-medium text-[color:var(--color-text-primary)]">
                          {formatNumber(stat.avgViews)}
                        </span>
                        <span className="w-12 text-right text-[10px] text-[color:var(--color-text-muted)]">
                          ({stat.count}件)
                        </span>
                      </div>
                      {stat.examples.length > 0 && (isTop || isOther) && (
                        <div className="ml-28 mt-1 space-y-0.5 pl-3">
                          {stat.examples.slice(0, isOther ? 2 : 1).map((ex, i) => (
                            <p key={i} className="text-[10px] text-[color:var(--color-text-muted)]">
                              例: {ex.text}...
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* インサイト */}
            {topPattern && patternData.overallAvgViews > 0 && (
              <div className="mt-6 rounded-[var(--radius-md)] border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs font-medium text-indigo-700">分析インサイト</p>
                <p className="mt-1 text-sm text-indigo-900">
                  「{topPattern.name}」パターンが最も効果的（全体平均の
                  {Math.round((topPattern.avgViews / patternData.overallAvgViews) * 100)}%）。
                  このパターンを意識した冒頭を増やすと効果的です。
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============ 曜日・時間帯別パフォーマンス ============ */}
      <div className="ui-card">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">
            曜日・時間帯別パフォーマンス
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            投稿時間ごとの平均閲覧数をヒートマップで表示します
          </p>
        </div>

        {/* サマリーカード */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
              最も効果的な曜日
            </p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">
              {DAYS_OF_WEEK[bestDay.dayIndex]}曜日
            </p>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              平均 {formatNumber(bestDay.avgViews)} views / {bestDay.postCount}投稿
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
              最も効果的な時間帯
            </p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">
              {bestHours.length > 0 ? `${bestHours[0].hour}時台` : '-'}
            </p>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              {bestHours.length > 0
                ? `平均 ${formatNumber(bestHours[0].avgViews)} views`
                : 'データなし'}
            </p>
          </div>
        </div>

        {/* ヒートマップ */}
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium text-[color:var(--color-text-primary)]">
            時間帯 × 曜日 ヒートマップ
          </h3>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* 時間帯ヘッダー */}
              <div className="flex">
                <div className="w-10 shrink-0" />
                {HOURS.filter(h => h % 3 === 0).map(hour => (
                  <div
                    key={hour}
                    className="flex-1 text-center text-[10px] text-[color:var(--color-text-secondary)]"
                    style={{ minWidth: '24px' }}
                  >
                    {hour}
                  </div>
                ))}
              </div>

              {/* 曜日ごとの行 */}
              {DAYS_OF_WEEK.map((day, dayIndex) => (
                <div key={day} className="flex items-center">
                  <div className="w-10 shrink-0 text-xs text-[color:var(--color-text-secondary)]">
                    {day}
                  </div>
                  <div className="flex flex-1 gap-[2px]">
                    {HOURS.map(hour => {
                      const cell = timeData.heatmapData.find(
                        c => c.dayIndex === dayIndex && c.hour === hour
                      );
                      return (
                        <div
                          key={hour}
                          className={`h-6 flex-1 rounded-sm transition-colors ${getHeatColor(cell?.avgViews ?? 0, timeData.maxAvgViews)}`}
                          title={`${day}曜 ${hour}時: ${cell?.postCount ?? 0}投稿, 平均${formatNumber(cell?.avgViews ?? 0)}views`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* 凡例 */}
              <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-[color:var(--color-text-secondary)]">
                <span>低</span>
                <div className="flex gap-[2px]">
                  <div className="h-3 w-3 rounded-sm bg-gray-100" />
                  <div className="h-3 w-3 rounded-sm bg-indigo-200" />
                  <div className="h-3 w-3 rounded-sm bg-indigo-300" />
                  <div className="h-3 w-3 rounded-sm bg-indigo-400" />
                  <div className="h-3 w-3 rounded-sm bg-indigo-500" />
                  <div className="h-3 w-3 rounded-sm bg-indigo-600" />
                </div>
                <span>高</span>
              </div>
            </div>
          </div>
        </div>

        {/* 曜日別バーチャート */}
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium text-[color:var(--color-text-primary)]">
            曜日別 平均閲覧数
          </h3>
          <div className="space-y-2">
            {timeData.dayStats.map(stat => {
              const maxDayAvg = Math.max(...timeData.dayStats.map(s => s.avgViews));
              const widthPercent = maxDayAvg > 0 ? (stat.avgViews / maxDayAvg) * 100 : 0;
              return (
                <div key={stat.dayIndex} className="flex items-center gap-3">
                  <span className="w-6 text-xs text-[color:var(--color-text-secondary)]">
                    {DAYS_OF_WEEK[stat.dayIndex]}
                  </span>
                  <div className="flex-1">
                    <div className="h-5 overflow-hidden rounded bg-gray-100">
                      <div
                        className="h-full bg-indigo-500 transition-all"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-16 text-right text-xs text-[color:var(--color-text-secondary)]">
                    {formatNumber(stat.avgViews)}
                  </span>
                  <span className="w-12 text-right text-[10px] text-[color:var(--color-text-muted)]">
                    ({stat.postCount}件)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
